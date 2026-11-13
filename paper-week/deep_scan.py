"""Deep pre-market scan for the paper month: every liquid US stock, tested on its own history.

1. Universe: trader/universe.txt (from trader-scanner `scan.py universe`, ~5,900 US stocks).
2. Liquidity: Yahoo spark, 20 symbols a request: last price >= $5 and last session's volume >= 1M.
3. For every liquid stock: 2 years of daily bars. Which daily setups fired on the last COMPLETED
   day (breakout_20d, bull_flag, reclaim_ma20, oversold_bounce, the same rules as trader-scanner),
   and how each setup did on that stock's own history (swing_backtest.py's trade: buy next open,
   stop 2 x ATR14, target 2R, max 5 days) against the stock's baseline (the same trade every day).
4. Context per stock: trend (50/200-day averages), 3-month return vs SPY, distance from the
   52-week high, ATR %, dollar volume. Market regime: SPY and QQQ vs their 50-day averages.
5. Ranks the stocks where a setup fired AND passed the v2 proof (n >= 15, avg R > 0, beats the
   baseline) by a t-score of the setup's average R (mean / (sd / sqrt n)): an edge that is both
   big and seen many times ranks higher than one lucky streak.

    python3 -I deep_scan.py [--workers 6] [--show 25] [--limit N] [--symbols A,B]

Writes trader/deepscan.json. Free, unofficial Yahoo data; polite pauses and retries on 429.
"""
import argparse
import concurrent.futures as cf
import datetime as dt
import json
import math
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
UA = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
HOSTS = ("query2.finance.yahoo.com", "query1.finance.yahoo.com")
SETUPS = ("breakout_20d", "bull_flag", "reclaim_ma20", "oversold_bounce")
HOLD, ATR_K, TARGET_R, MIN_N = 5, 2.0, 2.0, 15


def get(path, tries=4):
    last = None
    for k in range(tries):
        host = HOSTS[k % 2]
        try:
            with urllib.request.urlopen(urllib.request.Request("https://%s%s" % (host, path), headers=UA),
                                        timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429 or e.code >= 500:
                time.sleep(3 * (k + 1))
                continue
            raise
        except Exception as e:  # network blips
            last = e
            time.sleep(1 + k)
    raise last


def spark(symbols):
    path = "/v7/finance/spark?symbols=%s&range=5d&interval=1d" % ",".join(s.replace(".", "-") for s in symbols)
    doc = get(path)
    out = {}
    for item in (doc.get("spark") or {}).get("result") or []:
        resp = (item.get("response") or [{}])[0]
        meta = resp.get("meta") or {}
        out[item.get("symbol", "").replace("-", ".")] = (meta.get("regularMarketPrice"), meta.get("regularMarketVolume"))
    return out


def daily(sym):
    doc = get("/v8/finance/chart/%s?range=2y&interval=1d" % sym.replace(".", "-"))
    res = doc["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    rows = []
    for i, t in enumerate(res.get("timestamp") or []):
        o, h, l, c, v = q["open"][i], q["high"][i], q["low"][i], q["close"][i], q["volume"][i]
        if None in (o, h, l, c):
            continue
        rows.append((dt.datetime.fromtimestamp(t, NY).date(), o, h, l, c, v or 0))
    return rows


def completed(rows, now):
    """Drop today's bar while the session is still open (pre-market runs see only finished days)."""
    if rows and rows[-1][0] == now.date() and now.hour < 16:
        return rows[:-1]
    return rows


def series(rows):
    c = [r[4] for r in rows]
    n = len(rows)
    atr = [None] * n
    for i in range(14, n):
        trs = [max(rows[j][2] - rows[j][3], abs(rows[j][2] - rows[j - 1][4]), abs(rows[j][3] - rows[j - 1][4]))
               for j in range(i - 13, i + 1)]
        atr[i] = sum(trs) / 14
    rsi = [None] * n
    if n > 15:
        g = sum(max(c[j] - c[j - 1], 0) for j in range(1, 15)) / 14
        l = sum(max(c[j - 1] - c[j], 0) for j in range(1, 15)) / 14
        for j in range(15, n):
            d = c[j] - c[j - 1]
            g = (g * 13 + max(d, 0)) / 14
            l = (l * 13 + max(-d, 0)) / 14
            if j >= 42:
                rsi[j] = 100.0 if l == 0 else 100 - 100 / (1 + g / l)
    return c, atr, rsi


def fired(c, rsi, i, setup):
    if i < 25:
        return False
    if setup == "breakout_20d":
        return c[i] > max(c[i - 20:i])
    if setup == "bull_flag":
        last5 = c[i - 4:i + 1]
        return c[i - 5] / c[i - 15] - 1 > 0.10 and max(last5) / min(last5) - 1 <= 0.05
    if setup == "reclaim_ma20":
        return c[i - 1] < sum(c[i - 21:i - 1]) / 20 and c[i] > sum(c[i - 19:i + 1]) / 20
    if setup == "oversold_bounce":
        return rsi[i - 1] is not None and rsi[i - 1] < 30 and c[i] > c[i - 1]
    return False


def trade(rows, atr, i):
    if atr[i] is None or i + HOLD >= len(rows):
        return None
    entry, risk = rows[i + 1][1], ATR_K * atr[i]
    stop, target = entry - risk, entry + TARGET_R * risk
    for j in range(i + 1, i + HOLD + 1):
        o, h, l = rows[j][1], rows[j][2], rows[j][3]
        if j > i + 1 and o <= stop:
            return (o - entry) / risk
        if l <= stop:
            return -1.0
        if j > i + 1 and o >= target:
            return (o - entry) / risk
        if h >= target:
            return TARGET_R
    return (rows[i + HOLD][4] - entry) / risk


def summarize(rs):
    if not rs:
        return {"n": 0}
    m = statistics.mean(rs)
    sd = statistics.pstdev(rs) if len(rs) > 1 else 0
    return {"n": len(rs), "avg_r": round(m, 3), "win_pct": round(100 * sum(r > 0 for r in rs) / len(rs), 1),
            "t": round(m / (sd / math.sqrt(len(rs))), 2) if sd > 0 else 0.0}


def analyze(sym, now, spy_3m):
    rows = completed(daily(sym), now)
    if len(rows) < 260:
        return None
    c, atr, rsi = series(rows)
    last = len(rows) - 1
    base = summarize([r for r in (trade(rows, atr, i) for i in range(25, last)) if r is not None])
    out = {"symbol": sym, "date": rows[last][0].isoformat(), "close": round(c[last], 2), "baseline": base,
           "setups": {}}
    for s in SETUPS:
        if not fired(c, rsi, last, s):
            continue
        st = summarize([r for r in (trade(rows, atr, i) for i in range(25, last) if fired(c, rsi, i, s)) if r is not None])
        st["edge"] = round(st.get("avg_r", 0) - base.get("avg_r", 0), 3) if st["n"] else None
        st["passes"] = bool(st["n"] >= MIN_N and st["avg_r"] > 0 and st["edge"] > 0)
        out["setups"][s] = st
    ma50 = sum(c[last - 49:last + 1]) / 50
    ma200 = sum(c[last - 199:last + 1]) / 200
    hi52 = max(c[last - 251:last + 1])
    r3m = c[last] / c[last - 63] - 1
    dvol = statistics.mean(r[4] * r[5] for r in rows[last - 19:last + 1])
    out["context"] = {"above_ma50": c[last] > ma50, "above_ma200": c[last] > ma200,
                      "ret_3m_pct": round(100 * r3m, 1), "vs_spy_3m_pct": round(100 * (r3m - spy_3m), 1) if spy_3m is not None else None,
                      "off_52w_high_pct": round(100 * (c[last] / hi52 - 1), 1),
                      "atr_pct": round(100 * atr[last] / c[last], 2), "dollar_vol_m": round(dvol / 1e6, 1),
                      "rsi": round(rsi[last], 1) if rsi[last] else None}
    a = atr[last]
    out["plan"] = {"entry_ref": round(c[last], 2), "stop": math.floor((c[last] - ATR_K * a) * 100) / 100,
                   "target": round(c[last] + TARGET_R * ATR_K * a, 2), "risk_per_share": round(ATR_K * a, 2),
                   "shares_at_100_risk": int(100 // (ATR_K * a)) if a else 0}
    return out


def regime(now):
    out = {}
    for s in ("SPY", "QQQ"):
        rows = completed(daily(s), now)
        c = [r[4] for r in rows]
        ma50 = sum(c[-50:]) / 50
        out[s] = {"close": round(c[-1], 2), "above_ma50": c[-1] > ma50, "ret_1m_pct": round(100 * (c[-1] / c[-22] - 1), 1),
                  "ret_3m": c[-1] / c[-64] - 1}
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--show", type=int, default=25)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--symbols")
    ap.add_argument("--universe", default="trader/universe.txt")
    ap.add_argument("--out", default="trader/deepscan.json")
    a = ap.parse_args(argv)
    now = dt.datetime.now(NY)
    t0 = time.time()
    if a.symbols:
        symbols = [s.strip().upper() for s in a.symbols.split(",") if s.strip()]
        liquid = symbols
    else:
        if not os.path.isfile(a.universe):
            print("No %s: run trader-scanner `scan.py universe` first." % a.universe)
            return 1
        symbols = [ln.split("|")[0] for ln in open(a.universe, encoding="utf-8") if ln.strip()]
        if a.limit:
            symbols = symbols[:a.limit]
        batches = [symbols[i:i + 20] for i in range(0, len(symbols), 20)]
        meta = {}
        with cf.ThreadPoolExecutor(a.workers) as ex:
            for got in ex.map(lambda b: (time.sleep(0.2), spark(b))[1], batches):
                meta.update(got)
        liquid = [s for s in symbols if (meta.get(s) or (None, None))[0] and meta[s][0] >= 5 and (meta[s][1] or 0) >= 1_000_000]
        print("Universe %d stocks; %d answered; %d liquid ($5+, 1M+ shares) in %.0fs." % (
            len(symbols), len(meta), len(liquid), time.time() - t0), flush=True)
    reg = regime(now)
    spy_3m = reg["SPY"]["ret_3m"]
    results, failed = [], []

    def work(sym):
        time.sleep(0.15)
        try:
            return analyze(sym, now, spy_3m)
        except Exception as e:
            failed.append("%s: %s" % (sym, str(e)[:60]))
            return None

    with cf.ThreadPoolExecutor(a.workers) as ex:
        for k, r in enumerate(ex.map(work, liquid), 1):
            if r:
                results.append(r)
            if k % 200 == 0:
                print("  analyzed %d of %d" % (k, len(liquid)), flush=True)
    picks = []
    for r in results:
        for s, st in r["setups"].items():
            if st.get("passes"):
                picks.append((st["t"], st["edge"], r, s, st))
    picks.sort(key=lambda p: (-p[0], -p[1]))
    fired_any = sum(1 for r in results if r["setups"])
    print("Market: SPY %.2f (%s 50-day avg, 1m %+.1f%%), QQQ %.2f (%s 50-day avg, 1m %+.1f%%)." % (
        reg["SPY"]["close"], "above" if reg["SPY"]["above_ma50"] else "BELOW", reg["SPY"]["ret_1m_pct"],
        reg["QQQ"]["close"], "above" if reg["QQQ"]["above_ma50"] else "BELOW", reg["QQQ"]["ret_1m_pct"]))
    print("Analyzed %d stocks (%d failed) in %.0fs. A setup fired on %d; %d setups pass the proof (n>=%d, avg R>0, beats baseline)." % (
        len(results), len(failed), time.time() - t0, fired_any, len(picks), MIN_N))
    print("Ranked by t-score (how sure the edge is), then edge:")
    for t, edge, r, s, st in picks[:a.show]:
        cx, p = r["context"], r["plan"]
        print("  %-6s %-15s n=%-3d win %5.1f%% avgR %+.3f edge %+.3f t %5.2f | close %8.2f %s%s 3m %+5.1f%% vsSPY %+5.1f%% off-high %+5.1f%% ATR %.1f%% $vol %.0fM | stop %.2f shares %d" % (
            r["symbol"], s, st["n"], st["win_pct"], st["avg_r"], edge, t, r["close"],
            "↑50" if cx["above_ma50"] else "↓50", " ↑200" if cx["above_ma200"] else " ↓200", cx["ret_3m_pct"],
            cx["vs_spy_3m_pct"] or 0, cx["off_52w_high_pct"], cx["atr_pct"], cx["dollar_vol_m"], p["stop"], p["shares_at_100_risk"]))
    json.dump({"as_of": now.isoformat(), "regime": reg, "analyzed": len(results), "failed": failed[:50],
               "picks": [{"symbol": r["symbol"], "setup": s, **st, "close": r["close"], "context": r["context"], "plan": r["plan"]}
                         for t, e, r, s, st in picks],
               "all": results}, open(a.out, "w"), default=str)
    print("Wrote %s." % a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
