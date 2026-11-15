// Barcode (against a stand-in database response) and nutrition-label OCR (real engine, generated label images).
const { chromium } = require('playwright');
const S = require('path').join(__dirname, '.out'); // scratch files and screenshots (git-ignored)
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`);

const labelHTML = (kind) => kind === 'eu' ? `
<body style="margin:0;background:#fff;font-family:Helvetica,Arial,sans-serif;padding:28px;width:560px">
<h2 style="margin:0 0 8px">Nutrition Information</h2>
<table style="border-collapse:collapse;width:100%;font-size:22px">
<tr style="border-bottom:2px solid #000"><th align="left">Typical values</th><th align="right">Per 100g</th><th align="right">Per 30g serving</th></tr>
<tr style="border-bottom:1px solid #999"><td>Energy</td><td align="right">1569kJ / 372kcal</td><td align="right">471kJ / 112kcal</td></tr>
<tr style="border-bottom:1px solid #999"><td>Fat</td><td align="right">6.5g</td><td align="right">2.0g</td></tr>
<tr style="border-bottom:1px solid #999"><td>of which saturates</td><td align="right">1.2g</td><td align="right">0.4g</td></tr>
<tr style="border-bottom:1px solid #999"><td>Carbohydrate</td><td align="right">62g</td><td align="right">19g</td></tr>
<tr style="border-bottom:1px solid #999"><td>of which sugars</td><td align="right">1.0g</td><td align="right">0.3g</td></tr>
<tr style="border-bottom:1px solid #999"><td>Protein</td><td align="right">12g</td><td align="right">3.6g</td></tr>
<tr><td>Salt</td><td align="right">0.02g</td><td align="right">0.01g</td></tr></table></body>` : `
<body style="margin:0;background:#fff;font-family:Helvetica,Arial,sans-serif;padding:24px;width:420px">
<div style="border:3px solid #000;padding:10px">
<div style="font-size:44px;font-weight:900">Nutrition Facts</div>
<div style="font-size:20px">8 servings per container</div>
<div style="font-size:24px;font-weight:700;border-bottom:10px solid #000">Serving size 2/3 cup (55g)</div>
<div style="font-size:40px;font-weight:900;border-bottom:5px solid #000">Calories 230</div>
<div style="font-size:22px;line-height:1.5"><b>Total Fat</b> 8g<br>Saturated Fat 1g<br><i>Trans</i> Fat 0g<br><b>Cholesterol</b> 0mg<br><b>Sodium</b> 160mg<br><b>Total Carbohydrate</b> 37g<br>Dietary Fiber 4g<br>Total Sugars 12g<br><b>Protein</b> 3g</div></div></body>`;

(async () => {
  const b = await chromium.launch();
  // render label photos
  for (const kind of ['eu', 'us']) {
    const pg = await b.newPage({ viewport: { width: 620, height: 500 }, deviceScaleFactor: 2 });
    await pg.setContent(labelHTML(kind));
    await pg.locator('body').screenshot({ path: `${S}/label-${kind}.png` });
    await pg.close();
  }
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const _click = p.click.bind(p); p.click = async (...a) => { await p.waitForTimeout(380); return _click(...a); };
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await p.route('https://world.openfoodfacts.org/**', (route) => {
    const u = route.request().url();
    if (u.includes('/5000000000001')) return route.fulfill({ json: { status: 1, product: { product_name: 'Test Oat Bar', brands: 'Acme,Other', serving_quantity: '40', nutriments: { 'energy-kcal_100g': 412, proteins_100g: 9.5, carbohydrates_100g: 58, fat_100g: 15 } } } });
    if (u.includes('/5000000000002')) return route.fulfill({ json: { status: 1, product: { product_name: 'Mystery Sauce', nutriments: {} } } });
    if (u.includes('/5000000000003')) return route.fulfill({ status: 404, json: { status: 0 } });
    return route.abort();
  });
  // Barcode and label scanning are frozen behind the off-by-default Experimental switch.
  await p.goto('http://localhost:4173/#/settings'); await p.waitForSelector('.masthead'); await p.click('button[aria-label="Experimental features"]'); await p.waitForTimeout(300);
  await p.goto('http://localhost:4173/#/food');
  await p.waitForSelector('.masthead');
  const openBarcode = async (code) => {
    await p.click('.block button:has-text("Log food")');
    await p.click('.seg button:has-text("Barcode")');
    await p.fill('input[aria-label="Barcode number"]', code);
    await p.click('button:has-text("Look up")');
  };
  await openBarcode('5000000000001');
  await p.waitForSelector('.food-title');
  ok('barcode found: product name shown', (await p.locator('.food-title').innerText()).toUpperCase() === 'TEST OAT BAR');
  ok('barcode found: amount defaults to the serving (40 g)', (await p.locator('.sheet input.input').first().inputValue()) === '40');
  ok('barcode found: 40 g = 165 kcal', (await p.locator('.macro-strip .v').first().innerText()) === '165');
  await p.click('button:has-text("Add to log")');
  ok('barcode food is logged', await p.locator('.row:has-text("Test Oat Bar")').isVisible());
  await openBarcode('5000000000001');
  ok('second scan of the same barcode works from the saved copy', await p.locator('.food-title').isVisible());
  await p.click('.sheet button[aria-label="Close"]');
  await openBarcode('5000000000002');
  await p.waitForSelector('text=without protein, carbs or fat');
  ok('product without macros: says so and offers the label scan', await p.locator('text=without protein, carbs or fat').isVisible() && await p.locator('button:has-text("Scan the nutrition label")').isVisible());
  await p.click('button:has-text("Scan the nutrition label")');

  // label OCR, EU-style, carried from the barcode
  const t0 = Date.now();
  await p.setInputFiles('input[data-testid="label-file"]', `${S}/label-eu.png`);
  await p.waitForSelector('text=Check the label values', { timeout: 120000 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const vals = await p.locator('.sheet .grid-2 input').evaluateAll((els) => els.map((e) => e.value));
  ok('EU label: energy/protein/carbs/fat read as 372/12/62/6.5', vals.join('/') === '372/12/62/6.5', `got ${vals.join('/')} in ${secs}s`);
  ok('EU label: name carried over from the barcode', (await p.locator('.sheet input.input').first().inputValue()) === 'Mystery Sauce');
  ok('EU label: review note shown', await p.locator('.note').isVisible(), (await p.locator('.note').innerText()).slice(0, 120));
  await p.screenshot({ path: S + '/shots/12-label-review.png' });
  await p.click('button:has-text("Save food")');
  await p.waitForSelector('.food-title');
  await p.click('button:has-text("Add to log")');
  ok('label food is logged', await p.locator('.row:has-text("Mystery Sauce")').isVisible());
  await openBarcode('5000000000002');
  await p.waitForTimeout(500);
  ok('label values are remembered against that barcode', await p.locator('.food-title').isVisible());
  await p.click('.sheet button[aria-label="Close"]');

  // label OCR, US-style
  await p.click('.block button:has-text("Log food")');
  await p.click('.seg button:has-text("Label")');
  await p.setInputFiles('input[data-testid="label-file"]', `${S}/label-us.png`);
  await p.waitForSelector('text=Check the label values', { timeout: 120000 });
  const us = await p.locator('.sheet .grid-2 input').evaluateAll((els) => els.map((e) => e.value));
  ok('US label: converted to per 100 g (418/5.5/67.3/14.5)', us.join('/') === '418/5.5/67.3/14.5', `got ${us.join('/')}`);
  await p.click('.sheet button[aria-label="Close"]');

  // not found + unreachable
  await openBarcode('5000000000003');
  await p.waitForSelector('text=not in the database');
  ok('unknown barcode: says not in the database', await p.locator('text=not in the database').isVisible());
  await p.click('.sheet button[aria-label="Close"]');
  await openBarcode('5000000000004');
  await p.waitForSelector('.sheet .error', { timeout: 20000 });
  ok('database unreachable: shows an error and a retry', await p.locator('button:has-text("Try again")').isVisible(), await p.locator('.sheet .error').innerText());

  ok('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  console.log(out.join('\n'));
  await b.close();
})().catch((e) => { console.log(out.join('\n')); console.error('SCRIPT ERROR', e.message.slice(0, 700)); process.exit(1); });
