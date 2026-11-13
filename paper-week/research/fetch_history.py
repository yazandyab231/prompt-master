"""Download 5 years of daily bars for every stock deep_scan.py analyzed, plus SPY and QQQ.

    python3 -I research/fetch_history.py OUT_DIR [--deepscan trader/deepscan.json] [--workers 6]

Writes OUT_DIR/<SYMBOL>.json (date, open, high, low, close, volume lists). Skips files already there.
"""
import concurrent.futures as cf, json, os, sys, time, urllib.request, urllib.error, argparse, datetime as dt

HOSTS = ("query2.finance.yahoo.com", "query1.finance.yahoo.com")

def get(sym):
    last = None
    for k in range(5):
        url = "https://%s/v8/finance/chart/%s?range=5y&interval=1d" % (HOSTS[k % 2], sym.replace(".", "-"))
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429 or e.code >= 500:
                time.sleep(3 * (k + 1)); continue
            raise
        except Exception as e:
            last = e; time.sleep(1 + k)
    raise last

def save(sym, out):
    path = os.path.join(out, sym + ".json")
    if os.path.exists(path):
        return "cached"
    time.sleep(0.15)
    res = get(sym)["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    keep = [i for i, t in enumerate(res.get("timestamp") or []) if None not in (q["open"][i], q["high"][i], q["low"][i], q["close"][i])]
    d = {"date": [dt.datetime.utcfromtimestamp(res["timestamp"][i]).strftime("%Y-%m-%d") for i in keep]}
    for k in ("open", "high", "low", "close", "volume"):
        d[k] = [q[k][i] or 0 for i in keep]
    json.dump(d, open(path, "w"))
    return "ok"

def main(argv):
    ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--deepscan", default="trader/deepscan.json")
    ap.add_argument("--workers", type=int, default=6); a = ap.parse_args(argv)
    syms = ["SPY", "QQQ"] + [r["symbol"] for r in json.load(open(a.deepscan))["all"]]
    t0, done, fail = time.time(), 0, []
    with cf.ThreadPoolExecutor(a.workers) as ex:
        futs = {ex.submit(save, s, a.out): s for s in syms}
        for f in cf.as_completed(futs):
            try: f.result(); done += 1
            except Exception as e: fail.append(futs[f])
            if done % 300 == 0: print("  %d of %d" % (done, len(syms)), flush=True)
    print("fetched %d of %d in %.0fs; failed %d %s" % (done, len(syms), time.time() - t0, len(fail), fail[:10]))

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
