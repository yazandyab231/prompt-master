"""Simulate a broker bracket order (stop-loss + take-profit) for the paper week.

Reads today's real 5-minute bars from Yahoo and reports whether the stop or
the target was touched after the entry time. A bar that touches both counts
as the stop (the worse case, same rule as trader-timemachine). A bar that
opens past the stop fills at its open (a gap), not at the stop.

    python3 bracket_check.py SYMBOL ENTRY_HHMM STOP TARGET

Exit code: 0 = stop or target hit (prints FILLED ...), 1 = still open, 2 = error.
"""
import datetime as dt
import json
import sys
import urllib.request
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")


def bars(sym):
    url = "https://query2.finance.yahoo.com/v8/finance/chart/%s?range=1d&interval=5m" % sym
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    out = []
    for i, t in enumerate(res.get("timestamp") or []):
        o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        if None in (o, h, l, c):
            continue
        out.append((dt.datetime.fromtimestamp(t, NY), o, h, l, c))
    return out, res["meta"].get("regularMarketPrice")


def main(argv):
    sym, hhmm, stop, target = argv[0].upper(), argv[1], float(argv[2]), float(argv[3])
    eh, em = map(int, hhmm.split(":"))
    now = dt.datetime.now(NY)
    rows, last = bars(sym)
    # Only bars that START at or after the entry minute and have CLOSED.
    for t, o, h, l, c in rows:
        start_min = t.hour * 60 + t.minute
        if start_min < eh * 60 + em or t + dt.timedelta(minutes=5) > now:
            continue
        if o <= stop:
            print("FILLED STOP (gap) %s %s bar at %.2f" % (sym, t.strftime("%H:%M"), o))
            return 0
        if l <= stop:
            print("FILLED STOP %s %s bar at %.2f" % (sym, t.strftime("%H:%M"), stop))
            return 0
        if h >= target:
            print("FILLED TARGET %s %s bar at %.2f" % (sym, t.strftime("%H:%M"), target))
            return 0
    print("OPEN %s last %.2f (stop %.2f, target %.2f) at %s" % (sym, last, stop, target, now.strftime("%H:%M")))
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:  # network or data problem
        print("ERROR %s" % e)
        sys.exit(2)
