# Trade log: $5,000 pretend account (one month, to Fri 2026-12-11)

Start: $5,000.00 cash on Thu 2026-11-12. Prices are free, delayed Yahoo quotes.

| # | date | stock | shares | buy | stop | target | sell | result | why |
|---|------|-------|--------|-----|------|--------|------|--------|-----|
| 1 | 11-12 | JNJ | 13 | 286.01 @ 12:30 | 283.74 | 290.46 | 283.74 @ 13:40 (stop) | -$29.51 | fresh 15-min opening-range breakout at 12:20; time machine avg R +0.14 (sim) / +0.17 (31 real past fires) |

## Thu 2026-11-12

- 12:24 ORB scan, 5,928 stocks: 139 broke their opening range, almost all at 9:50 to 11:50 (stale by 12:30).
  Fresh: JNJ 12:20, MRK 12:10 (MRK already slipped back under its trigger).
- JNJ news: +2.0% on the day; company items only (device investments), no halt, lawsuit or surprise.
- JNJ plan: entry 285.98, stop 283.74 (range midpoint), target 290.46 (2R), risk 2.24/share.
  Time machine to 15:55: target first 1.3%, stop first 11.9%, neither 86.8%, green 57.1%, avg R +0.137.
  History 31 fires: 6 target, 13 stop, 12 neither, avg R +0.167. Verdict leans to the stop among the
  replays that hit a side; most replays hit neither. Both averages positive → taken under the rule.
- Size 13 shares (position cap binds), risk check PASS, max loss $29.12 at plan, $29.51 at the fill.
- Bought 13 JNJ at 286.01 (12:30). Cash $1,281.87.
- Today: 1 of 3 entries, $29.51 of $150 max loss used.
- 12:47 check: JNJ open, last 285.05 (-$12.48 unrealized); stop and target not touched. Holding; no new entry (one position at a time).
- 13:17 check: JNJ open, last 284.49 (-$19.76 unrealized); stop 283.74 not touched. Holding.
- 13:47 check: JNJ's 13:40 bar touched the stop → sold 13 at 283.74. Loss -$29.51 (the planned max loss). Cash $4,970.49.
- 13:48 ORB rescan: 145 breakouts, freshest ADBE at 13:40, but by 13:53 it closed back under its level (239.97 < 240.00): failed breakout, no trade.
- Today so far: 1 of 3 entries, $29.51 of $150 max loss used. Result -$29.51.
- 14:17 ORB rescan: 143 breakouts, newest still ADBE at 13:40 (already failed). No fresh breakout since → no trade.
- 14:47 ORB rescan: 139 breakouts, nothing new since 13:40 → no trade.
- 15:18 ORB rescan: fresh UNH breakout at 15:15 (405.89 over 405.72). News: routine (board appointment, valuation pieces).
  Plan at 405.92: stop 402.85, target 412.06 (2R). Time machine to 15:55: target 0.0%, stop 4.8%, neither 95.2%, avg R +0.008;
  history 31 fires: 4 target, 18 stop, 9 neither, avg R -0.354 → history negative → NO TRADE (rule: both averages > 0).

**Day 1 summary (Thu 11-12):** 1 trade, 0 wins, 1 loss. Result -$29.51. Cash $4,970.49 (-0.59% vs $5,000).
- What happened: started at 12:23, after the morning breakouts (most fired 9:50 to 10:00). Took JNJ's fresh 12:20
  breakout; its 13:40 bar hit the stop. Loss = exactly the planned max loss, so sizing and the stop worked.
  JNJ at 15:34 is 284.88, still under the 286.01 entry: holding would have lost ~$15 instead of $29.51.
- Skipped: ADBE (breakout failed before entry), UNH (history of this setup on UNH is negative, avg R -0.354).
- Fix: the 'after opening range' check moved from 09:48 to 09:52 (the first breakout bar closes at 09:50,
  so 09:48 could never see one). The morning breakouts are the strategy's main window.
- Lesson: a JNJ history of 6 targets vs 13 stops (avg R +0.17) was only barely positive. Positive average R from
  a few big winners still means most single trades lose. Rule kept as approved; watch whether it holds up.
- 15:51 flat-by-close check: no open position, nothing to sell. Day 1 final: cash $4,970.49, -$29.51.

**Rules v2 from Fri 11-13** (owner: "hold stocks if you want, any rule, just make money"): swing trades up to 5 days,
proven on 2 years of each stock's own daily bars against a buy-every-day baseline; $100 risk a trade, max 3 positions.
See README. Day trades keep the v1 rules.

**Preview for Fri 11-13** (daily scan after Thursday's close, 203 setups; top 16 by trading value backtested):
- PASS APP bull_flag n=16 win 81% avg R +0.79 (baseline +0.07): plan from 393.68, stop 343.39, risk 50.29 → 1 share. Small sample.
- PASS AMD breakout_20d n=85 win 60% avg R +0.44 (baseline +0.17): from 585.30, stop 496.07, risk 89.22 → 1 share.
- PASS COST breakout_20d n=61 win 53% avg R +0.14 (baseline +0.04): from 1,092.21, stop 1,049.23, risk 42.97 → 2 shares.
- Marginal: XEL edge +0.016 (too small to matter). Failed (no edge over baseline): ABT (n=11), PGR, JNJ, LOW, AVGO,
  FISV, CEG, BRK.B, CVS, ANET, VRT; MCD's bull flag did not fire under the backtest's rule.
- Wide 2xATR stops at $100 risk mean small positions (1 to 2 shares). The 08:44 run redoes this with news before buying.

**Test extended to one month** (owner, 11-12 evening): ends at the close on Fri 2026-12-11, weekly report every
Friday from 11-20. NVDA put on watch (CEO resigned 11-12, earnings due): no entry before earnings; see README.
TTWO put on watch (owner's idea, GTA VI launches 11-19): buy only on a setup that passes the v2 proof; see README.

**Deep scan for Fri 11-13** (run 02:00 NY on Thursday's closes; owner asked to cover thousands of stocks every morning):
- Market: SPY 757.12 and QQQ 688.17 both BELOW their 50-day averages (QQQ -5.6% in a month): weak tape, stricter rules.
- 1,342 liquid stocks analyzed in 164 s; a setup fired on 162; 44 passed the v2 proof.
- BUY at 09:52 if within 2% of the last close: **PCOR** bull_flag (n=24, win 75%, avg R +0.56, edge +0.55, t 3.29;
  close 77.23, stop 70.89, 15 shares), **AMD** breakout_20d (n=85, avg R +0.44, edge +0.26, t 3.13; close 585.30,
  stop 496.07, 1 share; +5.9% on 11-12), **LTH** bull_flag (n=31, win 74%, avg R +0.21, edge +0.13, t 2.90; close 45.54,
  stop 41.19, 22 shares).
- Alternates: **YOU** bull_flag (t 2.72, edge +0.26, close 56.79, stop 50.01, 14 shares), then VIRT, PTRN.
- Dropped: CART (pending merger with DoorDash: trades on the deal, not the chart), APP and TTI and LVS (below their
  200-day average in a weak market), OGN (ATR 0.3%: price pinned, likely a deal), LQDA/ATI/CAH (edge under +0.10),
  COST (t 1.27, too little evidence). News on PCOR, LTH, YOU: nothing material in 96 h.

## Scheduled check-ins

All New York time, Monday to Friday, into this chat. Delete all of them after the final report.

| id | when |
|----|------|
| trig_01SE34e59CYoFJFeQxuKh7BP | 08:44 pre-market review |
| trig_01QYVfcb4TDatGu1VypE2b5T | 09:52 after the opening range (was 09:48) |
| trig_01H8KZFjBq7iD5vyJDZA6guv | 10:17 to 15:17 hourly, intraday |
| trig_01CXu5vwBQK46E25FzWHKwRs | 10:47 to 14:47 hourly, intraday |
| trig_01Mm6LMTrhLm856n8whte46a | 15:33 pre-close review |
| trig_01SvFUKhs3mbZtaaL6vDwfrw | 15:51 flat by close |
| trig_016bKygZ9PTh3aiexwEtUHXR | once, Fri 2026-12-11 16:12, final report (was Thu 11-19) |
| trig_01VsikGPHoRDWNsykG3BnLWj | Fridays 16:21, weekly report (from 11-20) |
| trig_011HsZPUjU6nUx4agGiXkq2o | once, Fri 2026-12-11 18:07 Riyadh (10:07 NY): reminder to the owner in a new chat, with a phone push |
