// Phase 3 (Ticket-03, self-authored): pause (sim_tick vs tick) and dash. Contract v1.2.
// Expected values derive from docs/notes/phase-3.md + game.contract.json tuning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headless, quiet, T, CONTRACT } from './helpers.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const per = T.player_speed / 60; // metres per normal tick
const DASH_TICKS = Math.round(T.dash_duration_s * 60);
const DASH_DIST = T.player_speed * T.dash_speed_mult * T.dash_duration_s;

test('contract v1.2 declares dash tuning', () => {
  assert.equal(CONTRACT.contract_version, '1.2');
  for (const k of ['dash_speed_mult', 'dash_duration_s', 'dash_cooldown_s']) assert.equal(typeof T[k], 'number', k);
});

test('P3-1/P3-2 pause freezes sim_tick, time and movement while tick keeps counting', () => {
  const r = headless({
    scenario: quiet(), ticks: 80, every: 10,
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 70, pause: true }, { tick: 71, pause: false }] },
  });
  assert.deepEqual(r.ev('pause').map((e) => [e.tick, e.data.paused]), [[11, true], [71, false]]);
  const s70 = r.snapAt(70);
  assert.equal(s70.sim_tick, 10);
  assert.equal(s70.paused, true);
  near(s70.player.pos[2], 10 * per);
  near(s70.time_left_s, T.night1_duration_s - 10 / 60);
  const s80 = r.snapAt(80);
  assert.equal(s80.paused, false);
  assert.equal(s80.sim_tick, 20); // gameplay resumes in the unpause step itself
  near(s80.player.pos[2], 20 * per);
  assert.equal(r.end.ticks, 80);
});

test('P3-2 dawn comes later by exactly the number of paused ticks', () => {
  const r = headless({
    scenario: quiet({ time_left_s: 1 }), ticks: 500,
    inputs: { frames: [{ tick: 0, pause: true }, { tick: 1, pause: false }, { tick: 30, pause: true }] },
  });
  assert.deepEqual(r.ev('game_over')[0], { type: 'event', tick: 60 + 30, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
});

test('P3-3 nothing happens while paused; a button pressed during pause does not fire on resume', () => {
  const r = headless({
    scenario: quiet({ player: { pos: [0, 0, 23], carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 25] }], shades: [{ id: 'A', pos: [10, 1, 23] }] }),
    ticks: 30, every: 1,
    inputs: { frames: [{ tick: 0, pause: true }, { tick: 1, pause: false }, { tick: 5, interact: true }, { tick: 10, pause: true }, { tick: 11, pause: false }] },
  });
  assert.deepEqual(r.events.map((e) => e.name), ['pause', 'pause']);
  assert.deepEqual(r.snapAt(9).shades[0].pos, [10, 1, 23]); // shade frozen while paused
  assert.equal(r.end.score, 0);
  assert.equal(r.snaps.at(-1).player.carried, 5);
});

test('P3-4 dash covers player_speed × dash_speed_mult × dash_duration_s along the move direction', () => {
  const r = headless({ scenario: quiet(), ticks: 60, every: 1, inputs: { frames: [{ tick: 0, move: [0, 1], dash: true }] } });
  assert.deepEqual(r.ev('dash')[0], { type: 'event', tick: 1, name: 'dash', data: { dir: [0, 1] } });
  near(r.snapAt(DASH_TICKS).player.pos[2], DASH_DIST);
  near(r.snapAt(60).player.pos[2], DASH_DIST + (60 - DASH_TICKS) * per);
  const yaw = headless({ scenario: quiet(), ticks: DASH_TICKS, every: 1, inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90, dash: true }] } });
  near(yaw.snapAt(DASH_TICKS).player.pos[0], DASH_DIST);
});

test('P3-5 dash cooldown', () => {
  const cd = Math.round(T.dash_cooldown_s * 60);
  const r = headless({
    scenario: quiet(), ticks: cd + 10,
    // press 2 ticks before the cooldown ends (ignored), then exactly when it ends (step cd → event tick cd+1)
    inputs: { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: cd - 2, dash: true }, { tick: cd - 1, dash: false }, { tick: cd, dash: true }] },
  });
  assert.deepEqual(r.ev('dash').map((e) => e.tick), [1, cd + 1]);
});

test('P3-6 dashing while standing still uses the last move direction (default +Z)', () => {
  const still = headless({ scenario: quiet(), ticks: DASH_TICKS, every: 1, inputs: { frames: [{ tick: 0, dash: true }] } });
  near(still.snapAt(DASH_TICKS).player.pos[2], DASH_DIST);
  const after = headless({
    scenario: quiet(), ticks: 10 + DASH_TICKS, every: 1,
    inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0], dash: true }] },
  });
  assert.deepEqual(after.ev('dash')[0].data.dir, [1, 0]);
  near(after.snapAt(10 + DASH_TICKS).player.pos[0], 10 * per + DASH_DIST);
});

test('P3-7 without pause/dash: sim_tick equals tick, paused is false, explicit false buttons change nothing', () => {
  const a = headless({ seed: 4, ticks: 1200, inputs: { frames: [{ tick: 0, move: [0.3, 1] }] } });
  const b = headless({ seed: 4, ticks: 1200, inputs: { frames: [{ tick: 0, move: [0.3, 1], pause: false, dash: false }] } });
  assert.equal(a.text, b.text);
  for (const s of a.snaps) { assert.equal(s.sim_tick, s.tick); assert.equal(s.paused, false); }
});

test('P3-8 pause/dash must be booleans (exit 2)', () => {
  assert.equal(headless({ inputs: { frames: [{ tick: 0, pause: 1 }] }, ticks: 1 }).code, 2);
  assert.equal(headless({ inputs: { frames: [{ tick: 0, dash: 'yes' }] }, ticks: 1 }).code, 2);
});

test('P3-1 a pause in the middle of a dash freezes it; the remaining dash ticks run after resume', () => {
  const r = headless({
    scenario: quiet(), ticks: 70, every: 1,
    inputs: { frames: [{ tick: 0, dash: true }, { tick: 5, pause: true }, { tick: 6, pause: false }, { tick: 50, pause: true }] },
  });
  // 5 dash ticks before the pause, the other DASH_TICKS-5 after resuming at step 50 → full dash at state 50 + (DASH_TICKS-5)
  near(r.snapAt(5).player.pos[2], 5 * DASH_DIST / DASH_TICKS);
  assert.equal(r.snapAt(49).player.pos[2], r.snapAt(6).player.pos[2]);
  near(r.snapAt(50 + DASH_TICKS - 5).player.pos[2], DASH_DIST);
});

test('P3-5 the dash cooldown does not run down while paused', () => {
  const cd = Math.round(T.dash_cooldown_s * 60);
  const P = 100; // paused ticks
  const r = headless({
    scenario: quiet(), ticks: cd + P + 10,
    inputs: { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false, pause: true }, { tick: 2, pause: false }, { tick: 1 + P, pause: true },
      { tick: 2 + P, pause: false }, { tick: cd + P - 1, dash: true }, { tick: cd + P, dash: false }, { tick: cd + P + 1, dash: true }] },
  });
  // gameplay steps are 0 and 1+P.. ; cooldown (cd steps) ends at gameplay step cd → tick cd + P
  assert.deepEqual(r.ev('dash').map((e) => e.tick), [1, cd + P + 2]);
});
