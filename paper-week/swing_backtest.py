"""Swing-trade check on real daily history (paper week, v2 rules).

For one stock, finds every day in the last 2 years where a daily-chart setup
fired (the same rules trader-scanner's daily scan uses), then replays the
trade: buy at the next day's open, stop 2 x ATR(14) below, target 2R above,
sell at the stop, the target, or the close of day 5, whichever comes first.
A gap through the stop or the target fills at the open. A day that touches
both counts as the stop.

It compares that with a baseline: the same trade entered on EVERY day, so a
setup only counts as an edge if it beats just buying the stock at random.

    python3 swing_backtest.py SYMBOL [--setup breakout_20d|bull_flag|reclaim_ma20|oversold_bounce|any] [--json]

Also prints today's plan: entry (last close), stop, target, and whether the
setup fired on the last completed day.
"""
import argparse
import json
import math
import statistics
import sys
import urllib.request

SETUPS = ("breakout_20d", "bull_flag", "reclaim_ma20", "oversold_bounce")
HOLD = 5
ATR_K = 2.0
TARGET_R = 2.0


def daily(sym, rng="2y"):
    url = "https://query2.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=1d" % (sym, rng)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    rows = []
    for i, t in enumerate(res.get("timestamp") or []):
        o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        if None in (o, h, l, c):
            continue
        rows.append((t, o, h, l, c))
    return rows, res["meta"]


def atr(rows, i, n=14):
    if i < n:
        return None
    trs = []
    for j in range(i - n + 1, i + 1):
        h, l, pc = rows[j][2], rows[j][3], rows[j - 1][4]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    return sum(trs) / n


def rsi(closes, i, n=14):
    if i < n * 3:
        return None
    gains = losses = 0.0
    for j in range(1, n + 1):  # seed
        d = closes[j] - closes[j - 1]
        gains += max(d, 0)
        losses += max(-d, 0)
    ag, al = gains / n, losses / n
    for j in range(n + 1, i + 1):  # Wilder smoothing
        d = closes[j] - closes[j - 1]
        ag = (ag * (n - 1) + max(d, 0)) / n
        al = (al * (n - 1) + max(-d, 0)) / n
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)


def fired(rows, i, setup, rsis):
    c = [r[4] for r in rows]
    if i < 25:
        return False
    if setup == "breakout_20d":
        return c[i] > max(c[i - 20:i])
    if setup == "bull_flag":
        up = c[i - 5] / c[i - 15] - 1
        last5 = c[i - 4:i + 1]
        return up > 0.10 and max(last5) / min(last5) - 1 <= 0.05
    if setup == "reclaim_ma20":
        ma_prev = sum(c[i - 21:i - 1]) / 20
        ma_now = sum(c[i - 19:i + 1]) / 20
        return c[i - 1] < ma_prev and c[i] > ma_now
    if setup == "oversold_bounce":
        return rsis[i - 1] is not None and rsis[i - 1] < 30 and c[i] > c[i - 1]
    return False


def trade(rows, i):
    """Signal at the close of day i: buy day i+1's open. Returns R or None."""
    a = atr(rows, i)
    if a is None or i + 1 >= len(rows):
        return None
    entry = rows[i + 1][1]
    risk = ATR_K * a
    stop, target = entry - risk, entry + TARGET_R * risk
    last = min(i + HOLD, len(rows) - 1)
    if last < i + HOLD:
        return None  # not enough days left to finish the trade
    for j in range(i + 1, last + 1):
        o, h, l, c = rows[j][1:5]
        if j > i + 1 and o <= stop:
            return (o - entry) / risk
        if l <= stop:
            return -1.0
        if j > i + 1 and o >= target:
            return (o - entry) / risk
        if h >= target:
            return TARGET_R
    return (rows[last][4] - entry) / risk


def stats(rs):
    if not rs:
        return {"n": 0}
    wins = sum(1 for r in rs if r > 0)
    return {"n": len(rs), "win_pct": round(100 * wins / len(rs), 1),
            "avg_r": round(statistics.mean(rs), 3), "median_r": round(statistics.median(rs), 3),
            "target_pct": round(100 * sum(1 for r in rs if r >= TARGET_R - 1e-9) / len(rs), 1),
            "stop_pct": round(100 * sum(1 for r in rs if r <= -1 + 1e-9) / len(rs), 1)}


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("symbol")
    ap.add_argument("--setup", default="any", choices=SETUPS + ("any",))
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    sym = a.symbol.upper().replace(".", "-")
    rows, meta = daily(sym)
    closes = [r[4] for r in rows]
    rsis = [rsi(closes, i) for i in range(len(rows))]
    setups = SETUPS if a.setup == "any" else (a.setup,)
    out = {"symbol": sym, "days": len(rows), "hold_days": HOLD, "stop": "2 x ATR(14)", "target": "2R", "setups": {}}
    base = [r for r in (trade(rows, i) for i in range(25, len(rows))) if r is not None]
    out["baseline"] = stats(base)
    last = len(rows) - 1
    for s in setups:
        rs = [r for r in (trade(rows, i) for i in range(25, len(rows)) if fired(rows, i, s, rsis)) if r is not None]
        st = stats(rs)
        st["fired_last_day"] = fired(rows, last, s, rsis)
        st["edge_vs_baseline"] = round(st.get("avg_r", 0) - out["baseline"].get("avg_r", 0), 3) if rs else None
        out["setups"][s] = st
    a14 = atr(rows, last)
    entry = closes[last]
    out["plan_from_last_close"] = {"last_close": round(entry, 2), "atr14": round(a14, 2),
                                   "stop": math.floor((entry - ATR_K * a14) * 100) / 100,
                                   "target": round(entry + TARGET_R * ATR_K * a14, 2),
                                   "risk_per_share": round(ATR_K * a14, 2)}
    if a.json:
        print(json.dumps(out, indent=1))
        return 0
    b = out["baseline"]
    print("%s: %d daily bars (2y). Trade: buy next open, stop 2xATR14, target 2R, max %d days." % (sym, len(rows), HOLD))
    print("  baseline (every day)  n=%d  win %.1f%%  avg R %+.3f" % (b["n"], b["win_pct"], b["avg_r"]))
    for s, st in out["setups"].items():
        if not st.get("n"):
            print("  %-15s       never fired" % s)
            continue
        print("  %-15s %s n=%-3d win %5.1f%%  target %5.1f%%  stop %5.1f%%  avg R %+.3f  edge %+.3f%s" % (
            s, "*" if st["fired_last_day"] else " ", st["n"], st["win_pct"], st["target_pct"], st["stop_pct"],
            st["avg_r"], st["edge_vs_baseline"], "   <- fired on the last day" if st["fired_last_day"] else ""))
    p = out["plan_from_last_close"]
    print("  plan from last close %.2f: stop %.2f, target %.2f, risk %.2f a share" % (
        p["last_close"], p["stop"], p["target"], p["risk_per_share"]))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:
        print("ERROR %s" % e)
        sys.exit(2)
