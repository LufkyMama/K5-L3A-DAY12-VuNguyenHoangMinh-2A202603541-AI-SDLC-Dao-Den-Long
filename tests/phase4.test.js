// Phase 4 (Ticket-04, self-authored): stability invariants, fuzz, build. Bench thresholds are checked in tools/proof.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { headless, quiet, ROOT, T } from './helpers.js';
import { checkRun } from '../tools/invariants.mjs';
import { fuzz } from '../tools/fuzz.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));
const ctx = { night: 1 };

test('P4-2 invariants hold on a real default night with play inputs', () => {
  const r = headless({ seed: 5, ticks: 3000, every: 5, inputs: { frames: [{ tick: 0, move: [0.4, 1] }, { tick: 200, pulse: true }, { tick: 201, pulse: false }] } });
  assert.deepEqual(checkRun(r.lines, ctx), []);
});

test('P4-3 the invariant checker catches deliberately broken output', () => {
  const r = headless({
    scenario: quiet({ player: { pos: [0, 0, 25], carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true }], shades: [{ id: 'A', pos: [0, 1, 15] }] }),
    ticks: 60, every: 10,
  });
  assert.deepEqual(checkRun(r.lines, ctx), []);
  const broken = (mut) => { const l = clone(r.lines); mut(l); return checkRun(l, ctx); };
  const snapIdx = r.lines.findIndex((l) => l.type === 'snapshot' && l.tick === 30);
  assert.ok(broken((l) => { l[snapIdx].player.flames = -1; }).length > 0, 'negative flames');
  assert.ok(broken((l) => { l[snapIdx].player.flames = T.flames + 1; }).length > 0, 'flames above start');
  assert.ok(broken((l) => { l[snapIdx].score = -5; }).length > 0, 'score decreased');
  assert.ok(broken((l) => { l[snapIdx].shades[0].pos = [0, 1, 23]; }).length > 0, 'shade inside a lit lantern');
  assert.ok(broken((l) => { l[snapIdx].player.pos = [50, 0, 0]; }).length > 0, 'player off the island');
  assert.ok(broken((l) => { l[snapIdx].time_left_s += 5; }).length > 0, 'time went backwards');
  assert.ok(broken((l) => { l[snapIdx].sim_tick = l[snapIdx].tick + 1; }).length > 0, 'sim_tick > tick');
  assert.ok(broken((l) => { l[snapIdx].lanterns[0].lit = false; }).length > 0, 'lantern unlit again');
  assert.ok(broken((l) => { l.pop(); }).length > 0, 'missing end line');
  assert.ok(broken((l) => { l[snapIdx].player.carried = Number.NaN; }).length > 0, 'non-finite number');
});

test('P4-2 a small fuzz batch passes (valid → exit 0 + invariants, malformed → exit 2, deterministic sample)', () => {
  const res = fuzz({ n: 25, seed: 99, deterministicSample: 5 });
  assert.equal(res.crashes, 0, JSON.stringify(res.failures.slice(0, 3)));
  assert.equal(res.failures.length, 0, JSON.stringify(res.failures.slice(0, 3)));
  assert.ok(res.malformed > 0 && res.valid > 0);
});

test('P4-5 build makes a self-contained static web folder + zip with relative paths', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-build-'));
  const p = spawnSync(process.execPath, ['tools/build.mjs', '--out', out], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  for (const f of ['web/index.html', 'web/main.js', 'web/src/sim.js', 'web/src/tuning.js', 'web/vendor/three.module.js']) {
    assert.ok(fs.existsSync(path.join(out, f)), f);
  }
  const html = fs.readFileSync(path.join(out, 'web/index.html'), 'utf8');
  const js = fs.readFileSync(path.join(out, 'web/main.js'), 'utf8');
  assert.match(html, /"three": "\.\/vendor\/three\.module\.js"/);
  assert.match(html, /src="\.\/main\.js"/);
  assert.doesNotMatch(js, /from '\/src\//);
  const zip = fs.readdirSync(out).find((f) => f.endsWith('.zip'));
  assert.ok(zip, 'zip exists');
  assert.equal(fs.readFileSync(path.join(out, zip)).subarray(0, 2).toString(), 'PK');
});
