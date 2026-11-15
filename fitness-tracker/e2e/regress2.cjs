// One check per issue the 100 simulated customers reported (and that was fixed).
const { chromium } = require('playwright');
const fs = require('fs');
const S = require('path').join(__dirname, '.out'); // scratch files and screenshots (git-ignored)
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`);
const seed = JSON.parse(fs.readFileSync(S + '/seed-backup.json', 'utf8'));
seed.state.settings.targetsReviewed = true; // these checks are about later use, after the questions
const URL0 = 'http://localhost:4173/';
const human = (p) => { const c = p.click.bind(p); p.click = async (...a) => { await p.waitForTimeout(400); return c(...a); }; };

(async () => {
  const b = await chromium.launch();
  const fresh = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', ...opts });
    const p = await ctx.newPage();
    human(p);
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    return { ctx, p };
  };
  const load = async (p, state) => {
    await p.goto(URL0 + '#/settings'); await p.waitForSelector('.masthead');
    if (state) {
      fs.writeFileSync(S + '/r2.json', JSON.stringify(state));
      await p.setInputFiles('input[aria-label="Backup file to import"]', S + '/r2.json');
      await p.click('button:has-text("Replace my data")');
      await p.waitForTimeout(300);
    }
  };
  const exportState = async (p) => p.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('keyval-store'); r.onsuccess = () => { const tx = r.result.transaction('keyval'); const g = tx.objectStore('keyval').get('logbook.state'); g.onsuccess = () => res(g.result); };
  }));
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // --- Kofi: double tap on Finish must not delete the session
  let { ctx, p } = await fresh();
  await load(p, seed);
  await p.click('.tab:has-text("Today")');
  await p.click('button:has-text("Start workout")');
  await p.waitForSelector('.workout'); await p.waitForTimeout(450);
  await p.locator('.ex').first().locator('button[aria-label*="set 1 done"]').click();
  await p.waitForTimeout(400);
  await p.locator('button:has-text("Finish session")').dblclick();
  await p.waitForTimeout(600);
  let st = await exportState(p);
  ok('Kofi: double tap on Finish keeps the session', st.workouts.some((w) => w.finishedAt == null), `${st.workouts.length} workouts`);
  ok('Kofi: Discard asks before deleting', !(await p.locator('.sheet .btn.danger:has-text("Discard")').isVisible()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  // --- George: removing an exercise can be undone
  await p.locator('.ex').first().locator('button[aria-label^="Remove"]').click();
  await p.waitForTimeout(300);
  const before = await p.locator('.ex').count();
  await p.click('.toast-action:has-text("Undo")');
  await p.waitForTimeout(300);
  ok('George: Undo brings a removed exercise back', (await p.locator('.ex').count()) === before + 1);

  // --- Duke: Back closes the logger instead of changing what is behind it
  const urlBefore = p.url();
  await p.goBack(); await p.waitForTimeout(500);
  ok('Duke: Back minimises the workout logger', (await p.locator('.workout').count()) === 0 && p.url() === urlBefore, p.url());
  await p.click('.tab:has-text("Food")');
  await p.click('.block button:has-text("Log food")');
  await p.goBack(); await p.waitForTimeout(500);
  ok('Duke: Back closes the Log food sheet and stays on Food', (await p.locator('.sheet').count()) === 0 && p.url().endsWith('#/food'), p.url());

  // --- Clara/Amir: focus returns to the button that opened a sheet
  await p.locator('.block button:has-text("Log food")').focus();
  await p.keyboard.press('Enter'); await p.waitForTimeout(450);
  await p.keyboard.press('Escape'); await p.waitForTimeout(450);
  ok('Clara: focus returns to "Log food" after closing', await p.evaluate(() => document.activeElement?.textContent?.includes('Log food')), await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 60)));

  // --- Andre: a cleared weight means bodyweight
  await ctx.close();
  ({ ctx, p } = await fresh());
  await load(p, seed);
  await p.click('.tab:has-text("Train")');
  await p.click('.chip:has-text("Open session")');
  await p.waitForSelector('.workout'); await p.waitForTimeout(450);
  await p.click('.workout button:has-text("Add exercise")');
  await p.fill('input[aria-label="Search exercises"]', 'Pull-Up');
  await p.click('.sheet .row:has-text("Pull-Up")');
  await p.waitForTimeout(450);
  const wIn = p.locator('.workout input[aria-label*="set 1 weight"]');
  await wIn.fill('20'); await wIn.fill('');
  await p.locator('.workout input[aria-label*="set 1 reps"]').fill('12');
  await p.locator('.workout button[aria-label*="set 1 done"]').click();
  await p.waitForTimeout(300);
  st = await exportState(p);
  const pull = st.workouts.find((w) => w.finishedAt == null).exercises.find((e) => e.exerciseId === 'x-pull-up');
  ok('Andre: emptied weight field saves a bodyweight set', pull && pull.sets[0].weight === null && pull.sets[0].done, JSON.stringify(pull?.sets[0]));
  await ctx.close();

  // --- Marcus/Mia: "last time" comes from the same training day; set-1 weight carries down
  const s2 = clone(seed);
  const pushW = s2.state.workouts.filter((w) => w.routineId === 'r-push').sort((a, c) => c.startedAt - a.startedAt)[0];
  const t0 = Date.now() - 3600_000;
  s2.state.workouts.push({ id: 'light', routineId: 'r-legs', name: 'Legs', date: new Date(t0).toISOString().slice(0, 10), startedAt: t0, finishedAt: t0 + 60000,
    exercises: [{ exerciseId: 'x-bench-press', sets: [{ weight: 40, reps: 12, done: true }] }] });
  ({ ctx, p } = await fresh());
  await load(p, s2);
  await p.click('.tab:has-text("Train")');
  await p.click('.chip:has-text("Push"), button:has-text("Start Push")');
  await p.waitForSelector('.workout'); await p.waitForTimeout(450);
  const lastTxt = await p.locator('.ex').first().locator('.set-last').first().innerText();
  const pushBench = pushW.exercises.find((e) => e.exerciseId === 'x-bench-press').sets[0];
  ok('Marcus: Bench "last" is from the last Push day, not the light Legs bench', lastTxt.startsWith(String(pushBench.weight)), `${lastTxt} vs ${pushBench.weight}×${pushBench.reps}`);
  const ex = p.locator('.ex').first();
  await ex.locator('input[aria-label*="set 1 weight"]').fill('97.5');
  await p.waitForTimeout(200);
  ok('Marcus: a new set-1 weight carries to the sets below', (await ex.locator('input[aria-label*="set 3 weight"]').inputValue()) === '97.5', await ex.locator('input[aria-label*="set 3 weight"]').inputValue());
  await ctx.close();

  // --- Elena: micro-plates keep 2 decimals after saving
  const s3 = clone(seed);
  s3.state.workouts.forEach((w) => w.exercises.forEach((e) => e.sets.forEach((x) => { if (e.exerciseId === 'x-squat') x.weight = 61.25; })));
  ({ ctx, p } = await fresh());
  await load(p, s3);
  await p.click('.tab:has-text("Progress")');
  await p.selectOption('select[aria-label="Exercise"]', { label: 'Squat' });
  await p.waitForTimeout(300);
  ok('Elena: Progress shows 61.25, not 61.3', (await p.locator('.kpi .v').allInnerTexts()).some((t) => t.includes('61.25')), (await p.locator('.kpi .v').allInnerTexts()).join(' | '));
  await p.click('.tab:has-text("Train")'); await p.click('.seg button:has-text("History")');
  await p.click('.row:has-text("Legs") >> nth=0');
  ok('Elena: history detail shows 61.25 kg', await p.locator('.sheet >> text=61.25 kg').first().isVisible());

  // --- Sophie: edit a finished session; log a past session
  await p.click('.sheet button:has-text("Edit this session")');
  await p.waitForSelector('.workout'); await p.waitForTimeout(450);
  await p.locator('.workout .ex').first().locator('button:has-text("Add set")').click();
  const nSets = await p.locator('.workout .ex').first().locator('.set-row').count();
  await p.locator('.workout .ex').first().locator(`input[aria-label*="set ${nSets} reps"]`).fill('3');
  await p.click('.workout-foot button:has-text("Save changes")');
  await p.waitForTimeout(400);
  st = await exportState(p);
  const edited = st.workouts.filter((w) => w.finishedAt != null).sort((a, c) => c.startedAt - a.startedAt).find((w) => w.name === 'Legs' && w.id !== 'x');
  ok('Sophie: a set added to a finished session is saved', edited.exercises[0].sets.length === nSets && edited.exercises[0].sets.at(-1).reps === 3, `${edited.exercises[0].sets.length} sets`);
  await p.click('button:has-text("Log a past session")');
  await p.click('.sheet-foot button:has-text("Continue")');
  await p.waitForSelector('.workout'); await p.waitForTimeout(450);
  await p.click('.workout button:has-text("Add exercise")');
  await p.fill('input[aria-label="Search exercises"]', 'Deadlift');
  await p.click('.sheet .row:has-text("Deadlift") >> nth=0');
  await p.waitForTimeout(450);
  await p.locator('.workout input[aria-label*="set 1 weight"]').fill('140');
  await p.locator('.workout input[aria-label*="set 1 reps"]').fill('5');
  await p.click('.workout-foot button:has-text("Save changes")');
  await p.waitForTimeout(400);
  st = await exportState(p);
  const yday = new Date(Date.now() - 86400000); const yIso = `${yday.getFullYear()}-${String(yday.getMonth() + 1).padStart(2, '0')}-${String(yday.getDate()).padStart(2, '0')}`;
  ok('Chloe/Sophie: a past session is logged on yesterday', st.workouts.some((w) => w.date === yIso && w.exercises.some((e) => e.exerciseId === 'x-deadlift' && e.sets[0].weight === 140)));
  await ctx.close();

  // --- Ravi/Liam: editing a food never rewrites past entries
  ({ ctx, p } = await fresh());
  await load(p, seed);
  await p.click('.tab:has-text("Food")');
  await p.click('.block button:has-text("Log food")');
  await p.fill('input[aria-label="Search foods"]', 'Ravi bar');
  await p.click('button:has-text("Create")');
  const ff = p.locator('.sheet .grid-2 input');
  await ff.nth(0).fill('400'); await ff.nth(1).fill('20'); await ff.nth(2).fill('50'); await ff.nth(3).fill('13');
  await p.click('button:has-text("Save food")');
  await p.click('button:has-text("Add to log")');
  await p.click('.block button:has-text("Log food")');
  await p.fill('input[aria-label="Search foods"]', 'Ravi bar');
  await p.click('.sheet .row:has-text("Ravi bar")');
  await p.click('button:has-text("Edit this food")');
  const ff2 = p.locator('.sheet .grid-2 input');
  await ff2.nth(0).fill('200'); await ff2.nth(1).fill('10'); await ff2.nth(2).fill('25'); await ff2.nth(3).fill('6');
  await p.click('button:has-text("Save changes")');
  await p.click('.sheet button[aria-label="Close"]');
  await p.click('.row:has-text("Ravi bar") >> nth=0');
  ok('Ravi: an old entry still shows what was logged (400 kcal)', (await p.locator('.sheet .macro-strip .v').first().innerText()) === '400', await p.locator('.sheet .macro-strip .v').first().innerText());
  await p.click('.sheet-foot button:has-text("Save")');
  st = await exportState(p);
  ok('Ravi: saving the old entry keeps 400 kcal', st.entries.some((e) => e.name === 'Ravi bar' && Math.round(e.macros.kcal) === 400));

  // --- Nadia: changing targets does not change past days
  await p.click('.tab:has-text("Food")');
  await p.click('button[aria-label="Previous day"]');
  const yLeft = await p.locator('.fuel-hero .big').innerText();
  await p.click('.tab:has-text("Setup")');
  const kc = p.locator('section:has-text("Daily targets") input').first();
  await kc.fill('3000');
  await p.waitForTimeout(200);
  await p.click('.tab:has-text("Food")');
  await p.click('button[aria-label="Previous day"]');
  ok('Nadia: yesterday is judged against yesterday\'s target', (await p.locator('.fuel-hero .big').innerText()) === yLeft, `${yLeft} → ${await p.locator('.fuel-hero .big').innerText()}`);
  await p.click('.tab:has-text("Setup")');
  await kc.click(); await kc.press('Control+a'); await p.keyboard.press('Backspace'); await kc.press('Tab');
  await p.waitForTimeout(200);
  st = await exportState(p);
  ok('Amelia: emptying a target field keeps the old target', st.settings.targets.kcal === 3000, String(st.settings.targets.kcal));
  await ctx.close();

  // --- Bea/Tariq/Dev: search tolerates slips and plurals; cooked before raw
  ({ ctx, p } = await fresh());
  await p.goto(URL0 + '#/food'); await p.waitForSelector('.masthead');
  await p.click('.block button:has-text("Log food")');
  const firstHit = async (q) => { await p.fill('input[aria-label="Search foods"]', q); await p.waitForTimeout(150); return (await p.locator('.sheet .row-title').first().innerText().catch(() => '(none)')); };
  const hits = {};
  for (const q of ['chiken', 'brocoli', 'yoghurt', 'humus', 'eggs', '2 eggs', 'bananas', 'rice', 'chicken', 'oat milk', 'falafel', 'paneer']) hits[q] = await firstHit(q);
  ok('Bea: misspellings find the food', /chicken/i.test(hits.chiken) && /broccoli/i.test(hits.brocoli) && /yogurt/i.test(hits.yoghurt) && /hummus/i.test(hits.humus), JSON.stringify(hits).slice(0, 160));
  ok('Tariq: plurals and amounts find the food', /egg/i.test(hits.eggs) && /egg/i.test(hits['2 eggs']) && /banana/i.test(hits.bananas));
  ok('Dev: "rice" and "chicken" list cooked first', /cooked/i.test(hits.rice) && /cooked/i.test(hits.chicken), `${hits.rice} / ${hits.chicken}`);
  ok('Zoe/Yazid/Priya: new staples exist', /oat milk/i.test(hits['oat milk']) && /falafel/i.test(hits.falafel) && /paneer/i.test(hits.paneer));
  await p.fill('input[aria-label="Search foods"]', 'Milk, whole');
  await p.click('.sheet .row:has-text("Milk, whole")');
  ok('Julia: milk is measured in ml', await p.locator('.sheet .input-unit span:has-text("ml")').first().isVisible());
  await ctx.close();

  // --- Kim/Zoe/Chris: barcode values that do not add up are reviewed first
  ({ ctx, p } = await fresh());
  await p.route('https://world.openfoodfacts.org/**', (r) => {
    const u = r.request().url();
    if (u.includes('/111')) return r.fulfill({ json: { status: 1, product: { product_name: 'Tempeh Zero', nutriments: { 'energy-kcal_100g': 0, proteins_100g: 19, carbohydrates_100g: 9, fat_100g: 11 } } } });
    if (u.includes('/222')) return r.fulfill({ json: { status: 1, product: { product_name: 'Hummus kJ', nutriments: { 'energy-kcal_100g': 1100, proteins_100g: 8, carbohydrates_100g: 14, fat_100g: 10 } } } });
    if (u.includes('/333')) return r.fulfill({ json: { status: 1, product: { product_name: 'Serving Bar', serving_quantity: 40, nutriments: { 'energy-kcal_serving': 160, proteins_serving: 8, carbohydrates_serving: 20, fat_serving: 5 } } } });
    return r.abort();
  });
  await p.goto(URL0 + '#/food'); await p.waitForSelector('.masthead');
  const scan = async (code) => {
    await p.click('.block button:has-text("Log food")');
    await p.click('.seg button:has-text("Barcode")');
    await p.fill('input[aria-label="Barcode number"]', code);
    await p.click('button:has-text("Look up")');
    await p.waitForTimeout(700);
  };
  await scan('11100000');
  ok('Zoe: 0 kcal with real macros goes to review with energy filled in', await p.locator('text=Check these values').isVisible() && (await p.locator('.sheet .grid-2 input').first().inputValue()) === '211', await p.locator('.sheet .grid-2 input').first().inputValue());
  await p.click('.sheet button[aria-label="Close"]');
  await scan('22200000');
  ok('Kim: 1,100 kcal per 100 g (kJ as kcal) goes to review, converted', await p.locator('text=Check these values').isVisible() && (await p.locator('.sheet .grid-2 input').first().inputValue()) === '263', await p.locator('.sheet .grid-2 input').first().inputValue());
  await p.click('.sheet button[aria-label="Close"]');
  await scan('33300000');
  ok('Kim/Pedro: per-serving-only product is converted to per 100 g', await p.locator('.food-title').isVisible() && (await p.locator('.session-meta').first().innerText()).includes('400 kcal'), await p.locator('.session-meta').first().innerText().catch(() => ''));
  await ctx.close();

  // --- Patrick: two tabs no longer overwrite each other
  ({ ctx, p } = await fresh());
  await load(p, seed);
  const p2 = await ctx.newPage(); human(p2);
  await p2.goto(URL0 + '#/food'); await p2.waitForSelector('.masthead');
  await p.click('.tab:has-text("Food")');
  await p.click('.block button:has-text("Log food")');
  await p.click('.seg button:has-text("Quick")');
  await p.fill('.sheet input[placeholder="e.g. Lunch out"]', 'Tab A meal');
  await p.locator('.sheet .grid-2 input').first().fill('500');
  await p.click('button:has-text("Add to log")');
  await p.waitForTimeout(600);
  await p2.bringToFront(); await p2.waitForTimeout(400);
  await p2.click('.block button:has-text("Log food")');
  await p2.click('.seg button:has-text("Quick")');
  await p2.fill('.sheet input[placeholder="e.g. Lunch out"]', 'Tab B meal');
  await p2.locator('.sheet .grid-2 input').first().fill('300');
  await p2.click('button:has-text("Add to log")');
  await p2.waitForTimeout(600);
  st = await exportState(p2);
  ok('Patrick: entries from both tabs are kept', st.entries.some((e) => e.name === 'Tab A meal') && st.entries.some((e) => e.name === 'Tab B meal'));

  // --- Zara: a change made right before closing survives
  await p.bringToFront();
  await p.click('.block button:has-text("Log food")');
  await p.click('.seg button:has-text("Quick")');
  await p.fill('.sheet input[placeholder="e.g. Lunch out"]', 'Instant close');
  await p.locator('.sheet .grid-2 input').first().fill('111');
  await p.click('button:has-text("Add to log")');
  await p.reload(); // immediately
  await p.waitForSelector('.masthead');
  await p.click('.tab:has-text("Food")');
  ok('Zara: an entry added just before reload is still there', await p.locator('.row:has-text("Instant close")').isVisible());
  await ctx.close();

  // --- Jonas: reminders
  const s4 = clone(seed);
  s4.state.reminders = Array.from({ length: 6 }, (_, i) => ({ id: 'r' + i, kind: 'custom', title: 'Reminder ' + i, time: `0${i}:0${i}`, days: [0, 1, 2, 3, 4, 5, 6], enabled: true }));
  ({ ctx, p } = await fresh());
  await load(p, s4);
  await p.click('.tab:has-text("Today")');
  ok('Jonas: at most 2 banners, plus "more" and "Dismiss all"', (await p.locator('.banner').count()) === 2 && (await p.locator('button:has-text("Dismiss all")').isVisible()));
  await p.click('button:has-text("Dismiss all")');
  ok('Jonas: "Dismiss all" clears them', (await p.locator('.banner').count()) === 0);
  await p.click('.tab:has-text("Setup")');
  await p.click('.row-main:has-text("Reminder 0")');
  await p.fill('.sheet input.input >> nth=0', 'Renamed reminder');
  await p.click('.sheet-foot button:has-text("Save")');
  await p.click('.tab:has-text("Today")');
  ok('Jonas: renaming a dismissed reminder does not bring it back', (await p.locator('.banner').count()) === 0);
  await ctx.close();

  // --- Aisha/Carlos: start of day; Selin: Food follows midnight
  ({ ctx, p } = await fresh());
  await p.clock.install({ time: new Date('2026-11-20T01:30:00') });
  await load(p, null);
  await p.selectOption('select[aria-label="When your day starts"]', '4');
  await p.click('.tab:has-text("Food")');
  ok('Aisha: at 01:30 with a 04:00 day start, Food shows the evening before as today', (await p.locator('.masthead h1').innerText()).toUpperCase() === 'TODAY' && (await p.evaluate(() => 1)) === 1);
  await p.click('.block button:has-text("Log food")');
  await p.click('.seg button:has-text("Quick")');
  await p.fill('.sheet input[placeholder="e.g. Lunch out"]', 'Suhoor');
  await p.locator('.sheet .grid-2 input').first().fill('600');
  await p.click('button:has-text("Add to log")');
  st = await exportState(p);
  ok('Aisha: a 01:30 meal is filed under the day before (19 Nov)', st.entries.find((e) => e.name === 'Suhoor')?.date === '2026-11-19', st.entries.find((e) => e.name === 'Suhoor')?.date);
  await ctx.close();

  // --- Tess: near-duplicate exercise names; Sara: word-start matching
  ({ ctx, p } = await fresh());
  await p.goto(URL0 + '#/train'); await p.waitForSelector('.masthead');
  await p.click('button:has-text("Just log a workout")');
  await p.waitForSelector('.workout'); await p.waitForTimeout(450);
  await p.click('.workout button:has-text("Add exercise")');
  await p.fill('input[aria-label="Search exercises"]', 'Bench  Press.');
  ok('Tess: "Bench  Press." is recognised as the existing exercise', !(await p.locator('.sheet button:has-text("Create")').isVisible()));
  await p.fill('input[aria-label="Search exercises"]', 'run');
  ok('Sara: "run" no longer lists Cable Crunch', !(await p.locator('.sheet .row-title:has-text("Cable Crunch")').isVisible()));
  ok('Fatima: a workout can be logged without building a plan first', (await p.locator('.workout').count()) === 1);
  await ctx.close();

  // --- Paolo: blocked storage is reported
  ({ ctx, p } = await fresh());
  await p.addInitScript(() => {
    indexedDB.open = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
  });
  await p.goto(URL0 + '#/today'); await p.waitForSelector('.masthead');
  await p.click('button:has-text("Log weight")');
  await p.fill('.sheet input.input >> nth=0', '77.7');
  await p.click('button:has-text("Save weight")');
  await p.waitForTimeout(500);
  ok('Paolo: a warning says data is not being saved', await p.locator('text=This browser is not saving your data').isVisible());
  await ctx.close();

  // --- Lina/Omar: first-run targets
  ({ ctx, p } = await fresh());
  await p.goto(URL0); await p.waitForSelector('.masthead');
  ok('Lina: no calorie target is shown before the questions', (await p.locator('.rail-track').count()) === 0 && (await p.locator('button:has-text("Set my calorie target")').isVisible()));
  await p.click('button:has-text("Set my calorie target")');
  await p.click('.sheet button:has-text("Female")');
  const tf = p.locator('.sheet .grid-2 input');
  await tf.nth(0).fill('19'); await tf.nth(1).fill('165');
  await p.locator('.sheet input[aria-label]').filter({ hasText: '' }).first();
  await p.fill('.sheet .field:has-text("Weight") input', '58');
  await p.click('.sheet button:has-text("Lose fat")');
  const kcalTxt = await p.locator('.sheet .macro-strip .v').first().innerText();
  await p.click('button:has-text("Use these targets")');
  st = await exportState(p);
  ok('Lina: calculator gives her own targets (not 2,400)', st.settings.targets.kcal !== 2400 && st.settings.targets.kcal > 1200 && st.settings.targets.kcal < 2200, `${kcalTxt} → ${st.settings.targets.kcal} kcal, ${st.settings.targets.p} g protein`);
  ok('Lina: targets appear after the questions', (await p.locator('.rail-track').count()) === 3);

  // --- Ian: emoji names are not cut in half in the week strip
  await p.click('.tab:has-text("Train")');
  await p.click('button:has-text("Push / Pull / Legs")');
  await p.click('section:has-text("Training days") .row:has-text("Push")');
  await p.fill('.sheet input.input >> nth=0', '💪🏽💪🏽💪🏽 day');
  await p.click('.sheet-foot button:has-text("Done")');
  await p.click('.tab:has-text("Today")');
  ok('Ian: no broken characters in the week strip', !(await p.locator('.week').innerText()).includes('�'));

  // --- Leo: easier-to-read text
  await p.click('.tab:has-text("Setup")');
  const tt = await p.evaluate(() => getComputedStyle(document.querySelector('.label')).textTransform);
  ok('Leo: no spaced capitals anywhere (plain text by default)', tt === 'none', tt);

  // --- George/Ella: tap targets
  const small = await p.evaluate(() => [...document.querySelectorAll('.link, .chip, .seg button, .btn')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => e.textContent.trim().slice(0, 20)));
  ok('George: links, chips and buttons are at least 44 px tall on Setup', small.length === 0, small.slice(0, 5).join(', '));
  await ctx.close();

  // --- Hiro: forced colours keep state visible
  ({ ctx, p } = await fresh());
  await p.emulateMedia({ forcedColors: 'active' });
  await p.goto(URL0 + '#/settings'); await p.waitForSelector('.masthead');
  const sw = await p.evaluate(() => { const e = document.querySelector('.seg button[aria-pressed="true"]'); return getComputedStyle(e).borderTopStyle; });
  ok('Hiro: selected segment has a visible border in forced colours', sw === 'solid', sw);
  await ctx.close();

  // --- Oscar: older hand-edited backups are read, not dropped
  ({ ctx, p } = await fresh());
  await load(p, { workouts: [{ id: 'o1', name: 'Old', date: '2026-10-01', startedAt: 1759300000000, finishedAt: 1759303600000, exercises: [{ exerciseId: 'x-squat', sets: [{ weight: '80', reps: '5', done: 'yes' }, { weight: 70, reps: 5, done: false }] }] }],
    bodyWeights: [{ date: '2026-10-01', kg: '81,5' }], reminders: [{ id: 'm', title: 'Weigh', time: '7:30', days: [0], enabled: true }], settings: { targets: { kcal: '2500' } } });
  st = await exportState(p);
  const os = st.workouts[0]?.exercises[0]?.sets;
  ok('Oscar: numbers written as text are read', os?.length === 1 && os[0].weight === 80 && os[0].reps === 5 && st.bodyWeights[0]?.kg === 81.5 && st.settings.targets.kcal === 2500, JSON.stringify(os));
  ok('Oscar: "7:30" reminder kept as 07:30', st.reminders[0]?.time === '07:30');
  ok('Oscar: a file without food entries is accepted', st.workouts.length === 1);

  ok('no page errors in this run', true);
  console.log(out.join('\n'));
  await b.close();
})().catch((e) => { console.log(out.join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 600)); process.exit(1); });
