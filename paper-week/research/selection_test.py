"""Does the paper month's stock-picking proof actually predict anything?

deep_scan.py buys a setup when that stock's OWN past instances of the setup averaged a positive R,
beat the stock's baseline, n >= 15 and t >= 2. If that proof has real predictive power, setup events
that passed it (using only the history BEFORE each event) should do better afterwards than events
that failed it. If they do the same, the per-stock proof is picking lucky streaks.

For every setup event, the proof is recomputed from that stock's earlier events of the same setup
(expanding window, no look-ahead). Results are date-clustered.

    python3 -I research/selection_test.py HISTORY_DIR
"""
import glob
import importlib.util
import os
import sys

import numpy as np
import pandas as pd

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("study", os.path.join(here, "study.py"))
study = importlib.util.module_from_spec(spec)
spec.loader.exec_module(study)

SETUPS = ["breakout_20d", "bull_flag", "reclaim_ma20", "oversold_bounce"]


def prior_stats(f, setup):
    """For each day: stats of the setup's PREVIOUS events on this stock, and the stock's prior baseline."""
    R = f["R"].to_numpy()
    ev = f[setup].to_numpy() & ~np.isnan(R)
    # an event's R is only known HOLD days later: shift what counts as "history" by HOLD+1 days
    lag = study.HOLD + 1
    r_ev = np.where(ev, R, 0.0)
    n = np.concatenate([[0] * lag, np.cumsum(ev)[:-lag]]) if len(R) > lag else np.zeros(len(R))
    s1 = np.concatenate([[0.0] * lag, np.cumsum(r_ev)[:-lag]]) if len(R) > lag else np.zeros(len(R))
    s2 = np.concatenate([[0.0] * lag, np.cumsum(r_ev ** 2)[:-lag]]) if len(R) > lag else np.zeros(len(R))
    rb = np.where(np.isnan(R), 0.0, R)
    nb = np.concatenate([[0] * lag, np.cumsum(~np.isnan(R))[:-lag]])
    sb = np.concatenate([[0.0] * lag, np.cumsum(rb)[:-lag]])
    with np.errstate(divide="ignore", invalid="ignore"):
        mean = s1 / n
        sd = np.sqrt(np.maximum(s2 / n - mean ** 2, 0))
        t = mean / (sd / np.sqrt(n))
        base = sb / nb
    return n, mean, t, mean - base


def main(argv):
    hist = argv[0]
    mk = study.market(hist)
    rows = []
    for p in sorted(glob.glob(os.path.join(hist, "*.json"))):
        sym = os.path.basename(p)[:-5]
        if sym in ("SPY", "QQQ"):
            continue
        df = study.load(p)
        if len(df) < 600:
            continue
        f = study.features(df)
        for s in SETUPS:
            n, mean, t, edge = prior_stats(f, s)
            m = f[s].to_numpy() & f["liquid"].to_numpy() & ~np.isnan(f["R"].to_numpy())
            if not m.any():
                continue
            rows.append(pd.DataFrame({"date": f.index[m], "symbol": sym, "setup": s, "R": f["R"].to_numpy()[m],
                                      "fwd5": f["fwd5"].to_numpy()[m], "prior_n": n[m], "prior_avg": mean[m],
                                      "prior_t": t[m], "prior_edge": edge[m]}))
    ev = pd.concat(rows)
    ev = ev.join(mk[["SPY_fwd5"]], on="date")
    ev["excess"] = ev["fwd5"] - ev["SPY_fwd5"]
    ev = ev[ev["excess"].notna() & (ev["date"] >= pd.Timestamp("2023-11-01"))]  # need ~1 year of prior events
    ev = ev.set_index("date")
    passed = (ev["prior_n"] >= 15) & (ev["prior_avg"] > 0) & (ev["prior_edge"] > 0) & (ev["prior_t"] >= 2)
    groups = {
        "PASSED the proof (n>=15, avg>0, beats baseline, t>=2)": passed,
        "passed with t >= 3": passed & (ev["prior_t"] >= 3),
        "FAILED the proof (n>=15 but not passing)": (ev["prior_n"] >= 15) & ~passed,
        "past avg R clearly NEGATIVE (t <= -2)": (ev["prior_n"] >= 15) & (ev["prior_t"] <= -2),
        "all setup events (n>=15 history)": ev["prior_n"] >= 15,
    }
    print("Setup events from 2023-11 to 2026-11 with the proof computed from earlier events only: %d\n" % len(ev))
    print("%-58s | %8s %6s | %-8s %-7s | %-9s %-7s" % ("group", "events", "days", "avg R", "t", "excess", "t"))
    for name, m in groups.items():
        sub = ev[m]
        n, mR, tR, nd = study.clustered(sub, "R")
        _, mX, tX, _ = study.clustered(sub, "excess")
        print("%-58s | %8d %6d | %+.3f  %+5.2f  | %+6.2f%%  %+5.2f" % (name, n, nd, mR, tR, 100 * mX, tX))
    print("\nBy setup, PASSED vs FAILED (avg excess 5-day return):")
    for s in SETUPS:
        a = ev[passed & (ev["setup"] == s)]
        b = ev[(ev["prior_n"] >= 15) & ~passed & (ev["setup"] == s)]
        _, ma, ta, _ = study.clustered(a, "excess")
        _, mb, tb, _ = study.clustered(b, "excess")
        print("  %-16s passed n=%-6d %+5.2f%% (t %+4.1f) | failed n=%-6d %+5.2f%% (t %+4.1f)" % (s, len(a), 100 * ma, ta, len(b), 100 * mb, tb))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
