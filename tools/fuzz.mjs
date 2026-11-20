// Seeded fuzzing of the REAL headless CLI (Ticket-04).  npm run fuzz [-- <n> <seed>]
// Valid random scenario+inputs → exit 0 and every invariant holds; deliberately malformed files → exit 2;
// a sample is run twice and must be byte-identical. Writes docs/proof/phase-4/fuzz.json when run as a script.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkRun } from './invariants.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANTERNS = { 1: 5, 2: 6 };

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function makeCase(r, i) {
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const num = (a, b) => Math.round((a + r() * (b - a)) * 100) / 100;
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const night = pick([1, 2]);
  const sc = {};
  if (r() < 0.8) {
    const ang = r() * Math.PI * 2, rad = r() * 36;
    sc.player = { pos: [num(-1, 1) + Math.sin(ang) * rad, 0, Math.cos(ang) * rad], carried: int(0, 6), flames: int(0, 4) };
    sc.player.pos = sc.player.pos.map((x) => Math.round(x * 100) / 100);
  }
  if (r() < 0.5) sc.random_motes = r() < 0.5;
  if (r() < 0.5) sc.random_shades = r() < 0.5;
  if (r() < 0.6) sc.motes = Array.from({ length: int(0, 12) }, () => [num(-38, 38), 0, num(-38, 38)]);
  if (r() < 0.6) sc.shades = Array.from({ length: int(0, 6) }, (_, k) => ({ ...(r() < 0.5 ? { id: `F${k}` } : {}), ...(night === 2 && r() < 0.5 ? { kind: pick(['ink', 'big']) } : {}), pos: [num(-40, 40), 1, num(-40, 40)] }));
  if (r() < 0.6) sc.lanterns = Array.from({ length: int(1, LANTERNS[night]) }, (_, k) => ({ id: `L${k + 1}`, ...(r() < 0.4 ? { lit: r() < 0.5 } : {}), ...(r() < 0.3 ? { deposited: int(0, 5) } : {}), ...(r() < 0.2 ? { pos: [num(-30, 30), 0, num(-30, 30)] } : {}) }));
  if (r() < 0.4) sc.time_left_s = num(1, 60);
  const frames = []; let t = 0;
  while (t < 3000) {
    const f = { tick: t };
    if (r() < 0.8) f.move = [num(-1, 1), num(-1, 1)];
    if (r() < 0.3) f.cam_yaw_deg = num(-360, 360);
    for (const b of ['jump', 'interact', 'pulse', 'dash', 'pause']) if (r() < (b === 'pause' ? 0.05 : 0.25)) f[b] = r() < 0.5;
    frames.push(f); t += int(1, 40);
  }
  const c = { i, night, seed: int(0, 1e6), ticks: int(200, 3000), every: int(1, 20), scenario: r() < 0.85 ? sc : null, inputs: r() < 0.9 ? { frames } : null, malformed: null };
  if (r() < 0.12) {
    // deliberate breakage: each must be rejected with exit code 2
    c.malformed = pick(['bad-json-inputs', 'bad-json-scenario', 'tick-order', 'move-range', 'bad-button', 'bad-lantern-id', 'bad-kind', 'bad-pos']);
    c.inputs = c.inputs || { frames: [{ tick: 0 }] };
    c.scenario = c.scenario || {};
    if (c.malformed === 'tick-order') c.inputs.frames.push({ tick: 0 });
    if (c.malformed === 'move-range') c.inputs.frames[0].move = [1.5, 0];
    if (c.malformed === 'bad-button') c.inputs.frames[0].pulse = 'yes';
    if (c.malformed === 'bad-lantern-id') c.scenario.lanterns = [{ id: `L${LANTERNS[night] + 1}` }];
    if (c.malformed === 'bad-kind') c.scenario.shades = [{ pos: [1, 1, 1], kind: 'giant' }];
    if (c.malformed === 'bad-pos') c.scenario.player = { pos: [0, 0] };
  }
  return c;
}

function runCase(c, dir) {
  const args = ['src/headless.js', '--seed', String(c.seed), '--night', String(c.night), '--ticks', String(c.ticks), '--snapshot-every', String(c.every)];
  const sf = path.join(dir, `s${c.i}.json`), inf = path.join(dir, `i${c.i}.json`), out = path.join(dir, `o${c.i}.jsonl`);
  fs.rmSync(out, { force: true });
  if (c.scenario) { fs.writeFileSync(sf, c.malformed === 'bad-json-scenario' ? '{"player": [' : JSON.stringify(c.scenario)); args.push('--scenario', sf); }
  if (c.inputs) { fs.writeFileSync(inf, c.malformed === 'bad-json-inputs' ? '{"frames": [{' : JSON.stringify(c.inputs)); args.push('--inputs', inf); }
  args.push('--out', out);
  const p = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  return { code: p.status, stderr: p.stderr, text: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '' };
}

export function fuzz({ n = 300, seed = 2026, deterministicSample = 30 } = {}) {
  const r = rng(seed);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-fuzz-'));
  const res = { n, seed, valid: 0, malformed: 0, crashes: 0, deterministicChecked: 0, failures: [], byMalformedKind: {} };
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const c = makeCase(r, i);
    const out = runCase(c, dir);
    if (c.malformed) {
      res.malformed++; res.byMalformedKind[c.malformed] = (res.byMalformedKind[c.malformed] || 0) + 1;
      if (out.code !== 2) res.failures.push({ i, kind: c.malformed, why: `expected exit 2, got ${out.code}` });
      continue;
    }
    res.valid++;
    if (out.code !== 0) { res.crashes++; res.failures.push({ i, why: `exit ${out.code}: ${out.stderr.slice(0, 200)}` }); continue; }
    const lines = out.text.trim().split('\n').map((l) => JSON.parse(l));
    const bad = checkRun(lines);
    if (bad.length) res.failures.push({ i, night: c.night, why: bad.slice(0, 3) });
    if (res.deterministicChecked < deterministicSample) {
      res.deterministicChecked++;
      const again = runCase(c, dir);
      if (again.text !== out.text) res.failures.push({ i, why: 'not deterministic' });
    }
  }
  res.seconds = +((performance.now() - t0) / 1000).toFixed(1);
  res.ok = res.failures.length === 0 && res.crashes === 0;
  fs.rmSync(dir, { recursive: true, force: true });
  return res;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const res = fuzz({ n: Number(process.argv[2] || 300), seed: Number(process.argv[3] || 2026) });
  const outDir = path.join(ROOT, 'docs', 'proof', 'phase-4');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fuzz.json'), JSON.stringify(res, null, 2) + '\n');
  console.log(`fuzz: ${res.ok ? 'PASS' : 'FAIL'}  ${res.valid} valid + ${res.malformed} malformed cases, ${res.crashes} crashes, ${res.failures.length} failures, ${res.deterministicChecked} determinism re-runs, ${res.seconds}s`);
  for (const f of res.failures.slice(0, 10)) console.log('  ', JSON.stringify(f));
  process.exit(res.ok ? 0 : 1);
}
