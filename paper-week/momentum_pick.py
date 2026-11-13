"""Rules v3 stock picker: 12-1 momentum, the one strategy that beat SPY in both halves of the 5-year study.

Ranks every liquid stock in trader/deepscan.json by its return from 12 months ago to 1 month ago
(skipping the last month, as in the research), keeps the top 10%, then filters:
  * still above its 50-day average (trend intact)
  * ATR >= 1% of the price (a stock that barely moves is usually pinned by a merger)
  * one share costs no more than --max-price (whole shares in a ~$750 slot)
and lists the strongest first. Data: Yahoo daily bars, 2 years each.

    python3 -I momentum_pick.py [--show 20] [--max-price 750] [--workers 6]

Writes trader/momentum.json.
"""
import argparse
import concurrent.futures as cf
import datetime as dt
import importlib.util
import json
import os
import sys
import time

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("deep_scan", os.path.join(here, "deep_scan.py"))
ds = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ds)


def score(sym, now):
    time.sleep(0.15)
    rows = ds.completed(ds.daily(sym), now)
    if len(rows) < 260:
        return None
    c, atr, _ = ds.series(rows)
    last = len(rows) - 1
    vol20 = sum(r[5] for r in rows[-20:]) / 20
    return {"symbol": sym, "close": round(c[last], 2), "mom_12_1": c[last - 21] / c[last - 252] - 1,
            "ret_1m": c[last] / c[last - 21] - 1, "above50": c[last] > sum(c[last - 49:last + 1]) / 50,
            "above200": c[last] > sum(c[last - 199:last + 1]) / 200, "atr_pct": atr[last] / c[last],
            "dollar_vol_m": c[last] * vol20 / 1e6, "date": rows[last][0].isoformat()}


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", type=int, default=20)
    ap.add_argument("--max-price", type=float, default=750)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--deepscan", default="trader/deepscan.json")
    ap.add_argument("--out", default="trader/momentum.json")
    a = ap.parse_args(argv)
    now = dt.datetime.now(ds.NY)
    syms = [r["symbol"] for r in json.load(open(a.deepscan))["all"]]
    res, failed = [], 0
    with cf.ThreadPoolExecutor(a.workers) as ex:
        for r in ex.map(lambda s: (lambda: score(s, now))() if True else None, syms):
            if r:
                res.append(r)
    res.sort(key=lambda r: -r["mom_12_1"])
    top = res[:max(1, len(res) // 10)]
    picks = [r for r in top if r["above50"] and r["atr_pct"] >= 0.01 and r["close"] <= a.max_price]
    print("Ranked %d liquid stocks by 12-1 momentum; top 10%% = %d; %d pass the filters (above 50-day, ATR >= 1%%, price <= $%.0f)." % (
        len(res), len(top), len(picks), a.max_price))
    for i, r in enumerate(picks[:a.show], 1):
        print("  %2d. %-6s 12-1 mom %+7.1f%%  last month %+6.1f%%  close %8.2f  %s  ATR %.1f%%  $vol %.0fM" % (
            i, r["symbol"], 100 * r["mom_12_1"], 100 * r["ret_1m"], r["close"], "↑200" if r["above200"] else "↓200",
            100 * r["atr_pct"], r["dollar_vol_m"]))
    json.dump({"as_of": now.isoformat(), "ranked": len(res), "top_decile": len(top), "picks": picks}, open(a.out, "w"), default=str)
    print("Wrote %s." % a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
