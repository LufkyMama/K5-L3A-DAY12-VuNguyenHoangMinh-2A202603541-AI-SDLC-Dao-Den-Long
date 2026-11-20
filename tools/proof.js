// One command to regenerate phase evidence:  npm run proof
// Runs the unit/behaviour tests, the named headless scenarios (through the real CLI),
// an autopilot full-night replay, a determinism check and a speed measurement,
// then writes docs/proof/phase-<N>/REPORT.md. PASS/FAIL is computed, never typed by hand.
import { spawnSync, execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autopilot } from './autopilot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHASE = process.argv[2] || '1';
const OUT = path.join(ROOT, 'docs', 'proof', `phase-${PHASE}`);
const RUNS = path.join(OUT, 'runs');
fs.mkdirSync(RUNS, { recursive: true });
const SC = path.join(ROOT, 'tests', 'scenarios');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
const [cmd, ...cmdArgs] = contract.headless_cmd.split(' ');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function headless(name, { seed = 1, ticks, scenario, inputs, every = 60 }) {
  const out = path.join(RUNS, `${name}.jsonl`);
  const args = [...cmdArgs, '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario) args.push('--scenario', scenario);
  if (inputs) args.push('--inputs', inputs);
  const t0 = performance.now();
  const p = spawnSync(cmd === 'node' ? process.execPath : cmd, args, { cwd: ROOT, encoding: 'utf8' });
  const ms = performance.now() - t0;
  const text = fs.readFileSync(out, 'utf8');
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));
  const shown = `${contract.headless_cmd} ${args.slice(cmdArgs.length).map((a) => (path.isAbsolute(a) ? rel(a) : a)).join(' ')}`;
  return { code: p.status, stderr: p.stderr, text, lines, ms, cmd: shown, out,
    events: lines.filter((l) => l.type === 'event'), snaps: lines.filter((l) => l.type === 'snapshot'), end: lines.at(-1) };
}
const ev = (r, n) => r.events.filter((e) => e.name === n);
const f = (n) => path.join(SC, n);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

const rows = [];
function check(req, name, opts, expectText, pred) {
  const r = headless(name, opts);
  let ok = false, err = '';
  try { ok = r.code === 0 && !!pred(r); } catch (e) { err = e.message; }
  const key = r.events.slice(0, 6).map((e) => `t${e.tick} ${e.name} ${JSON.stringify(e.data)}`).join('<br>');
  rows.push({ req, name, cmd: r.cmd, expect: expectText, got: `${key}${r.events.length > 6 ? `<br>… (${r.events.length} events)` : ''}<br>end: ${JSON.stringify(r.end)}${err}`, ok, file: rel(r.out) });
  return r;
}

// ---- named scenarios ----
check('Movement + auto pickup (contract example files)', 's01-walk-pickup',
  { ticks: 300, scenario: f('s01-walk-pickup.scenario.json'), inputs: f('s01-walk-pickup.inputs.json') },
  'mote_picked at t38 (5 m − 1.2 m radius at 6 m/s), carried 1; no deposit (L1 out of range)',
  (r) => ev(r, 'mote_picked').length === 1 && ev(r, 'mote_picked')[0].tick === 38 && ev(r, 'deposit').length === 0);
check('Deposit lights a lantern, +per_lantern', 's02-deposit-light',
  { ticks: 10, scenario: f('s02-deposit-light.scenario.json'), inputs: f('s02-deposit-light.inputs.json'), every: 1 },
  'deposit L1 amount 5 → lantern_lit L1, score 100',
  (r) => ev(r, 'deposit')[0]?.data.amount === 5 && ev(r, 'lantern_lit')[0]?.data.lantern_id === 'L1' && r.end.score === 100);
check('Win when all 5 lit (all_lit), stops early', 's03-win-all-lit',
  { ticks: 600, scenario: f('s03-win-all-lit.scenario.json'), inputs: f('s03-win-all-lit.inputs.json') },
  'game_over won/all_lit at t31; end.ticks 31; score = 100 + 2×floor(300−31/60) + 50×3 = 848',
  (r) => ev(r, 'game_over')[0]?.data.reason === 'all_lit' && r.end.state === 'won' && r.end.ticks === 31 && r.end.score === 848);
check('Pulse stuns only shades within pulse_radius', 's04-pulse-stun',
  { ticks: 30, scenario: f('s04-pulse-stun.scenario.json'), inputs: f('s04-pulse-stun.inputs.json'), every: 1 },
  'pulse at t11 stunned_ids [S1] (S2 is 12 m away); carried 2→1',
  (r) => JSON.stringify(ev(r, 'pulse')[0]?.data.stunned_ids) === '["S1"]' && r.snaps.find((s) => s.tick === 11).player.carried === 1);
check('Shade contact drains flames → lose (no_flames)', 's05-shade-hits-loss',
  { ticks: 2000, scenario: f('s05-shade-hits-loss.scenario.json') },
  '3 player_hit (first drops all 4 carried), hits ≥ 90 ticks apart, then game_over lost/no_flames',
  (r) => { const h = ev(r, 'player_hit'); return h.length === 3 && h[0].data.dropped === 4 && h[1].tick - h[0].tick >= 90 && r.end.state === 'lost' && ev(r, 'game_over')[0].data.reason === 'no_flames'; });
check('Night ends at dawn (lost)', 's06-dawn',
  { ticks: 1000, scenario: f('s06-dawn.scenario.json') },
  'game_over lost/dawn at t120 (time_left_s 2)',
  (r) => ev(r, 'game_over')[0]?.tick === 120 && ev(r, 'game_over')[0].data.reason === 'dawn');
check('Shades cannot enter safe_radius of a lantern', 's07-safe-zone',
  { ticks: 1200, scenario: f('s07-safe-zone.scenario.json'), every: 1 },
  'over 1200 ticks: min shade–L1 distance ≥ 4, no player_hit',
  (r) => ev(r, 'player_hit').length === 0 && Math.min(...r.snaps.slice(1).flatMap((s) => s.shades.map((x) => dist(x.pos, [0, 0, 25])))) >= 4);

// ---- full default night: autopilot inputs replayed through the CLI ----
const AP_SEED = 1;
const ap = autopilot(AP_SEED);
const apFile = path.join(SC, `autopilot-seed${AP_SEED}.inputs.json`);
fs.writeFileSync(apFile, JSON.stringify({ frames: ap.frames }) + '\n');
const full = check('Night 1 playable start → win (default night, random motes + shades)', `autopilot-seed${AP_SEED}`,
  { seed: AP_SEED, ticks: 18000, inputs: apFile },
  `replay of recorded inputs ends won/all_lit; 5 lantern_lit; shade_spawned events present`,
  (r) => r.end.state === 'won' && ev(r, 'lantern_lit').length === 5 && ev(r, 'shade_spawned').length >= 1);
let wins = 0; const N = 20;
for (let s = 1; s <= N; s++) if (autopilot(s).state === 'won') wins++;

// ---- determinism ----
const a = headless('determinism-a', { seed: 42, ticks: 18000, inputs: apFile, every: 10 });
const b = headless('determinism-b', { seed: 42, ticks: 18000, inputs: apFile, every: 10 });
const c = headless('determinism-c', { seed: 43, ticks: 18000, inputs: apFile, every: 10 });
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
const det = { a: sha(a.text), b: sha(b.text), c: sha(c.text) };
for (const x of ['a', 'b', 'c']) fs.rmSync(path.join(RUNS, `determinism-${x}.jsonl`)); // large; hashes are enough
rows.push({ req: 'Determinism (same seed+inputs → identical output)', name: 'determinism', cmd: 'seed 42 ×2 and seed 43, 18000 ticks, --snapshot-every 10', expect: 'sha(a) = sha(b) ≠ sha(c)', got: `a=${det.a} b=${det.b} c=${det.c}`, ok: det.a === det.b && det.a !== det.c, file: '-' });

// ---- speed ----
const speed = headless('speed-full-night', { seed: 7, ticks: 18000, every: 10, scenario: f('s08-full-night-no-shades.scenario.json') });
fs.rmSync(speed.out);

// ---- unit/behaviour tests ----
const tests = spawnSync(process.execPath, ['--test', 'tests/*.test.js'], { cwd: ROOT, encoding: 'utf8' });
fs.writeFileSync(path.join(OUT, 'test-report.txt'), tests.stdout + tests.stderr);
const tsum = (tests.stdout.match(/ℹ (tests|pass|fail) \d+/g) || []).join(', ');

// ---- report ----
let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* not a git checkout */ }
const allOk = rows.every((r) => r.ok) && tests.status === 0;
const md = `# Phase ${PHASE} evidence report (generated by \`npm run proof\`)

- Generated: ${new Date().toISOString()} · base commit \`${commit}\` (the report is committed in the commit after it)
- Machine: ${os.type()} ${os.release()} · ${os.cpus()[0]?.model} · Node ${process.version}
- **Overall: ${allOk ? 'PASS' : 'FAIL'}**

## 1. Automated tests (\`npm test\`)

Exit code ${tests.status} · ${tsum}. Full output: [test-report.txt](test-report.txt)

## 2. Headless scenarios through the real CLI

Scenario/input files are in \`tests/scenarios/\`. Outputs are in \`runs/\`. Any row can be re-run with the command shown.

| Requirement | Command | Expected | Actual (key events) | Result |
|---|---|---|---|---|
${rows.map((r) => `| ${r.req} | \`${r.cmd}\` | ${r.expect} | ${r.got} | ${r.ok ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

## 3. Playability

- Autopilot (greedy bot in \`tools/autopilot.js\`) wins the default Night 1 on **${wins}/${N}** seeds (seeds 1..${N}).
- Seed ${AP_SEED} full run: ${full.end.state} after ${full.end.ticks} ticks (${(full.end.ticks / 60).toFixed(1)} s), score ${full.end.score}.

## 4. Speed

Full 300 s night with default fireflies, no shades (seed 7, 18000 ticks, snapshots every 10): ${speed.end.ticks} ticks in ${speed.ms.toFixed(0)} ms wall time including Node start-up (game ended: ${speed.end.state}).

## 5. GUI screenshots (headless Chrome, SwiftShader)

| File | Shows |
|---|---|
| [gui-start.png](gui-start.png) | Start screen with story + goal |
| [gui-play.png](gui-play.png) | Mây (nón lá + hat lantern), fireflies, HUD (flames, carried, lanterns, score, time to dawn, pulse) |
| [gui-shades.png](gui-shades.png) | Two Bóng Mực held at the edge of L1's safe circle (purple-black = danger) |
| [gui-lit3.png](gui-lit3.png) | 3/5 lanterns lit: island and sky visibly brighter, lit lantern glows warm orange |
`;
fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
console.log(`proof: ${allOk ? 'PASS' : 'FAIL'} → ${rel(path.join(OUT, 'REPORT.md'))}`);
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
console.log(`autopilot wins ${wins}/${N}; tests: ${tsum}`);
process.exit(allOk ? 0 : 1);
