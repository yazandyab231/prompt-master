# What is a good sign and what is a bad sign? (study of 2026-11-13)

Data: 5 years of daily bars for the 1,344 stocks that were liquid on 2026-11-12 (price >= $5, 1M+ shares a
day), plus SPY. After a 1-year warm-up: 966,040 stock-days on 1,293 stocks, 2022-11-15 to 2026-11-05.
Every sign was measured in two halves, discovery (to 2024-11) and validation (after), as the 5-day return
after the next open MINUS SPY's ("excess"), with all stocks on one day counted as one observation.

Known bias: only today's survivors are in the data, so companies that collapsed are missing. That flatters
"buy the beaten-down stock" signs most.

Reproduce: `python3 -I research/fetch_history.py DIR`, then `study.py DIR`, `selection_test.py DIR`,
`hypotheses.py DIR`.

## 1. The chart setups have no edge

| setup | discovery excess | validation excess |
|---|---|---|
| 20-day closing-high breakout | -0.07% | -0.02% |
| bull flag | +0.02% | +0.01% |
| reclaimed the 20-day average | -0.18% | +0.02% |
| oversold bounce (RSI under 30, up day) | +0.05% | -0.07% |
| "quality" breakout (volume 1.5x, top-25% close, above 200-day) | +0.03% | +0.12% (t 0.5) |

No filter (trend, market regime, volume, where it closed, distance from the high) turned any of them into
a stable edge. The only sign stable in both halves was low volatility (ATR under 2%) lagging SPY, which is
mostly lower beta in a rising market, not a tradable insight.

## 2. The per-stock "proof" did not predict anything

For 202,499 setup events, the proof was recomputed from that stock's earlier events only:

| group | avg R next | excess next |
|---|---|---|
| passed the proof (n >= 15, avg > 0, beats baseline, t >= 2) | +0.031 | +0.08% (t 0.9) |
| passed with t >= 3 | +0.007 | +0.04% |
| failed the proof | +0.036 | -0.02% |
| history clearly negative (t <= -2) | +0.041 | -0.01% |

A stock whose setup "worked" before was no better a bet afterwards. High past win rates on 16 to 85 events
were mostly luck. Rules v2 (built on this proof) was retired.

## 3. Four published strategies, chosen before looking

Non-overlapping holding periods (honest t-scores):

| strategy | discovery | validation |
|---|---|---|
| RSI(2) < 10 in an uptrend, 5 days | -0.08% (t -0.4) | +0.06% (t 0.3) |
| 5-day drop >= 7% in an uptrend, 5 days | +0.14% (t 0.3) | +0.45% (t 1.0) |
| **12-1 momentum, top 10%, 20 days** | **+0.60% (t 0.7)** | **+1.52% (t 1.0)** |
| 12-1 momentum, bottom 10%, 20 days | +0.25% | +0.47% |
| worst 10% of the week, 5 days | +0.02% | +0.42% (t 1.5) |

Momentum was the only one positive in both halves, and the strongest stocks beat the weakest in both. That
matches decades of published research, but 4 years is not enough to prove it here. Rules v3 uses it.

## Practical takeaways

- Treat chart patterns as descriptions, not predictions. Treat a backtest on one stock with fewer than about
  100 events as noise.
- Judge any strategy against simply holding SPY over the same period.
- One month of results is mostly luck whatever the strategy. A real test needs many months.
