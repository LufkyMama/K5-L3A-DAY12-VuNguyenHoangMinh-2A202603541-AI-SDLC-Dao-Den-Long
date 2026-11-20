// Behaviour tests through the real headless CLI. Expected numbers come from the contract
// rules + tuning in game.contract.json, never from copying program output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headless, quiet, T, distXZ } from './helpers.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const L1 = [0, 0, 25];

// ---------- output format / tick model ----------
test('snapshot 0 is pre-input state; snapshots every N; end line last; ticks exact', () => {
  const r = headless({ ticks: 35, every: 10, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30]);
  const s0 = r.snaps[0];
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.equal(s0.state, 'playing');
  assert.equal(s0.time_left_s, T.night1_duration_s);
  assert.equal(s0.sim_tick, 0);
  assert.equal(s0.lanterns.length, 5);
  for (const k of ['type', 'tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) {
    assert.ok(k in s0, k);
  }
  // default world: first shade spawns at 8 s and motes start ≥ 3 m away, so nothing can score by tick 35
  // unless a mote lies within pickup_radius of the 3.5 m walk; count those pickups from the events.
  assert.deepEqual(r.end, { type: 'end', ticks: 35, state: 'playing', score: T.score.per_mote * r.ev('mote_picked').length });
  near(r.snapAt(30).time_left_s, T.night1_duration_s - 30 / 60);
});

test('no inputs file -> player stands still', () => {
  const r = headless({ scenario: quiet(), ticks: 120 });
  assert.deepEqual(r.snaps.at(-1).player.pos, [0, 0, 0]);
});

// ---------- movement & camera ----------
test('move [0,1] at yaw 0 travels +Z at player_speed', () => {
  const r = headless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const p = r.snapAt(60).player.pos;
  near(p[0], 0); near(p[2], T.player_speed);
});

test('cam_yaw_deg rotates input: yaw 90, move [0,1] -> +X', () => {
  const r = headless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
  const p = r.snapAt(60).player.pos;
  near(p[0], T.player_speed); near(p[2], 0);
});

test('diagonal input longer than 1 is normalised', () => {
  const r = headless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
  const p = r.snapAt(60).player.pos;
  near(Math.hypot(p[0], p[2]), T.player_speed);
});

test('frames keep missing fields; input at tick k affects state k+1', () => {
  const r = headless({
    scenario: quiet(), ticks: 30, every: 1,
    inputs: { frames: [{ tick: 10, move: [1, 0] }, { tick: 20, cam_yaw_deg: 0 }] },
  });
  assert.equal(r.snapAt(10).player.pos[0], 0);
  near(r.snapAt(11).player.pos[0], T.player_speed / 60);
  near(r.snapAt(30).player.pos[0], (20 * T.player_speed) / 60); // move kept after tick 20 frame
});

test('jump leaves the ground and lands again', () => {
  const r = headless({ scenario: quiet(), ticks: 120, every: 1, inputs: { frames: [{ tick: 0, jump: true }] } });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 0.5);
  assert.equal(ys.at(-1), 0);
});

// ---------- fireflies ----------
test('pickup within pickup_radius (inclusive), not beyond', () => {
  const r = headless({ scenario: quiet({ motes: [[T.pickup_radius, 0, 0], [0, 0, T.pickup_radius + 0.05]] }), ticks: 1 });
  assert.equal(r.ev('mote_picked').length, 1);
  assert.equal(r.ev('mote_picked')[0].tick, 1);
  assert.equal(r.end.score, T.score.per_mote);
});

test('carry_capacity caps pickups', () => {
  const motes = Array.from({ length: T.carry_capacity + 3 }, () => [0, 0, 0]);
  const r = headless({ scenario: quiet({ motes }), ticks: 1, every: 1 });
  assert.equal(r.ev('mote_picked').length, T.carry_capacity);
  assert.deepEqual(r.ev('mote_picked').map((e) => e.data.carried), Array.from({ length: T.carry_capacity }, (_, i) => i + 1));
  assert.equal(r.snapAt(1).motes_active, 3);
});

test('walking collects a mote placed on the path (contract example timing)', () => {
  const r = headless({ scenario: quiet({ motes: [[0, 0, 5]] }), ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const e = r.ev('mote_picked');
  assert.equal(e.length, 1);
  // first state where z >= 5 - pickup_radius
  assert.equal(e[0].tick, Math.ceil(((5 - T.pickup_radius) * 60) / T.player_speed - 1e-9));
});

// ---------- lanterns ----------
const atL1 = (carried, extra = {}) => quiet({ player: { pos: [0, 0, 25 - T.interact_radius], carried }, lanterns: [{ id: 'L1', pos: L1 }], ...extra });
const tap = (tick, key = 'interact') => ({ frames: [{ tick, [key]: true }, { tick: tick + 1, [key]: false }] });

test('interact within interact_radius deposits and lights the lantern', () => {
  const r = headless({ scenario: atL1(T.lantern_cost), inputs: tap(0), ticks: 5, every: 1 });
  assert.deepEqual(r.ev('deposit')[0].data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.deepEqual(r.ev('lantern_lit')[0].data, { lantern_id: 'L1' });
  assert.equal(r.ev('deposit')[0].tick, 1);
  assert.equal(r.end.score, T.score.per_lantern);
  const l = r.snaps.at(-1).lanterns.find((x) => x.id === 'L1');
  assert.equal(l.lit, true);
  assert.equal(r.snaps.at(-1).player.carried, 0);
});

test('partial deposit accumulates; interact is edge-triggered', () => {
  const r = headless({
    scenario: atL1(2), ticks: 20,
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 10, interact: false }] }, // held 10 ticks
  });
  assert.equal(r.ev('deposit').length, 1);
  assert.deepEqual(r.ev('deposit')[0].data, { lantern_id: 'L1', amount: 2, deposited: 2 });
  assert.equal(r.ev('lantern_lit').length, 0);
});

test('deposit only takes what the lantern still needs', () => {
  const r = headless({ scenario: atL1(T.carry_capacity, { lanterns: [{ id: 'L1', pos: L1, deposited: T.lantern_cost - 2 }] }), inputs: tap(0), ticks: 3, every: 1 });
  assert.deepEqual(r.ev('deposit')[0].data, { lantern_id: 'L1', amount: 2, deposited: T.lantern_cost });
  assert.equal(r.snaps.at(-1).player.carried, T.carry_capacity - 2);
});

test('out of interact_radius: no deposit', () => {
  const sc = atL1(3); sc.player.pos = [0, 0, 25 - T.interact_radius - 0.1];
  const r = headless({ scenario: sc, inputs: tap(0), ticks: 3 });
  assert.equal(r.ev('deposit').length, 0);
});

test('lighting the last lantern wins (all_lit); pre-lit lanterns score nothing', () => {
  const lanterns = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })).concat([{ id: 'L1', pos: L1 }]);
  const r = headless({ scenario: atL1(T.lantern_cost, { lanterns }), inputs: tap(0), ticks: 100 });
  assert.deepEqual(r.ev('game_over')[0].data, { result: 'won', reason: 'all_lit' });
  assert.equal(r.end.state, 'won');
  assert.equal(r.end.ticks, 1); // stops when game ends
  const left = Math.floor(T.night1_duration_s - 1 / 60);
  assert.equal(r.end.score, T.score.per_lantern + left * T.score.per_second_left + T.flames * T.score.per_flame_left);
  assert.equal(r.ev('lantern_lit').length, 1);
});

// ---------- pulse ----------
test('pulse stuns + pushes shades in radius, costs pulse_cost', () => {
  const r = headless({
    scenario: quiet({ player: { carried: 2 }, shades: [{ id: 'A', pos: [T.pulse_radius, 1, 0] }, { id: 'B', pos: [0, 1, -(T.pulse_radius + 3)] }] }),
    inputs: tap(0, 'pulse'), ticks: 1, every: 1,
  });
  assert.deepEqual(r.ev('pulse')[0].data, { stunned_ids: ['A'] });
  const s = r.snapAt(1);
  assert.equal(s.player.carried, 2 - T.pulse_cost);
  const a = s.shades.find((x) => x.id === 'A');
  assert.equal(a.state, 'stunned');
  near(a.pos[0], T.pulse_radius + T.pulse_push_m);
  assert.notEqual(s.shades.find((x) => x.id === 'B').state, 'stunned');
  assert.equal(r.end.score, T.score.per_stun);
});

test('stun lasts pulse_stun_s then shade chases again', () => {
  const r = headless({
    scenario: quiet({ player: { carried: 1 }, shades: [{ id: 'A', pos: [3, 1, 0] }] }),
    inputs: tap(0, 'pulse'), ticks: 200, every: 1,
  });
  const stunTicks = Math.round(T.pulse_stun_s * 60);
  const a = (t) => r.snapAt(t).shades[0];
  assert.equal(a(stunTicks).state, 'stunned');
  assert.deepEqual(a(stunTicks).pos, a(1).pos); // did not move while stunned
  assert.notEqual(a(stunTicks + 1).state, 'stunned');
});

test('pulse without enough light does nothing', () => {
  const r = headless({ scenario: quiet({ shades: [{ pos: [3, 1, 0] }] }), inputs: tap(0, 'pulse'), ticks: 2 });
  assert.equal(r.ev('pulse').length, 0);
});

test('pulse respects pulse_cooldown_s', () => {
  const cd = Math.round(T.pulse_cooldown_s * 60);
  const r = headless({
    scenario: quiet({ player: { carried: 5 } }), ticks: cd + 5,
    inputs: { frames: [
      { tick: 0, pulse: true }, { tick: 1, pulse: false },
      { tick: cd - 2, pulse: true }, { tick: cd - 1, pulse: false },
      { tick: cd, pulse: true }, { tick: cd + 1, pulse: false },
    ] },
  });
  assert.deepEqual(r.ev('pulse').map((e) => e.tick), [1, cd + 1]);
});

// ---------- shades ----------
test('shades chase at shade_speed', () => {
  const r = headless({ scenario: quiet({ shades: [{ id: 'S1', pos: [20, 1, 0] }] }), ticks: 60 });
  near(r.snapAt(60).shades[0].pos[0], 20 - T.shade_speed);
});

test('shade contact: lose a flame, drop hit_drop_ratio of fireflies, then invulnerable', () => {
  const r = headless({ scenario: quiet({ player: { carried: 4 }, shades: [{ pos: [0.5, 1, 0] }] }), ticks: 200 });
  const hits = r.ev('player_hit');
  assert.deepEqual(hits[0].data, { by: 'shade', flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) });
  assert.equal(hits[0].tick, 1);
  assert.equal(hits[1].tick - hits[0].tick, Math.round(T.invuln_s * 60));
});

test('losing all flames ends the night (no_flames)', () => {
  const r = headless({ scenario: quiet({ player: { flames: 1 }, shades: [{ pos: [0, 1, 0.5] }] }), ticks: 100 });
  assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.state, 'lost');
  assert.equal(r.end.ticks, 1);
});

test('dawn: time runs out -> lost (dawn)', () => {
  const r = headless({ scenario: quiet({ time_left_s: 1 }), ticks: 500 });
  assert.deepEqual(r.ev('game_over')[0], { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.equal(r.end.ticks, 60);
});

test('shades never enter safe_radius around a LIT lantern; player there is safe (CR-1)', () => {
  const r = headless({
    scenario: quiet({ player: { pos: L1 }, lanterns: [{ id: 'L1', pos: L1, lit: true }] /* CR-1 (Ticket-02): only lit lanterns repel */, shades: [{ pos: [0, 1, 15] }, { pos: [8, 1, 25] }] }),
    ticks: 600, every: 1,
  });
  for (const s of r.snaps.slice(1)) for (const sh of s.shades) assert.ok(distXZ(sh.pos, L1) >= T.safe_radius, `tick ${s.tick}`);
  assert.equal(r.ev('player_hit').length, 0);
});

test('default night spawns shades with shade_spawned events; random_shades:false spawns none', () => {
  const r = headless({ ticks: 60 * 30 });
  assert.ok(r.ev('shade_spawned').length >= 1);
  assert.equal(r.ev('shade_spawned')[0].data.id, 'S1');
  const q = headless({ scenario: { random_shades: false }, ticks: 60 * 30 });
  assert.equal(q.ev('shade_spawned').length, 0);
  assert.ok(q.snaps[0].motes_active > 0); // default motes still there
});

test('scenario ids are kept; scenario build emits no events and no score', () => {
  const r = headless({ scenario: quiet({ shades: [{ id: 'X9', pos: [30, 1, 0] }, { pos: [-30, 1, 0] }], lanterns: [{ id: 'L3', lit: true }] }), ticks: 1 });
  assert.deepEqual(r.snaps[0].shades.map((s) => s.id).sort(), ['S1', 'X9']);
  assert.equal(r.snaps[0].score, 0);
  assert.equal(r.events.length, 0);
});

// ---------- determinism ----------
test('same seed + inputs -> byte-identical output; different seed differs', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 300, pulse: true }, { tick: 301, pulse: false }] };
  const a = headless({ seed: 42, inputs, ticks: 3000 });
  const b = headless({ seed: 42, inputs, ticks: 3000 });
  const c = headless({ seed: 43, inputs, ticks: 3000 });
  assert.equal(a.text, b.text);
  assert.notEqual(a.text, c.text);
});

// ---------- errors ----------
test('malformed inputs / scenario -> exit code 2 with stderr message', () => {
  const cases = [
    { rawInputs: '{not json' },
    { inputs: { frames: [{ tick: 5 }, { tick: 5 }] } },
    { inputs: { frames: [{ tick: 0, move: [2, 0] }] } },
    { inputs: { frames: [{ tick: 0, jump: 'yes' }] } },
    { rawScenario: '[1,2' },
    { scenario: { lanterns: [{ id: 'L9' }] } },
    { scenario: { player: { pos: [0, 0] } } },
  ];
  for (const c of cases) {
    const r = headless({ ticks: 5, ...c });
    assert.equal(r.code, 2, JSON.stringify(c));
    assert.ok(r.stderr.length > 0);
  }
});

test('bad CLI usage -> non-zero exit', () => {
  const r = headless({ ticks: 5, extra: ['--night', '9'] });
  assert.notEqual(r.code, 0);
});
