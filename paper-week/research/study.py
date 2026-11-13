"""What is a good sign and what is a bad sign? A 5-year study of every liquid US stock.

For every stock and every day (when it was liquid: close >= $5 and 20-day average volume >= 1M),
it records what was visible at that day's close, and what happened next:

  R       the paper month's trade: buy the next open, stop 2 x ATR14, target 2R, max 5 days
  excess  the 5-day return from the next open MINUS SPY's over the same days (market drift removed)

Honesty rules built in:
  * Date-clustered t-scores: all stocks on one day count as ONE observation (the day's average), so
    50 correlated breakouts on one market day are not 50 independent proofs.
  * Two halves: DISCOVERY (older 2 years) and VALIDATION (newer 2 years). A sign is only trusted
    when it points the same way in both.
  * Known bias: the universe is TODAY's liquid stocks, so companies that collapsed or were delisted
    are missing. That flatters "buy the beaten-down stock" signals in particular.

    python3 -I research/study.py HISTORY_DIR [--out research/study_results.json]
"""
import argparse
import glob
import json
import os
import sys

import numpy as np
import pandas as pd

HOLD, ATR_K, TARGET_R = 5, 2.0, 2.0


def load(path):
    d = json.load(open(path))
    df = pd.DataFrame(d)
    df["date"] = pd.to_datetime(df["date"])
    return df.drop_duplicates("date").set_index("date").sort_index()


def market(hist):
    out = {}
    for s in ("SPY", "QQQ"):
        df = load(os.path.join(hist, s + ".json"))
        c = df["close"]
        out[s + "_above50"] = c > c.rolling(50).mean()
        out[s + "_ret20"] = c / c.shift(20) - 1
        out[s + "_fwd5"] = c.shift(-HOLD) / df["open"].shift(-1) - 1
    return pd.DataFrame(out)


def features(df):
    o, h, l, c, v = (df[k].astype(float) for k in ("open", "high", "low", "close", "volume"))
    f = pd.DataFrame(index=df.index)
    pc = c.shift(1)
    tr = pd.concat([h - l, (h - pc).abs(), (l - pc).abs()], axis=1).max(axis=1)
    atr = tr.rolling(14).mean()
    d = c.diff()
    gain = d.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
    loss = (-d.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean()
    rsi = 100 - 100 / (1 + gain / loss.replace(0, np.nan))
    ma20, ma50, ma200 = c.rolling(20).mean(), c.rolling(50).mean(), c.rolling(200).mean()
    f["breakout_20d"] = c > c.shift(1).rolling(20).max()
    f["bull_flag"] = (c.shift(5) / c.shift(15) - 1 > 0.10) & (c.rolling(5).max() / c.rolling(5).min() - 1 <= 0.05)
    f["reclaim_ma20"] = (pc < ma20.shift(1)) & (c > ma20)
    f["oversold_bounce"] = (rsi.shift(1) < 30) & (c > pc)
    f["above50"], f["above200"], f["ma50_over_200"] = c > ma50, c > ma200, ma50 > ma200
    f["rsi"] = rsi
    f["ret1"] = c / pc - 1
    f["ret20"] = c / c.shift(20) - 1
    f["ret63"] = c / c.shift(63) - 1
    f["off_high"] = c / c.rolling(252).max() - 1
    f["vol_ratio"] = v / v.shift(1).rolling(20).mean()
    f["atr_pct"] = atr / c
    f["gap"] = o / pc - 1
    rng = (h - l).replace(0, np.nan)
    f["close_loc"] = (c - l) / rng
    f["liquid"] = (c >= 5) & (v.rolling(20).mean() >= 1_000_000)
    # the trade
    entry = o.shift(-1).to_numpy()
    risk = (ATR_K * atr).to_numpy()
    stop, target = entry - risk, entry + TARGET_R * risk
    R = np.full(len(df), np.nan)
    open_ = ~np.isnan(entry) & ~np.isnan(risk) & (risk > 0)
    for k in range(1, HOLD + 1):
        ok, hk, lk = (s.shift(-k).to_numpy() for s in (o, h, l))
        valid = ~np.isnan(ok)
        if k > 1:
            m = open_ & valid & (ok <= stop)
            R[m] = (ok[m] - entry[m]) / risk[m]
            open_ &= ~m
        m = open_ & valid & (lk <= stop)
        R[m] = -1.0
        open_ &= ~m
        if k > 1:
            m = open_ & valid & (ok >= target)
            R[m] = (ok[m] - entry[m]) / risk[m]
            open_ &= ~m
        m = open_ & valid & (hk >= target)
        R[m] = TARGET_R
        open_ &= ~m
    ck = c.shift(-HOLD).to_numpy()
    m = open_ & ~np.isnan(ck)
    R[m] = (ck[m] - entry[m]) / risk[m]
    f["R"] = R
    f["fwd5"] = c.shift(-HOLD) / o.shift(-1) - 1
    f["dow"] = df.index.dayofweek
    return f.iloc[252:]  # warm-up for the 52-week high and the 200-day average


def clustered(sub, col):
    """Mean over dates of the per-date mean, and its t-score."""
    if sub.empty:
        return 0, float("nan"), float("nan"), 0
    per_day = sub.groupby(level="date")[col].mean()
    nd = len(per_day)
    m = per_day.mean()
    t = m / (per_day.std(ddof=1) / np.sqrt(nd)) if nd > 2 and per_day.std(ddof=1) > 0 else float("nan")
    return len(sub), m, t, nd


def row(name, mask, data, halves, base):
    out = {"name": name}
    for hname, hmask in halves.items():
        sub = data[mask & hmask]
        n, mR, tR, nd = clustered(sub, "R")
        _, mX, tX, _ = clustered(sub, "excess")
        out[hname] = {"n": int(n), "days": int(nd), "avg_R": round(float(mR), 3) if n else None,
                      "edge_R": round(float(mR - base[hname]), 3) if n else None, "t_R": round(float(tR), 2) if n else None,
                      "excess_pct": round(100 * float(mX), 2) if n else None, "t_excess": round(float(tX), 2) if n else None,
                      "win_pct": round(100 * float((sub["R"] > 0).mean()), 1) if n else None}
    d, v = out["discovery"], out["validation"]
    same = (d["n"] and v["n"] and d["edge_R"] is not None and v["edge_R"] is not None
            and np.sign(d["edge_R"]) == np.sign(v["edge_R"]) and np.sign(d["excess_pct"]) == np.sign(v["excess_pct"]))
    strong = same and abs(v["t_excess"] or 0) >= 2 and abs(d["t_excess"] or 0) >= 2
    out["verdict"] = ("GOOD sign" if strong and v["excess_pct"] > 0 else "BAD sign" if strong else
                      "leans good" if same and v["excess_pct"] > 0 else "leans bad" if same else "no stable signal")
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("history")
    ap.add_argument("--out", default="research/study_results.json")
    a = ap.parse_args(argv)
    mk = market(a.history)
    frames = []
    for p in sorted(glob.glob(os.path.join(a.history, "*.json"))):
        sym = os.path.basename(p)[:-5]
        if sym in ("SPY", "QQQ"):
            continue
        df = load(p)
        if len(df) < 400:
            continue
        f = features(df)
        f["symbol"] = sym
        frames.append(f)
    data = pd.concat(frames)
    data.index.name = "date"
    data = data.join(mk, on="date")
    data["excess"] = data["fwd5"] - data["SPY_fwd5"]
    data = data[data["liquid"] & data["R"].notna() & data["excess"].notna()]
    dates = data.index.unique().sort_values()
    cut = dates[len(dates) // 2]
    halves = {"discovery": data.index < cut, "validation": data.index >= cut}
    base = {h: float(data[m].groupby(level="date")["R"].mean().mean()) for h, m in halves.items()}
    print("Stock-days: %d, stocks: %d, dates %s to %s; split at %s." % (
        len(data), data["symbol"].nunique(), dates[0].date(), dates[-1].date(), cut.date()))
    print("Baseline avg R (every liquid stock-day): discovery %+.3f, validation %+.3f.\n" % (base["discovery"], base["validation"]))
    T = pd.Series(True, index=data.index)
    setups = ["breakout_20d", "bull_flag", "reclaim_ma20", "oversold_bounce"]
    anyset = data[setups].any(axis=1)
    conds = []
    # 1. the setups, alone and with filters
    for s in setups:
        m = data[s]
        conds += [(s, m),
                  (s + " + above 200d", m & data["above200"]), (s + " + below 200d", m & ~data["above200"]),
                  (s + " + SPY above 50d", m & data["SPY_above50"]), (s + " + SPY below 50d", m & ~data["SPY_above50"]),
                  (s + " + volume >= 1.5x", m & (data["vol_ratio"] >= 1.5)), (s + " + volume < 1x", m & (data["vol_ratio"] < 1)),
                  (s + " + closed in top 25% of range", m & (data["close_loc"] >= 0.75)),
                  (s + " + closed in bottom 25%", m & (data["close_loc"] <= 0.25)),
                  (s + " + within 5% of 52w high", m & (data["off_high"] >= -0.05)),
                  (s + " + 25%+ under 52w high", m & (data["off_high"] < -0.25))]
    conds += [("ANY setup", anyset),
              ("QUALITY breakout: 20d breakout + vol>=1.5x + top-25% close + above 200d",
               data["breakout_20d"] & (data["vol_ratio"] >= 1.5) & (data["close_loc"] >= 0.75) & data["above200"]),
              ("QUALITY flag: bull flag + above 50d and 200d + vol < 1x (quiet pause)",
               data["bull_flag"] & data["above50"] & data["above200"] & (data["vol_ratio"] < 1))]
    # 2. single signs on every stock-day
    bucket = lambda col, edges, labels: [("%s %s" % (col, lab), (data[col] >= lo) & (data[col] < hi))
                                         for (lo, hi), lab in zip(edges, labels)]
    conds += bucket("rsi", [(0, 30), (30, 45), (45, 55), (55, 70), (70, 101)], ["<30", "30-45", "45-55", "55-70", ">70"])
    conds += bucket("off_high", [(-9, -0.5), (-0.5, -0.25), (-0.25, -0.10), (-0.10, -0.02), (-0.02, 0.01)],
                    ["< -50%", "-50..-25%", "-25..-10%", "-10..-2%", "within 2% of high"])
    conds += bucket("ret1", [(-9, -0.05), (-0.05, -0.02), (-0.02, 0.02), (0.02, 0.05), (0.05, 9)],
                    ["day < -5%", "-5..-2%", "-2..+2%", "+2..+5%", "day > +5%"])
    conds += bucket("gap", [(-9, -0.03), (-0.03, -0.01), (-0.01, 0.01), (0.01, 0.03), (0.03, 9)],
                    ["gap < -3%", "-3..-1%", "-1..+1%", "+1..+3%", "gap > +3%"])
    conds += bucket("vol_ratio", [(0, 0.7), (0.7, 1.0), (1.0, 1.5), (1.5, 3), (3, 1e9)], ["<0.7x", "0.7-1x", "1-1.5x", "1.5-3x", ">3x"])
    conds += bucket("close_loc", [(0, 0.25), (0.25, 0.75), (0.75, 1.01)], ["bottom 25%", "middle", "top 25%"])
    conds += bucket("atr_pct", [(0, 0.02), (0.02, 0.035), (0.035, 0.06), (0.06, 1)], ["<2%", "2-3.5%", "3.5-6%", ">6%"])
    rs = data["ret63"] - data.groupby(level="date")["ret63"].transform("median")
    data["rs63"] = rs
    conds += bucket("rs63", [(-9, -0.20), (-0.20, -0.05), (-0.05, 0.05), (0.05, 0.20), (0.20, 9)],
                    ["laggard < -20pts", "-20..-5", "-5..+5", "+5..+20", "leader > +20pts"])
    conds += [("trend: above 50d and 200d", data["above50"] & data["above200"]),
              ("trend: below 50d and 200d", ~data["above50"] & ~data["above200"]),
              ("market: SPY above 50d", data["SPY_above50"]), ("market: SPY below 50d", ~data["SPY_above50"]),
              ("market: QQQ below 50d", ~data["QQQ_above50"])]
    conds += [("day: %s" % n, data["dow"] == i) for i, n in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri"])]
    rows = [row(n, m, data, halves, base) for n, m in conds]
    print("%-72s | %-40s | %-40s | %s" % ("sign", "DISCOVERY  n / win / avgR / excess% (t)", "VALIDATION n / win / avgR / excess% (t)", "verdict"))
    for r in rows:
        d, v = r["discovery"], r["validation"]
        fmt = lambda x: "n=%-7d win %4.1f%% R %+.3f ex %+5.2f%% (t %+5.1f)" % (x["n"], x["win_pct"], x["avg_R"], x["excess_pct"], x["t_excess"]) if x["n"] else "n=0"
        print("%-72s | %-40s | %-40s | %s" % (r["name"][:72], fmt(d), fmt(v), r["verdict"]))
    json.dump({"base": base, "split": str(cut.date()), "rows": rows}, open(a.out, "w"), indent=1)
    print("\nWrote %s." % a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
