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

test('P4-3 (after review) new invariants catch the mutations that used to slip through', () => {
  // a real run with a pause in the middle: ticks 20..39 are paused
  const r = headless({ scenario: quiet({ shades: [{ id: 'A', pos: [10, 1, 0] }] }), ticks: 60, every: 10,
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 20, pause: true }, { tick: 21, pause: false }, { tick: 40, pause: true }] } });
  assert.deepEqual(checkRun(r.lines, ctx), []);
  const broken = (mut) => { const l = clone(r.lines); mut(l); return checkRun(l, ctx); };
  const at = (l, t) => l.find((x) => x.type === 'snapshot' && x.tick === t);
  // clock keeps running during the pause (the "time_left uses tick instead of sim_tick" bug)
  assert.ok(broken((l) => { at(l, 30).time_left_s -= 10 / 60; at(l, 40).time_left_s -= 20 / 60; at(l, 50).time_left_s -= 20 / 60; at(l, 60).time_left_s -= 20 / 60; }).length > 0, 'clock ran while paused');
  assert.ok(broken((l) => { at(l, 30).player.carried = T.carry_capacity + 5; }).length > 0, 'carried above capacity');
  assert.ok(broken((l) => { at(l, 30).player.flames = 2; at(l, 40).player.flames = 3; }).length > 0, 'flames went back up');
  assert.ok(broken((l) => { at(l, 30).time_left_s = -1; }).length > 0, 'negative time');
  assert.ok(broken((l) => { at(l, 30).state = 'dancing'; }).length > 0, 'unknown state');
  assert.ok(broken((l) => { at(l, 30).shades.push({ ...at(l, 30).shades[0] }); }).length > 0, 'duplicate shade id');
  assert.ok(broken((l) => { at(l, 30).lanterns.pop(); }).length > 0, 'lantern disappeared');
  assert.ok(broken((l) => { const e = l.findIndex((x) => x.type === 'event'); const [ev] = l.splice(e, 1); l.splice(l.length - 1, 0, ev); }).length > 0, 'event moved after a later snapshot');
});
