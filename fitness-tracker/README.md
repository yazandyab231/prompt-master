# Logbook

A personal, phone-first web app for tracking training and macros. One user, no account:
everything you log is stored in your browser on your device.

## What it does

- **Split** — define training days (exercises, target sets × reps) and assign them to weekdays.
- **Workout log** — log weight × reps per set against the split, with last session's numbers beside each set.
- **Body weight** — log weigh-ins and see the trend.
- **Macros** — protein, carbs, fat and calories against daily targets. Log food by:
  - searching ~90 built-in common foods and entering grams (e.g. 100 g of rice),
  - scanning a barcode (looked up in [Open Food Facts](https://world.openfoodfacts.org); only the barcode number is sent),
  - photographing the nutrition table on a package (text is read on the device; the photo is never uploaded),
  - quick-adding totals.
- **Progress** — charts for body weight and each lift.
- **Themes** — Iron (default), Ember, Tide, Chalk, Clay. kg / lb switch.
- **Reminders** — banners and notifications while the app is open; real push when the push service is deployed (see below).
- **Backup** — export / import all data as a JSON file.

## Run it

```bash
cd fitness-tracker
npm install
npm run dev        # http://localhost:5173
npm test           # logic tests (label parsing, push scheduling, maths)
npm run build && npm run preview   # production build on http://localhost:4173
```

The camera (barcode scanning) only works on `https://` or `localhost`. To try it on a phone the site has to be deployed.

## Where things are

| Path | What |
| --- | --- |
| `src/lib/` | Data model, storage (IndexedDB), food and exercise lists, barcode lookup, label parsing, reminders, push client |
| `src/screens/` | Today, Train, Workout logger, Food, Add food, Progress, Setup |
| `src/ui/` | Sheet, fields, chart, barcode scanner, icons |
| `src/styles/app.css` | The whole visual system and the five themes |
| `public/sw.js` | Service worker: offline cache and push display |
| `netlify/functions/`, `server/due.ts` | The push service (subscription store + every-minute sender) |
| `scripts/copy-ocr.mjs` | Copies the on-device text reader into `public/ocr` at dev/build time |

## Push notifications (not deployed yet)

Push needs a server and an HTTPS site. The code for both is here, written for Netlify, but **it has not been
run against a live deployment**. Workouts, food and body weight never go to that server; it stores only the
browser's push subscription, a time zone, and the reminder titles/times.

To turn it on when deploying:

1. Generate keys: `npx web-push generate-vapid-keys`
2. Set environment variables on the site: `VITE_VAPID_PUBLIC_KEY` and `VAPID_PUBLIC_KEY` (the public key),
   `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a `mailto:` address).
3. Deploy. In the app: Setup → Reminders → Turn push on.

On iPhone and iPad, push only works after the site is added to the home screen. Without these keys the app
still works; reminders then only show while it is open, and the Setup screen says so.

## Known limits

- Data lives in one browser on one device. Clearing site data deletes it: export a backup.
- The weekly split is fixed to weekdays (no rotating cycles yet).
- Label reading is the least reliable feature. On 21 generated test labels it got all four values
  right on 20, but only after an automatic cross-check against the energy figure, and those were
  clean renders, not photos of real packaging. Tilted (about 8°) or blurred images were not readable
  at all. Every result goes through a review screen before it is saved.
- Built-in food values are typical figures, not exact for any brand.
- Barcode lookups have only been tested against stand-in responses, not the live Open Food Facts service.
- Camera barcode scanning has not been tested on a real device.
- The push endpoint (`/api/push/sync`) has no authentication: anyone who finds it can register a
  subscription of their own. It stores nothing but subscriptions and reminder times.
- On a desktop the app is a centred phone-width column; nothing uses the extra width.
- Offline: the app shell works offline after one online visit. The label reader (about 7 MB) is only
  available offline after it has been used once online.
