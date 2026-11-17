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

**Overnight research (11-13, 02:00 to 03:30 NY) → rules v3.** Full write-up: research/FINDINGS.md.
- 5-year study of 1,293 stocks (~966k stock-days): none of the chart setups beat SPY in both halves.
- The v2 per-stock proof did not predict anything (passed +0.08% vs failed -0.02%, both noise). v2 retired;
  the PCOR / AMD / LTH plan above is CANCELLED.
- Of four published strategies, only 12-1 momentum beat SPY in both halves (+0.60% / +1.52% a month).
- **v3 plan for Fri 11-13 09:52** (6 equal slots of ~$745, whole shares, hold to 12-11, -20% disaster stop):
  MRNA 3 sh (Moderna, biotech, 12-1 mom +757%, close 231.35), ERAS 47 sh (Erasca, biotech, +523%, 15.78),
  ECO 8 sh (Okeanis Eco Tankers, shipping, +171%, 87.67), VSXY 7 sh (Victoria's Secret, retail, +153%, 104.63),
  AMD 1 sh (chips, +140%, 585.30), RXO 26 sh (trucking, +136%, 28.30). Alternates: GEO, SN, CNC.
  Skipped: FOSL and EVC (under $50M a day), ETON / ORKA / TNGX / AMLX (a third biotech).
  News: MRNA raised its 2026 revenue outlook and targets a 2027 cancer-therapy launch (11-12); nothing material
  found for the others. VSXY usually reports quarterly results in early December, inside the hold.
- **Benchmark:** $5,000 in SPY at the 11-12 close = 6.6040 shares at 757.12.
- Crash guard added (owner asked for the fix): SPY below its 200-day average → sell the 3 worst, hold cash; back above
  2 days in a row → refill. SPY 757.12 vs 200-day 731.62 on 11-12 (guard not active).

## Fri 2026-11-13

- 08:44 pre-market check left no trace (the scheduled run did not reach this chat); news check done at 10:00 instead.
- News before buying: AMD -8% and ERAS -6% this morning. AMD falls with the whole chip sector after Nvidia's CEO
  exit (no company-specific event); ERAS has no news (volatile small biotech); MRNA issued a cost outlook (-0.3%).
  No merger, halt or legal shock → all six bought under v3.
- **Bought 10:00 (v3 momentum portfolio), stop = entry x 0.80, hold to 12-11:**

| stock | shares | entry | cost | stop |
|-------|--------|-------|------|------|
| MRNA (Moderna, biotech) | 3 | 230.72 | 692.16 | 184.57 |
| ERAS (Erasca, biotech) | 50 | 14.81 | 740.50 | 11.84 |
| ECO (Okeanis Eco Tankers, shipping) | 8 | 86.99 | 695.92 | 69.59 |
| VSXY (Victoria's Secret, retail) | 6 | 106.86 | 641.16 | 85.48 |
| AMD (chips) | 1 | 537.26 | 537.26 | 429.80 |
| RXO (trucking) | 26 | 28.40 | 738.40 | 22.72 |

- Invested $4,045.40, cash $925.09. Account $4,970.49 at entry. SPY 753.80 (benchmark 6.6040 sh = $4,978.10).
- The 08:44 pre-market run fired 79 minutes late (10:03). The 10:00 news check already covered it; stop check: all six open.
- 15:33 Fri 11-13 summary: account $4999.36 (-0.64 vs $5,000): positions $4074.27 + cash $925.09. MRNA -3.4%, ERAS +6.8%, ECO +2.1%, VSXY -0.8%, AMD -1.2%, RXO -0.0%.
  SPY 752.58 vs 200-day 731.91 → crash guard off (SPY above its 200-day). Benchmark (6.6040 SPY) $4970.04 (-29.96): account ahead by $29.32.

## Sun 2026-11-15: crypto allowed by the owner

5-year test (15 big coins, 2021-11 to 2026-11, weekly, two halves):
- BTC buy & hold -1.0% / +19.6% (worst drops -75% / -52%); BTC only above its 50-day +31.7% / +11.7% (worst -53% / -35%).
- ETH buy & hold -35.3% / -27.7%; ETH only above its 50-day -15.7% / +36.7%.
- Top-3 coin momentum +40.8% / -56.4% (worst -85%): rejected. Equal weight all 15: +2.0% / -24.6%.
- Now: BTC 64,520 (50-day 79,739, 200-day 72,918, -20.8% in a month, -33% off its 1-year high); ETH 1,813 (50-day 2,378,
  200-day 2,142, -25.1% in a month). Both below their 50-day → the rule says no crypto now. Checked every pre-market.

## Mon 2026-11-16

- 08:46 pre-market: all six open, none near its -20% stop. News (72 h): Nvidia reports earnings Tue 11-17 (chip-sector event
  for AMD; NVDA watch item: earnings date found, but NVDA is far from the momentum list, so no entry either way); BofA
  downgraded VSXY while raising its target; MRNA -12% last week, CEO wants an FDA filing before year-end; ECO held its Q3
  call 11-13. No merger, halt or legal shock → hold all. Crypto: BTC 64,387 < 50-day 79,354, ETH 1,806 < 2,360 → stay out.
- 15:33 Mon 11-16 summary: account $4863.35 (-136.65 vs $5,000): positions $3938.26 + cash $925.09. MRNA -6.6%, ERAS +1.9%, ECO -2.5%, VSXY -4.1%, AMD -6.1%, RXO +0.1%.
  SPY 739.15 vs 200-day 732.15 → crash guard off (SPY above its 200-day). Benchmark (6.6040 SPY) $4881.35 (-118.65): account behind by $18.00.

## Tue 2026-11-17

- 01:50 owner asked for minute-by-minute news: news_watch.py started (every holding's Yahoo headlines each minute,
  prices every 5 minutes; wakes Claude on material news or an 8%+ move). Reaction rules in README step 0.
- 03:45 watcher run 1 quiet (one routine AMD article). Restarted.
- 05:30 EVENT news AMD: "US Stock Futures Edge Lower After Tech Sell-Off: NVDA Earnings, AMD ... In Focus" (Stocktwits).
  Context: 04:09 "Trump's Tighter Chip Rules Sink AMD and Broadcom, Not Just Nvidia" (TIKR); AMD closed Mon 504.37
  (-6.1% from entry 537.26), pre-market 502.48 (-0.4%); stop 429.80 is 14.5% below. Sector/policy news: no sale (rule).
  The 04:09 headline was logged but not flagged ("sink" was not a material word): added sink/sank/slump/curb.
- 07:25 watcher run quiet (Moderna valuation piece; Tepper sold AMD last quarter, a 13F, old news). Restarted.
- 07:44 EVENT news AMD: "AMD's Long-Term Prospects Remain Strong Despite Recent Stock Slump": opinion, a false alarm from
  the new word "slump". No action.
- 08:35 EVENT news RXO: "RXO's Latest Curve Freight Market Forecast Marks the Tenth Consecutive Quarter of Spot Rate
  Inflation": RXO's routine industry report, not company guidance. No action. (Also AMD: BofA sees 39% upside; opinion.)
- 08:45 PRE-MARKET (v3). Watcher running. Stop check: all 6 OPEN (MRNA 215.27, ERAS 15.11, ECO 84.83, VSXY 101.85,
  AMD 504.28, RXO 28.35; nearest stop AMD, 14.8% away). News 24h: nothing material (no deal, halt, legal, guidance) on any
  holding; AMD only opinion/13F/analyst pieces, RXO its freight report; nothing on ERAS, ECO, VSXY. No empty slot, no refill.
  Crypto: BTC 64,879 < 50-day 78,991; ETH 1,821 < 2,343 -> no crypto. SPY 739.95 > 200-day 732.16 (+1.1%): crash guard off.
  Account $4,857.52 (cash 925.09) = -$142.48; SPY benchmark $4,886.63 -> behind by $29.11.
  Watch items (background only, not v3 trades): NVDA earnings this week; TTWO GTA VI launch Thu 11-19.
- 09:53 ENTRIES check: watcher running; all 6 OPEN (MRNA 207.54 -3.7% today, ERAS 15.02, ECO 85.02, VSXY 103.66, AMD 503.28,
  RXO 28.50). Nothing planned, no trades. Account $4,845.11.
- 11:26 EVENT news MRNA: "Moderna's INT Outlook Strengthens After Phase 3 Melanoma Data, Morgan Stanley Says": analyst
  note on trial data, positive. Rule: no discretionary trade. MRNA 209.03 -2.9% on the day.
- 14:27 AMD: "AMD Stocks Decrease 1.62% as New US Rule Requires Licenses for Five Chip Hubs": policy news, no sale
  (rule). Not flagged by the watcher: added "licens" to its words.
- 14:51 EVENT move ERAS -8.0% today (13.90; entry 14.81 = -6.1%; stop 11.84 is 14.8% below). No new headline today (latest:
  Mon 13:01 "Erasca to Host Virtual Investor Event..."); biotech XBI -0.9%, IBB -0.9%; no halt. Rule: no sale on a move.
- 15:33 DAILY SUMMARY: all 6 OPEN, no stop hit. SPY live 730.92 vs 200-day 732.33 (incl. today; 732.16 through Mon): 0.19% BELOW.
  **CRASH GUARD: sell the 3 worst at 15:51** (now MRNA -10.8%, AMD -8.5%, VSXY -8.0% since entry; ERAS -6.2% next).
  The 15:51 check re-checks SPY (nearest reading to the close): sell only if SPY is still below its 200-day then.
  Account $4,747.28 = -$252.72 vs $5,000 (today -$110.24). SPY benchmark $4,827.00 (-$173.00) -> behind by $79.72.

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
