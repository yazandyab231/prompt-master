# Browser checks

164 end-to-end checks that drive the production build in headless Chromium at phone size.

```bash
npm run e2e              # build, then run all suites
npm run e2e -- regress2  # run one suite (after a build)
```

Needs Playwright (tested with 1.63) and its Chromium. It is not a project dependency, so a Netlify build never downloads a browser; on a new machine run `npm i -D playwright@1.63 && npx playwright install chromium`.

| Suite | Checks | What it covers |
| --- | --- | --- |
| flow | 33 | Main paths: split, workout, body weight, food, themes, units, export/erase/import |
| scan | 15 | Barcode lookups (mocked Open Food Facts) and nutrition-label reading |
| regress | 23 | Bugs found by the first independent tester |
| regress2 | 47 | One check per issue the simulated users reported |
| newfeat | 10 | Clean theme, split naming, weekly report, filling in missed days |
| labels | 23 | Nutrition-label reading on 24 test images in `fixtures/labels` (one known miss is reported, not counted) |
| recipes | 13 | Build a recipe, log portions, edit, re-log, delete; Scan barcode shortcut |

Sample data is generated fresh on every run (`make-seed.cjs`) so date-based checks keep working.
Logs and screenshots go to `e2e/.out/` (not committed).

Known limits: Chromium only (no Safari), no camera, Open Food Facts is mocked, label images are rendered HTML, not photos.
