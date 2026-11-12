# Paper week: $5,000 pretend account (do not merge)

Working files for one week of simulated day trading with the day-trader skills,
Thu 2026-11-12 to the close on Thu 2026-11-19. Pretend money only: no broker is
connected and nothing is ever placed. This folder lives on the session branch
so it survives machine restarts; it is not meant for `main`.

Trade-by-trade results: [LOG.md](LOG.md).

## Rules (from the approved prompt)

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

## Setup on a fresh machine

```bash
cd /home/user/prompt-master && git pull origin claude/vigilant-planck-fv3x2e
P=/root/.claude/plugins/cache/prompt-master/day-trader-skill/2.0.0
[ -d "$P" ] || { claude plugin marketplace add yazandyab231/prompt-master; claude plugin install day-trader-skill@prompt-master; }
cd paper-week   # every skill reads and writes ./trader/
```

## Each check-in

1. Setup above. Read the bottom of LOG.md: open position? entries and max loss used today?
2. **Open position:** `python3 -I bracket_check.py SYM HH:MM STOP TARGET`.
   FILLED → `ticket.py fill --symbol SYM --side sell --qty Q --price P`, log it, note to the chat.
3. **Pre-market (~08:45):** `scan.py universe`, `scan.py daily --show 30` (save the
   list as the day's shortlist), `news.py --tickers <top hits> --no-sec --hours 18`,
   `ptr.py` (Congress trades) as background. Write a short shortlist note in LOG.md.
4. **During 09:52 to 15:30, flat, under the day's limits:** `scan.py orb --show 40`,
   pick FRESH triggers, then for the best one: news.py → `entry.py check SYM --write`
   → `alerts.py quote SYM --write` → `exit.py plan --entry PX --time "HH:MM AM/PM" --write`
   → `timemachine.py run --until 15:55 --write` → (both averages > 0?) → `size.py --write`
   → `check.py` (PASS?) → live quote → `ticket.py fill ... --side buy` → `alerts.py add --from-plan`.
   Log every decision, including "no trade, because ...".
5. **~15:50:** anything still open is sold at the live price (`ticket.py fill --side sell`).
6. Commit and push after every change. Short note in the chat after every buy or sell.
7. **After the close on 2026-11-19:** final report in the chat and in LOG.md; delete
   every scheduled task listed in LOG.md.
