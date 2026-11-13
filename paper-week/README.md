# Paper month: $5,000 pretend account (do not merge)

Working files for a month of simulated trading with the day-trader skills, Thu 2026-11-12 to
the close on Fri 2026-12-11 (extended from one week at the owner's request), with a weekly report
every Friday from 2026-11-20. Pretend money only: no broker is
connected and nothing is ever placed. This folder lives on the session branch
so it survives machine restarts; it is not meant for `main`.

Trade-by-trade results: [LOG.md](LOG.md).

## Rules v3 (from Fri 2026-11-13): momentum portfolio. These replace v2 and v1.

Why: the 5-year study (research/, 1,293 stocks, ~1 million stock-days, discovery and validation halves)
found that NONE of the chart setups beat SPY, and that the v2 per-stock "proof" did not predict anything
(setups that passed it did no better afterwards than ones that failed it). The only strategy that beat SPY
in both halves was 12-1 momentum, also the best-documented anomaly in the research literature
(+0.6% and +1.5% a month over SPY; not statistically proven on 4 years of data). Findings: research/FINDINGS.md.

- **Pick:** `python3 -I momentum_pick.py` ranks every liquid stock by its return from 12 months ago to 1 month
  ago; keep the top 10% that are above their 50-day average, ATR >= 1%, a share <= $750. Then diversify:
  the strongest name per industry, at most 2 biotech/pharma, dollar volume >= $50M a day; news check each
  (drop pending mergers or buyouts, halts, legal shocks).
- **Size:** 6 positions, equal dollars: (cash - $500 buffer) / 6, whole shares.
- **Hold:** to the close on Fri 2026-12-11 (about 20 market days, the tested holding period).
- **Disaster stop:** -20% from the entry (`bracket_check.py SYM HH:MM STOP 999999 DATE`). A stopped slot is
  refilled at the next 09:52 check with the best untaken pick from a fresh `momentum_pick.py`.
- **No other trades:** no setup swings, no opening-range day trades (no edge found).
- **Benchmark:** $5,000 in SPY at the Thu 2026-11-12 close (757.12 → 6.6040 shares). Every report compares.

## Older rules (history)

### Rules v2 (from Fri 2026-11-13; the owner said "hold stocks if you want, any rule, just make money")

Pretend money only, as before. Everything still sold by the close on Fri 2026-12-11.

**Swing trades (main approach).** Hold up to 5 market days.
- Candidates: trader-scanner's `daily` scan before the open (breakout_20d, bull_flag, reclaim_ma20,
  oversold_bounce), liquid stocks only, plus trader-news for events.
- Proof on real data: `python3 -I swing_backtest.py SYM` replays the setup that fired on 2 years of
  that stock's own daily bars (buy next open, stop 2 x ATR14, target 2R, max 5 days). Take it only if
  that setup fired at least 15 times, its average R is positive, AND it beats the stock's baseline
  (the same trade on every day). Otherwise no trade.
- Entry: after 09:52 at the live price, and only if the price is not more than 2% above the last
  close (no chasing gaps). Stop = live price minus 2 x ATR14 (rounded down), target = live + 2 x that risk.
- Size: risk up to $100 a trade (2%): shares = floor(100 / risk a share), capped by $3,750 a position
  and by cash minus a $500 buffer. Up to 3 positions at once, no margin, no shorts.
- Exit: stop or target (checked on every 5-minute bar with `bracket_check.py SYM HH:MM STOP TARGET DATE`),
  else at the close of day 5, else by 15:51 on Fri 2026-12-11.

**Market calendar:** closed Thu 2026-11-26 (Thanksgiving). Fri 2026-11-27 closes at 13:00: no day trades
that day, and anything that must be sold that day is sold at the 13:00 close.

**Watch item: NVDA** (added 2026-11-12). CEO Jensen Huang resigned on 11-12 amid a reported scandal
(stock -4.3% that day, -30.5% from its 10-06 high, at its 52-week low), with earnings due soon. Over
10 years, buying NVDA at a fresh RSI-under-30 reading did WORSE than a random day (20 days later:
median -4.9%, up 44% of the time, n=9; random day +4.5%). No NVDA entry before its earnings report is
out. After that, it is treated like any other candidate: it needs a daily setup that passes the v2
proof. Log its status in the pre-market review.

**Watch item: TTWO** (owner's idea, added 2026-11-13). GTA VI launches Thu 2026-11-19. TTWO closed 226.95 on 11-12,
+12.8% in a month (194.99 on 11-03), 12% under its 07-06 high. BofA: GTA VI needs a $1.9bn opening weekend to meet
expectations. Daily data around past launches: GTA V (2013-09-17) -5.5% in the 20 days before, +6.1% in the 5 days
after, -0.4% 20 days after; RDR2 (2018-10-26) -13.0% before, +6.9% 5 days after, -8.0% 20 days after (n=2: anecdote,
not proof). This time the run-up already happened before launch. TTWO's only setup with an edge on 2 years of data is
reclaim_ma20 (n=30, avg R +0.18, edge +0.20); breakout_20d and bull_flag LOST money on TTWO. Rule: buy TTWO only when a
setup that passes the v2 proof fires (in practice reclaim_ma20), never on launch hype alone. Check it every pre-market.

**Day trades (opening-range breakouts) still allowed** with the v1 rules below, only with cash left
over and never more than 3 positions in total.

### Rules v1 (Thu 2026-11-12, still used for day trades)

- Day trades only, long only, flat by 15:55 New York. One open position at a time.
- Max loss per trade $50. The skill's own limits also apply: $150 max loss a day
  (counted as the max loss at the stop of each entry), 3 entries a day, entries
  only 09:45 to 15:30, reward:risk at least 1, position cap 75% of $5,000.
- trader-risk's trade and daily-loss counters only see broker-approved orders,
  so the counts above are enforced from LOG.md by hand.
- Pick real US stocks from the scans, on prices, volume and breakouts, never on
  articles predicting where a stock will go. News is checked only for events
  (halts, lawsuits, earnings surprises, deals) that make a setup unreliable.
- Take a trade only if the Time Machine's average R is positive in BOTH the
  10,000 replays and the real history of the same rule. Otherwise no trade.
- The breakout must be fresh: triggered within the last ~2 bars (10 minutes),
  with the live price still within about 0.3% of the trigger.
- Fills are simulated at the live (delayed, free) Yahoo price when the decision
  is made. Stops and targets are simulated with `bracket_check.py` on real
  5-minute bars: a bar touching both counts as the stop; a gap fills at the open.
- Never fake the owner's "yes": trader-broker `approve`/`result` are not used.
  Fills are recorded with `ticket.py fill`.
- SEC tools (trader-analyst, SEC part of trader-news) are skipped: they need the
  owner's name and email, which were not given. Use `news.py --no-sec`.

**Open positions** live in `positions.json` (symbol, qty, entry, date, time, stop, target, kind, exit_by).

## Setup on a fresh machine

```bash
cd /home/user/prompt-master && git pull origin claude/vigilant-planck-fv3x2e
P=/root/.claude/plugins/cache/prompt-master/day-trader-skill/2.0.0
[ -d "$P" ] || { claude plugin marketplace add yazandyab231/prompt-master; claude plugin install day-trader-skill@prompt-master; }
cd paper-week   # every skill reads and writes ./trader/
```

## Each check-in (rules v3)

1. Setup above. Read positions.json and the bottom of LOG.md.
2. **Every position:** `python3 -I bracket_check.py SYM HH:MM STOP 999999 YYYY-MM-DD` (stop = entry x 0.80).
   FILLED → `ticket.py fill --symbol SYM --side sell --qty Q --price P`, remove it from positions.json,
   log it, one-line note in the chat.
3. **Pre-market (~08:45):** news on every holding (`news.py --tickers ... --no-sec --hours 24`): log anything
   material (deal, halt, guidance, legal). Watch items (NVDA, TTWO) as background only. If a slot is empty,
   run `momentum_pick.py` and choose the refill (diversification rules).
4. **09:52:** buy any planned entries or refills at the live price (`alerts.py quote SYM`, then
   `ticket.py fill --side buy`), add to positions.json (symbol, qty, entry, date, time, stop, kind "momentum").
5. **15:51 on Fri 2026-12-11:** sell everything at the live price. No other scheduled sales.
6. Commit and push after every change. One-line chat note after every buy or sell.
7. **After the close on 2026-12-11:** final report in the chat and in LOG.md; delete
   every scheduled task listed in LOG.md.
