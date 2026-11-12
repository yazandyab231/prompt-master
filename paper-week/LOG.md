# Trade log: $5,000 pretend account

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
| trig_016bKygZ9PTh3aiexwEtUHXR | once, Thu 2026-11-19 16:12, final report |
