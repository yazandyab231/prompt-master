// Runs every browser check against a production build.
//   npm run e2e            build, serve on port 4173, run all suites
//   npm run e2e -- flow    run only the named suites
// Each suite prints one "PASS  ..." or "FAIL  ..." line per check. The run fails if any check fails,
// a suite crashes, or a suite prints fewer checks than expected (a silently skipped check is a failure too).
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SUITES = { flow: 33, scan: 15, regress: 23, regress2: 47, newfeat: 10, labels: 23, recipes: 13 };
const PORT = 4173;
const root = path.join(__dirname, '..');
const only = process.argv.slice(2);
const chosen = only.length ? only : Object.keys(SUITES);

fs.mkdirSync(path.join(__dirname, '.out', 'shots'), { recursive: true });
spawnSync(process.execPath, [path.join(__dirname, 'make-seed.cjs')], { stdio: 'inherit' });

const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server did not start on port ${PORT}`);
}

function runSuite(name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, name + '.cjs')], { cwd: __dirname });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 15 * 60_000);
    child.on('close', () => {
      clearTimeout(timer);
      fs.writeFileSync(path.join(__dirname, '.out', name + '.log'), out);
      const pass = (out.match(/^PASS /gm) || []).length;
      const fail = out.split('\n').filter((l) => l.startsWith('FAIL ') || l.startsWith('SCRIPT ERROR'));
      resolve({ name, pass, fail, expected: SUITES[name] });
    });
  });
}

(async () => {
  let ok = true;
  try {
    await waitForServer();
    for (const name of chosen) {
      if (!(name in SUITES)) {
        console.log(`unknown suite: ${name}`);
        ok = false;
        continue;
      }
      const r = await runSuite(name);
      const short = r.pass < r.expected;
      const good = r.fail.length === 0 && !short;
      ok &&= good;
      console.log(`${good ? 'ok  ' : 'FAIL'} ${name}: ${r.pass}/${r.expected} passed${short && !r.fail.length ? ' (checks missing)' : ''}`);
      for (const l of r.fail.slice(0, 5)) console.log('     ' + l);
    }
  } catch (e) {
    console.log('FAIL', e.message);
    ok = false;
  } finally {
    server.kill();
  }
  console.log(ok ? '\nAll browser checks passed.' : '\nSome browser checks failed. Full logs: e2e/.out/*.log');
  process.exit(ok ? 0 : 1);
})();
