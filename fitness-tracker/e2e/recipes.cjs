// Recipes: build "100 g rice + 150 g chicken", log portions, check the numbers, log it again.
const { chromium } = require('playwright');
const out = [];
const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  [' + x + ']' : ''}`);
const URL0 = 'http://localhost:4173/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const c = p.click.bind(p); p.click = async (...a) => { await p.waitForTimeout(420); return c(...a); };
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const db = () => p.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('keyval-store'); r.onsuccess = () => { const g = r.result.transaction('keyval').objectStore('keyval').get('logbook.state'); g.onsuccess = () => res(g.result); };
  }));
  await p.goto(URL0 + '#/food'); await p.waitForSelector('.masthead');

  // build the recipe
  await p.click('.block button:has-text("Log food")');
  await p.click('.seg button:has-text("Recipes")');
  await p.click('button:has-text("New recipe")');
  await p.fill('.sheet input.input >> nth=0', 'Chicken and rice');
  await p.fill('.sheet .field:has-text("Portions it makes") input', '2');
  const addIngredient = async (q, name, grams) => {
    await p.click('.sheet button:has-text("Add ingredient")');
    await p.fill('input[aria-label="Search ingredients"]', q);
    await p.click(`.sheet .row:has-text("${name}") >> nth=0`);
    await p.fill('.sheet .field:has-text("Amount in the whole recipe") input', String(grams));
    await p.click('.sheet button:has-text("Add to recipe")');
  };
  await addIngredient('rice', 'Rice, white, cooked', 100);
  await addIngredient('chicken', 'Chicken breast, cooked', 150);
  const rows = await p.locator('.sheet .ingredient-row .row-title').allInnerTexts();
  ok('both ingredients are in the recipe', rows.length === 2 && /Rice/.test(rows[0]) && /Chicken/.test(rows[1]), rows.join(', '));
  // 130 + 247.5 = 377.5 kcal total; 188.75 per portion
  const perPortionKcal = await p.locator('.sheet .macro-strip .v').first().innerText();
  ok('per-portion calories are right (189)', perPortionKcal === '189', perPortionKcal);
  ok('whole-recipe calories shown (378)', await p.locator('.sheet >> text=whole recipe 378 kcal').isVisible());
  await p.click('button:has-text("Save recipe")');

  // log 1 portion
  await p.waitForSelector('text=Makes 2 portions');
  ok('saving goes straight to logging it', await p.locator('.sheet .field:has-text("Portions") input').isVisible());
  await p.click('button:has-text("Add to log")');
  await p.waitForTimeout(300);
  let st = await db();
  const e1 = st.entries.find((e) => e.recipeId);
  ok('1 portion is logged with the right values', e1 && Math.round(e1.macros.kcal) === 189 && Math.abs(e1.macros.p - 24.6) < 0.01 && e1.portions === 1, JSON.stringify(e1?.macros));
  ok('the log row shows it as a portion', await p.locator('.row:has-text("Chicken and rice") .row-sub:has-text("1 portion")').isVisible());

  // log again later: 1½ portions from the saved list
  await p.click('.block button:has-text("Log food")');
  await p.click('.seg button:has-text("Recipes")');
  ok('saved recipe is listed with calories per portion', (await p.locator('.sheet .row:has-text("Chicken and rice") .row-end').innerText()).startsWith('189'));
  await p.click('.sheet .row:has-text("Chicken and rice")');
  await p.click('.sheet .chip:has-text("1½")');
  await p.click('button:has-text("Add to log")');
  await p.waitForTimeout(300);
  st = await db();
  const recipeEntries = st.entries.filter((e) => e.recipeId);
  ok('logging it again adds 1½ portions (283 kcal)', recipeEntries.length === 2 && Math.round(recipeEntries[1].macros.kcal) === 283, recipeEntries.map((e) => Math.round(e.macros.kcal)).join(', '));

  // edit portions on an entry
  await p.click('.row:has-text("Chicken and rice") >> nth=0');
  await p.fill('.sheet .field:has-text("Portions") input', '2');
  await p.click('.sheet-foot button:has-text("Save")');
  await p.waitForTimeout(300);
  st = await db();
  const edited = st.entries.filter((e) => e.recipeId)[0];
  ok('an entry can be changed to 2 portions (378 kcal)', edited.portions === 2 && Math.round(edited.macros.kcal) === 378, `${edited.portions} / ${Math.round(edited.macros.kcal)}`);

  // editing the recipe does not change what was already logged
  await p.click('.block button:has-text("Log food")');
  await p.click('.seg button:has-text("Recipes")');
  await p.click('.sheet .row:has-text("Chicken and rice")');
  await p.click('button:has-text("Edit recipe")');
  await p.fill('.sheet .field:has-text("Portions it makes") input', '4');
  await p.click('button:has-text("Save recipe")');
  await p.waitForTimeout(300);
  st = await db();
  ok('editing the recipe keeps past entries unchanged', Math.round(st.entries.filter((e) => e.recipeId)[0].macros.kcal) === 378 && st.recipes[0].portions === 4);
  await p.click('.sheet button[aria-label="Close"]');

  // scanning is one tap from the Food screen
  await p.click('button:has-text("Scan barcode")');
  ok('"Scan barcode" opens Log food on the barcode scanner', await p.locator('.seg button[aria-pressed="true"]:has-text("Barcode")').isVisible() && await p.locator('.viewfinder').isVisible());
  await p.click('.sheet button[aria-label="Close"]');

  // delete with undo
  await p.click('.block button:has-text("Log food")');
  await p.click('.seg button:has-text("Recipes")');
  await p.click('.sheet .row:has-text("Chicken and rice")');
  await p.click('button:has-text("Edit recipe")');
  await p.click('.sheet button:has-text("Delete recipe")');
  await p.click('.sheet .btn.danger:has-text("Delete recipe")');
  await p.waitForTimeout(300);
  st = await db();
  ok('a recipe can be deleted; logged meals stay', st.recipes.length === 0 && st.entries.filter((e) => e.recipeId).length === 2);
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})().catch((e) => { console.log(out.join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 500)); process.exit(1); });
