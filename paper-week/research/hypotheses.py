"""Four strategies from published research, tested on the same 5-year data. Chosen BEFORE looking.

H1  Short pullback in an uptrend (Connors): RSI(2) < 10 and close above its 200-day average.
    Buy the next open, hold 5 days.
H2  Deeper 1-week pullback in an uptrend: 5-day return <= -7% and close above its 200-day average.
    Hold 5 days.
H3  12-1 momentum (Jegadeesh-Titman): the top 10% of stocks by return from 12 months ago to 1 month
    ago, measured each day across the universe. Hold 20 days.
H4  1-week reversal (Lehmann, Jegadeesh): the bottom 10% of stocks by 5-day return. Hold 5 days.

Every result is EXCESS return (stock minus SPY over the same days), date-clustered on NON-OVERLAPPING
holding periods (every 5th or 20th day, averaged over the offsets), split into
discovery (older half) and validation (newer half). Same survivorship-bias warning as study.py,
and it hits H2 and H4 (buying losers) hardest.

    python3 -I research/hypotheses.py HISTORY_DIR
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


def main(argv):
    hist = argv[0]
    spy = study.load(os.path.join(hist, "SPY.json"))
    mk = pd.DataFrame({k: spy["close"].shift(-k) / spy["open"].shift(-1) - 1 for k in (5, 20)})
    mk.columns = ["spy5", "spy20"]
    frames = []
    for p in sorted(glob.glob(os.path.join(hist, "*.json"))):
        sym = os.path.basename(p)[:-5]
        if sym in ("SPY", "QQQ"):
            continue
        df = study.load(p)
        if len(df) < 400:
            continue
        o, c, v = df["open"].astype(float), df["close"].astype(float), df["volume"].astype(float)
        d = c.diff()
        g = d.clip(lower=0).ewm(alpha=1 / 2, adjust=False).mean()
        l = (-d.clip(upper=0)).ewm(alpha=1 / 2, adjust=False).mean()
        f = pd.DataFrame(index=df.index)
        f["rsi2"] = 100 - 100 / (1 + g / l.replace(0, np.nan))
        f["above200"] = c > c.rolling(200).mean()
        f["ret5"] = c / c.shift(5) - 1
        f["mom"] = c.shift(21) / c.shift(252) - 1
        f["fwd5"] = c.shift(-5) / o.shift(-1) - 1
        f["fwd20"] = c.shift(-20) / o.shift(-1) - 1
        f["liquid"] = (c >= 5) & (v.rolling(20).mean() >= 1_000_000)
        f["symbol"] = sym
        frames.append(f.iloc[252:])
    data = pd.concat(frames)
    data.index.name = "date"
    data = data.join(mk, on="date")
    data = data[data["liquid"]]
    data["ex5"] = data["fwd5"] - data["spy5"]
    data["ex20"] = data["fwd20"] - data["spy20"]
    data["mom_rank"] = data.groupby(level="date")["mom"].rank(pct=True)
    data["ret5_rank"] = data.groupby(level="date")["ret5"].rank(pct=True)
    dates = data.index.unique().sort_values()
    cut = dates[len(dates) // 2]
    tests = [
        ("H1 RSI(2) < 10 and above 200-day, 5 days", (data["rsi2"] < 10) & data["above200"], "ex5"),
        ("H2 5-day return <= -7% and above 200-day, 5 days", (data["ret5"] <= -0.07) & data["above200"], "ex5"),
        ("H3 12-1 momentum top 10%, 20 days", data["mom_rank"] >= 0.9, "ex20"),
        ("H3b 12-1 momentum bottom 10%, 20 days (should be bad)", data["mom_rank"] <= 0.1, "ex20"),
        ("H4 worst 10% of the week, 5 days", data["ret5_rank"] <= 0.1, "ex5"),
        ("H4b best 10% of the week, 5 days (should be bad)", data["ret5_rank"] >= 0.9, "ex5"),
    ]
    print("Split at %s. Excess return vs SPY, date-clustered.\n" % cut.date())
    print("%-56s | %-30s | %-30s" % ("strategy", "DISCOVERY avg excess (t, n)", "VALIDATION avg excess (t, n)"))
    for name, m, col in tests:
        out = []
        hold = 20 if col == "ex20" else 5
        for half in (data.index < cut, data.index >= cut):
            sub = data[m & half & data[col].notna()]
            # non-overlapping: only every `hold`-th trading day, so no two holds share days;
            # the t-score averages the `hold` possible offsets' t-scores (each one honest)
            ts, ms = [], []
            for off in range(hold):
                keep = set(dates[off::hold])
                s2 = sub[sub.index.isin(keep)]
                n, mx, tx, nd = study.clustered(s2, col)
                ms.append(mx); ts.append(tx)
            out.append("%+6.2f%% (t %+5.2f, n=%d)" % (100 * np.nanmean(ms), np.nanmean(ts), len(sub)))
        print("%-56s | %-30s | %-30s" % (name, out[0], out[1]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
