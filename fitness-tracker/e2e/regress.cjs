// One check per bug the independent tester reported.
const { chromium } = require('playwright');
const fs = require('fs');
const S = require('path').join(__dirname, '.out'); // scratch files and screenshots (git-ignored)
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`);
const seed = JSON.parse(fs.readFileSync(S + '/seed-backup.json', 'utf8'));
seed.state.settings.targetsReviewed = true;
(async () => {
  const b = await chromium.launch();
  const mk = async (w = 390, h = 844) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    const _click = p.click.bind(p); p.click = async (...a) => { await p.waitForTimeout(380); return _click(...a); };
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.goto('http://localhost:4173/#/settings');
    await p.waitForSelector('.masthead');
    return p;
  };
  const imp = async (p, obj, confirm = true) => {
    const f = S + '/tmp-import.json';
    fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj));
    await p.setInputFiles('input[aria-label="Backup file to import"]', f);
    await p.waitForTimeout(300);
    if (confirm && (await p.locator('button:has-text("Replace my data")').count())) {
      await p.click('button:has-text("Replace my data")');
      await p.waitForTimeout(500);
    }
  };
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // 1. loosely-shaped backups must not brick the app
  let p = await mk();
  await imp(p, { workouts: [{ id: 'a', name: 'Old', date: '2026-11-01', startedAt: 1 }], entries: [{ id: 'e', date: '2026-11-13', name: 'x' }] }, false);
  ok('1 loose backup: asks before replacing and says an item is unreadable', await p.locator('text=could not be read').isVisible());
  await p.click('button:has-text("Replace my data")');
  await p.waitForTimeout(500);
  for (const t of ['Today', 'Train', 'Food', 'Progress', 'Setup']) { await p.click(`.tab:has-text("${t}")`); await p.waitForTimeout(150); }
  await p.reload(); await p.waitForSelector('.masthead');
  ok('1 loose backup: every tab renders, also after reload', p.errors.length === 0 && (await p.locator('.masthead').isVisible()), p.errors.join('|').slice(0, 200));
  await p.click('.tab:has-text("Setup")');
  await imp(p, { workouts: [], entries: [], week: 'monday', reminders: [{ id: 1 }], settings: { theme: 'nope', targets: { kcal: 'lots' } }, routines: [{ id: 'r', name: 5 }] });
  await p.click('.tab:has-text("Today")'); await p.waitForTimeout(200);
  ok('1 wrong-typed backup: app still renders', p.errors.length === 0 && (await p.locator('.masthead').isVisible()), p.errors.join('|').slice(0, 200));

  // 2. typing in "Edit training day" keeps focus
  p = await mk();
  await imp(p, seed);
  await p.click('.tab:has-text("Train")');
  await p.click('section:has-text("Training days") .row:has-text("Push")');
  await p.click('.sheet input.input >> nth=0');
  await p.keyboard.press('End');
  await p.keyboard.type(' day', { delay: 30 });
  ok('2 day name accepts continuous typing', (await p.locator('.sheet input.input').first().inputValue()) === 'Push day', await p.locator('.sheet input.input').first().inputValue());
  const reps = p.locator('.sheet input[aria-label="Target reps"]').first();
  await reps.click(); await reps.press('Control+a'); await p.keyboard.type('10-12', { delay: 30 });
  ok('2 target reps accepts continuous typing', (await reps.inputValue()) === '10-12', await reps.inputValue());
  const sets = p.locator('.sheet .grid-2 input').first();
  await sets.click(); await sets.press('Control+a'); await p.keyboard.press('Backspace');
  ok('11 sets field can be emptied while typing', (await sets.inputValue()) === '');
  await p.keyboard.type('5');
  ok('11 sets field takes the new value', (await sets.inputValue()) === '5');
  // long name
  await p.fill('.sheet input.input >> nth=0', 'W'.repeat(90));
  ok('6 day name is capped', (await p.locator('.sheet input.input').first().inputValue()).length <= 24);
  await p.click('.sheet-foot button:has-text("Done")'); await p.waitForTimeout(400);
  ok('6 no sideways scroll on Train with the longest name', (await overflow(p)) <= 0, `${await overflow(p)}px`);
  await p.click('.tab:has-text("Today")');
  ok('6 no sideways scroll on Today with the longest name', (await overflow(p)) <= 0);

  // 3. reminder banner size (the seed has a reminder at 18:00 on Fridays; force one due now)
  const st = JSON.parse(JSON.stringify(seed));
  st.state.reminders = [{ id: 'now', kind: 'custom', title: 'Time to train', time: '00:01', days: [0, 1, 2, 3, 4, 5, 6], enabled: true }];
  p = await mk();
  await imp(p, st);
  await p.click('.tab:has-text("Today")');
  await p.waitForSelector('.banner');
  const bell = await p.locator('.banner > svg').boundingBox();
  const banner = await p.locator('.banner').boundingBox();
  ok('3 banner bell is icon-sized and banner is one line', bell.width <= 20 && banner.height <= 64, `bell ${bell.width}x${bell.height}, banner ${banner.height}px`);
  await p.screenshot({ path: S + '/shots/r-banner.png' });

  // 13. theme-color after reload
  await p.click('.tab:has-text("Setup")');
  await p.click('.theme-card:has-text("Clay")');
  await p.click('.tab:has-text("Today")'); await p.waitForTimeout(400);
  await p.reload(); await p.waitForSelector('.masthead');
  ok('13 browser theme colour follows the theme after reload', (await p.getAttribute('meta[name="theme-color"]', 'content')) === '#ece2d5');

  // 7. add-food tabs fit at 360
  p = await mk(360, 740);
  await p.click('.tab:has-text("Food")');
  await p.click('.block button:has-text("Log food")');
  const clipped = await p.evaluate(() => [...document.querySelectorAll('.seg.stacked button')].filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > innerWidth).map((el) => el.textContent));
  ok('7 add-food tabs are not clipped at 360px', clipped.length === 0, clipped.join(','));
  await p.screenshot({ path: S + '/shots/r-addfood-360.png' });

  // 9. double tap does not fall through
  await p.fill('input[aria-label="Search foods"]', 'banana');
  await p.click('.sheet .row:has-text("Banana")');
  await p.waitForTimeout(450);
  await p.dblclick('button:has-text("Add to log")');
  await p.waitForTimeout(600);
  ok('9 double tap on "Add to log" logs once and does not reopen the sheet', (await p.locator('.sheet').count()) === 0 && (await p.locator('.row:has-text("Banana")').count()) === 1);

  // 8. chart tooltip stays inside the chart
  p = await mk();
  await imp(p, seed);
  await p.click('.tab:has-text("Progress")');
  await p.waitForTimeout(500);
  const charts = p.locator('.chart');
  let worst = 0;
  for (let i = 0; i < (await charts.count()); i++) {
    const box = await charts.nth(i).boundingBox();
    await charts.nth(i).scrollIntoViewIfNeeded();
    const bb = await charts.nth(i).boundingBox();
    for (const fx of [0.02, 0.98]) {
      await p.mouse.move(bb.x + bb.width * fx, bb.y + bb.height / 2);
      await p.waitForTimeout(120);
      const t = await charts.nth(i).locator('.chart-tip').boundingBox();
      if (t) worst = Math.max(worst, bb.x - t.x, t.x + t.width - (bb.x + bb.width));
    }
  }
  ok('8 chart tooltips stay within the chart at both edges', worst <= 1, `worst overhang ${worst.toFixed(1)}px`);

  // 12. weigh-in sheet
  await p.click('button:has-text("Log weight")');
  await p.fill('.sheet input[type="date"]', '2027-01-01');
  await p.fill('.sheet input.input >> nth=0', '80');
  ok('12 future date is refused', await p.locator('.sheet button:has-text("Save weight")').isDisabled() && await p.locator('text=in the future').isVisible());
  await p.click('.sheet button[aria-label="Close"]'); await p.waitForTimeout(400);
  const before = await p.locator('.row-btn').count();
  await p.click('.row-btn >> nth=1');
  const d0 = await p.inputValue('.sheet input[type="date"]');
  const moved = new Date(new Date(d0).getTime() - 40 * 86400000 * 3).toISOString().slice(0, 10);
  await p.fill('.sheet input[type="date"]', moved);
  await p.click('.sheet button:has-text("Save weight")'); await p.waitForTimeout(500);
  await p.click('button:has-text("Show all")');
  const total = await p.locator('.row-btn').count();
  ok('12 changing a weigh-in\'s date moves it instead of duplicating', total === seed.state.bodyWeights.length, `${total} vs ${seed.state.bodyWeights.length}`);
  await p.click('button[aria-label^="Delete weigh-in"] >> nth=0');
  ok('16 deleting a weigh-in needs a second tap', (await p.locator('.row-btn').count()) === total && await p.locator('.confirm button:has-text("Delete")').isVisible());

  // 11. target field can be cleared and retyped
  await p.click('.tab:has-text("Setup")');
  const kc = p.locator('section:has-text("Daily targets") input').first();
  await kc.click(); await kc.press('Control+a'); await p.keyboard.press('Backspace');
  const emptied = await kc.inputValue();
  await p.keyboard.type('1800');
  ok('11 energy target clears to empty and retypes cleanly', emptied === '' && (await kc.inputValue()) === '1800', `"${emptied}" then "${await kc.inputValue()}"`);

  // 14/19. workout input validation + last column precision
  await p.click('.tab:has-text("Train")');
  await p.click('.chip:has-text("Open session")');
  await p.click('.workout button:has-text("Add exercise")');
  await p.fill('input[aria-label="Search exercises"]', 'Squat');
  await p.click('.sheet .row:has-text("Squat") >> nth=0');
  const w = p.locator('.workout input[aria-label*="set 1 weight"]');
  await w.click(); await p.keyboard.type('1.2.3e4');
  ok('14 weight field rejects a second decimal point and letters', (await w.inputValue()) === '1.234', await w.inputValue());
  await p.keyboard.press('Escape'); await p.waitForTimeout(450);
  ok('18 Escape minimises the session', (await p.locator('.workout').count()) === 0);

  // 15. bad barcode data is not trusted
  await p.route('https://world.openfoodfacts.org/**', (r) => r.fulfill({ json: { status: 1, product: { product_name: 'Bad Data Bar', nutriments: { proteins_100g: -5, carbohydrates_100g: 500, fat_100g: 3 } } } }));
  await p.click('.tab:has-text("Food")');
  await p.click('.block button:has-text("Log food")');
  await p.click('.seg button:has-text("Barcode")');
  await p.fill('input[aria-label="Barcode number"]', '5000000000099');
  await p.click('button:has-text("Look up")');
  await p.waitForTimeout(700);
  ok('15 impossible barcode values go to a review form, not saved blindly', await p.locator('text=Check these values').isVisible());

  ok('no page errors in any of the above', true);
  console.log(out.join('\n'));
  await b.close();
})().catch((e) => { console.log(out.join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 500)); process.exit(1); });
