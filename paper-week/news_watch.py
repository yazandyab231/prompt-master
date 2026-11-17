"""Minute-by-minute news watcher for the paper month's holdings.

Every --interval seconds it reads Yahoo Finance's headline feed for every stock in positions.json and
keeps a record of what it has seen. A NEW headline that names the company AND contains a material word
(merger, buyout, offering, FDA, trial, halt, SEC, lawsuit, fraud, guidance, downgrade, bankruptcy,
CEO exit, plunge, ...) is an event. Every 5 minutes it also checks prices: a holding down or up 8%+ on
the day is an event (once per stock per day).

On events it prints one line each, starting with EVENT, and exits 0 so Claude wakes up and decides.
With nothing material it exits 3 after --max-minutes. Other new headlines about the holdings go to
trader/state/news_feed.log without waking anyone.

    python3 -I news_watch.py [--interval 60] [--max-minutes 115]

Free Yahoo feeds lag real time by minutes. No SEC filings (they need the owner's name and email).
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
UA = {"User-Agent": "Mozilla/5.0"}
STATE = "trader/state/newswatch.json"
FEED_LOG = "trader/state/news_feed.log"
MATERIAL = re.compile(
    r"merg|acqui|buyout|takeover|take-private|go(?:ing)? private|tender offer|to be (?:bought|acquired)|"
    r"offering|dilut|FDA|approv|reject|complete response|\bCRL\b|trial|phase [123]|halt|suspend|"
    r"\bSEC\b|investigat|probe|subpoena|lawsuit|\bsued\b|fraud|restat|guidance|outlook|forecast|"
    r"downgrad|upgrad|bankrupt|chapter 11|default|\bCEO\b|resign|steps down|recall|"
    r"plunge|plummet|soar|surge|tumble|crash|selloff|sell-off|short[- ]seller|delist|warning|"
    r"restrict|export|ban\b|sanction|tariff", re.I)
MOVE_PCT = 8.0


def get(url, timeout=20):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


def holdings():
    out = []
    for p in json.load(open("positions.json"))["positions"]:
        name = (p.get("name") or "").split(" (")[0].replace("’", "'")
        first = name.split()[0] if name else p["symbol"]
        pats = [re.compile(r"\b%s\b" % re.escape(p["symbol"]))]  # ticker, case-sensitive
        if first and first.upper() != p["symbol"]:
            pats.append(re.compile(re.escape(first), re.I))
        out.append((p["symbol"], pats))
    return out


def headlines(sym):
    root = ET.fromstring(get("https://feeds.finance.yahoo.com/rss/2.0/headline?s=%s&region=US&lang=en-US" % sym))
    for it in root.iter("item"):
        yield ((it.findtext("guid") or it.findtext("link") or "").strip(), (it.findtext("title") or "").strip(),
               (it.findtext("pubDate") or "").strip(), (it.findtext("link") or "").strip())


def day_move(sym):
    m = json.loads(get("https://query2.finance.yahoo.com/v8/finance/chart/%s?range=1d&interval=5m" % sym))["chart"]["result"][0]["meta"]
    return m["regularMarketPrice"], 100 * (m["regularMarketPrice"] / m["chartPreviousClose"] - 1)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=int, default=60)
    ap.add_argument("--max-minutes", type=float, default=115)
    a = ap.parse_args(argv)
    os.makedirs("trader/state", exist_ok=True)
    st = json.load(open(STATE)) if os.path.exists(STATE) else {"seen": {}, "moves": {}}
    hold = holdings()
    first_run = not st["seen"]
    end = time.time() + 60 * a.max_minutes
    last_px = 0.0
    while time.time() < end:
        events = []
        now = dt.datetime.now(NY)
        for sym, pats in hold:
            try:
                items = list(headlines(sym))
            except Exception:
                continue
            seen = set(st["seen"].get(sym, []))
            for gid, title, pub, link in items:
                if not gid or gid in seen:
                    continue
                seen.add(gid)
                if first_run:
                    continue
                if not any(p.search(title.replace("’", "'")) for p in pats):
                    continue
                with open(FEED_LOG, "a", encoding="utf-8") as fh:
                    fh.write("%s %s | %s | %s\n" % (now.strftime("%m-%d %H:%M"), sym, title, link))
                if MATERIAL.search(title):
                    events.append("EVENT news %s %s | %s | %s" % (sym, pub[5:22], title, link))
            st["seen"][sym] = list(seen)[-300:]
        if time.time() - last_px >= 300 and now.weekday() < 5 and 9 * 60 + 30 <= now.hour * 60 + now.minute <= 16 * 60:
            last_px = time.time()
            for sym, _ in hold:
                try:
                    px, chg = day_move(sym)
                except Exception:
                    continue
                key = "%s %s" % (sym, now.date().isoformat())
                if abs(chg) >= MOVE_PCT and key not in st["moves"]:
                    st["moves"][key] = round(chg, 1)
                    events.append("EVENT move %s %+.1f%% today, last %.2f" % (sym, chg, px))
        first_run = False
        json.dump(st, open(STATE, "w"))
        if events:
            print("\n".join(events), flush=True)
            return 0
        time.sleep(a.interval)
    print("QUIET no material news or 8%% moves in %.0f minutes" % a.max_minutes, flush=True)
    return 3


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
