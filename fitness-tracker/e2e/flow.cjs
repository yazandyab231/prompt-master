// My own end-to-end pass through the main flows at phone size, from a clean profile.
const { chromium } = require('playwright');
const fs = require('fs');
const S = require('path').join(__dirname, '.out'); // scratch files and screenshots (git-ignored)
const out = [];
const ok = (name, cond, extra = '') => { out.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage();
  const _click = p.click.bind(p); p.click = async (...a) => { await p.waitForTimeout(380); return _click(...a); };
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  const overflow = async (label) => {
    const w = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`no sideways overflow: ${label}`, w <= 0, `overflow ${w}px`);
  };
  await p.goto('http://localhost:4173/');
  await p.waitForSelector('.masthead');
  ok('first run shows "Plan my week"', await p.locator('text=Plan my week').isVisible());

  // --- create a split from a template, then edit a day
  await p.click('button:has-text("Plan my week")');
  await p.click('button:has-text("Push / Pull / Legs")');
  ok('template creates 3 training days', (await p.locator('section:has-text("Training days") .row').count()) === 3);
  await overflow('train');
  await p.selectOption('select[aria-label="Thursday session"]', { label: 'Legs' });
  await p.click('section:has-text("Training days") .row:has-text("Push")');
  await p.fill('.sheet input.input >> nth=0', 'Push A');
  await p.click('.sheet button:has-text("Add exercise")');
  await p.fill('input[aria-label="Search exercises"]', 'Cable Fly');
  await p.click('.sheet .row:has-text("Cable Fly")');
  ok('exercise added to day', await p.locator('.sheet .row-title:has-text("Cable Fly")').isVisible());
  await p.click('.sheet-foot button:has-text("Done")');
  ok('day renamed', await p.locator('.row-title:has-text("Push A")').isVisible());

  // --- log a workout (start whichever day, so this passes on any weekday)
  await p.click('.chip:has-text("Pull"), button:has-text("Start Pull")');
  await p.waitForSelector('.workout'); await p.waitForTimeout(450);
  const first = p.locator('.ex').first();
  await first.locator('input[aria-label*="set 1 weight"]').fill('100');
  await first.locator('input[aria-label*="set 1 reps"]').fill('5');
  await first.locator('button[aria-label*="set 1 done"]').click();
  await first.locator('input[aria-label*="set 2 weight"]').fill('102,5');
  await first.locator('input[aria-label*="set 2 reps"]').fill('4');
  await first.locator('button[aria-label*="set 2 done"]').click();
  ok('ticked sets are marked done', (await p.locator('.set-row.is-done').count()) === 2);
  await overflow('workout');
  await p.screenshot({ path: S + '/shots/10-workout-logging.png' });
  // reload mid-session: it must survive
  await p.waitForTimeout(400);
  await p.reload();
  await p.waitForSelector('.masthead');
  await p.click('.tab:has-text("Today")');
  ok('session survives a reload', await p.locator('button:has-text("Continue")').isVisible());
  await p.click('button:has-text("Continue")');
  ok('logged sets survive a reload', (await p.locator('.set-row.is-done').count()) === 2);
  await p.click('button:has-text("Finish session")');
  await p.click('button:has-text("Save session")');
  await p.click('.tab:has-text("Train")');
  await p.click('.seg button:has-text("History")');
  ok('finished session is in history with 2 sets', (await p.locator('.row:has-text("Pull") .row-end').first().innerText()).startsWith('2'));
  await p.click('.row:has-text("Pull")');
  ok('history detail shows the comma-decimal weight', await p.locator('.sheet >> text=102.5 kg × 4').isVisible());
  await p.click('.sheet button[aria-label="Close"]');

  // --- second session: last time's numbers are offered
  await p.click('.seg button:has-text("Split")');
  await p.click('.chip:has-text("Pull"), button:has-text("Start Pull")');
  ok('next session shows last time', (await p.locator('.ex').first().locator('.set-last').first().innerText()) === '100×5');
  await p.click('button:has-text("Finish session")');
  await p.click('button:has-text("Discard session")');
  await p.click('.sheet .btn.danger:has-text("Discard")');

  // --- body weight
  await p.click('.tab:has-text("Today")');
  await p.click('button:has-text("Log weight")');
  await p.fill('.sheet input.input >> nth=0', '82.4');
  await p.click('button:has-text("Save weight")');
  ok('body weight shows on Today', (await p.locator('.stat-big').innerText()).includes('82.4'));

  // --- food: manual 100 g of rice
  await p.click('button:has-text("Log food")');
  await p.fill('input[aria-label="Search foods"]', 'rice');
  await p.click('.sheet .row:has-text("Rice, white, cooked")');
  await p.fill('.sheet input.input >> nth=0', '100');
  ok('100 g rice = 130 kcal', (await p.locator('.macro-strip .v').first().innerText()) === '130');
  await p.click('button:has-text("Add to log")');
  ok('calories eaten shows 130 (no target set yet)', (await p.locator('.fuel-hero .big').innerText()) === '130');

  // --- food: create a custom food, quick add
  await p.click('.tab:has-text("Food")');
  await p.click('button:has-text("Log food")');
  await p.click('.seg button:has-text("Quick")');
  await p.fill('.sheet input[placeholder="e.g. Lunch out"]', 'Shawarma');
  const q = p.locator('.sheet .grid-2 input');
  await q.nth(1).fill('30'); await q.nth(2).fill('40'); await q.nth(3).fill('20');
  await p.click('button:has-text("Add to log")');
  ok('quick add works out kcal from macros (460)', await p.locator('.row:has-text("Shawarma") .row-end:has-text("460")').isVisible());
  await overflow('food');

  // --- barcode: typed number, real Open Food Facts lookup (may be blocked by this sandbox's network)
  await p.click('button:has-text("Log food")');
  await p.click('.seg button:has-text("Barcode")');
  await p.waitForTimeout(800);
  ok('camera unavailable is explained, not a blank box', await p.locator('.viewfinder .msg').isVisible(), await p.locator('.viewfinder .msg').innerText().catch(() => ''));
  await p.fill('input[aria-label="Barcode number"]', '3017620422003');
  await p.click('button:has-text("Look up")');
  await p.waitForSelector('.food-title, .error, text=not in the database', { timeout: 20000 }).catch(() => {});
  const live = await p.locator('.food-title').isVisible();
  out.push(`INFO  live barcode lookup: ${live ? 'found "' + (await p.locator('.food-title').innerText()) + '"' : 'not reachable here: ' + (await p.locator('.sheet .error, .sheet .hint').first().innerText().catch(() => '?'))}`);
  await p.screenshot({ path: S + '/shots/11-barcode.png' });
  await p.click('.sheet button[aria-label="Close"]');

  // --- themes + units + export/import
  await p.click('.tab:has-text("Setup")');
  for (const th of ['Ember', 'Tide', 'Chalk', 'Clay']) {
    await p.click(`.theme-card:has-text("${th}")`);
    ok(`theme ${th} applies`, (await p.getAttribute('html', 'data-theme')) === th.toLowerCase());
    await p.click('.tab:has-text("Today")');
    await p.screenshot({ path: `${S}/shots/theme-${th.toLowerCase()}.png` });
    await p.click('.tab:has-text("Setup")');
  }
  await overflow('setup');
  await p.click('.seg button:has-text("Pounds")');
  await p.click('.tab:has-text("Today")');
  ok('body weight converts to lb (181.7)', (await p.locator('.stat-big').innerText()).includes('181.7'));
  await p.click('.tab:has-text("Setup")');
  await p.click('.seg button:has-text("Kilograms")');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Export backup")')]);
  const file = S + '/exported.json';
  await dl.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('export contains the workout, weight and food', exported.state.workouts.length === 1 && exported.state.bodyWeights.length === 1 && exported.state.entries.length >= 2);
  await p.click('button:has-text("Erase all data")');
  await p.click('button:has-text("Erase everything")');
  await p.click('.tab:has-text("Today")');
  ok('erase empties the app', await p.locator('text=Plan my week').isVisible());
  await p.click('.tab:has-text("Setup")');
  await p.setInputFiles('input[aria-label="Backup file to import"]', file);
  await p.click('button:has-text("Replace my data")');
  await p.waitForSelector('text=Backup imported');
  await p.click('.tab:has-text("Today")');
  ok('import restores body weight', (await p.locator('.stat-big').innerText()).includes('82.4'));
  ok('import restores theme (Clay)', (await p.getAttribute('html', 'data-theme')) === 'clay');
  await p.click('.tab:has-text("Setup")');
  fs.writeFileSync(S + '/bad.json', '{"hello":1}');
  await p.setInputFiles('input[aria-label="Backup file to import"]', S + '/bad.json');
  await p.waitForSelector('text=not a Logbook backup', { timeout: 3000 }).catch(() => {});
  ok('a non-backup file is refused with a message', await p.locator('text=not a Logbook backup').isVisible());

  // --- data persists across a full reload
  await p.waitForTimeout(400);
  await p.reload();
  await p.waitForSelector('.masthead');
  await p.click('.tab:has-text("Food")');
  ok('food log persists after reload', await p.locator('.row:has-text("Rice, white, cooked")').isVisible());

  ok('no console or page errors', errors.filter((e) => !/openfoodfacts|ERR_|Failed to load resource/.test(e)).length === 0, errors.join(' | ').slice(0, 400));
  console.log(out.join('\n'));
  await b.close();
})().catch((e) => { console.log(out.join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 600)); process.exit(1); });
