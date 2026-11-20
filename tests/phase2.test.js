// Phase 2 (Ticket-02, self-authored): Night 2, Bóng Mực Lớn, CR-1 (only lit lanterns repel), contract v1.1.
// Expected values come from docs/notes/phase-2.md + game.contract.json tuning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headless, quiet, T, distXZ, CONTRACT } from './helpers.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

test('contract v1.1 declares the new tuning fields', () => {
  assert.equal(CONTRACT.contract_version, '1.1');
  for (const k of ['lantern_count_night2', 'night2_duration_s', 'big_shade_speed', 'big_shade_hit_radius']) assert.ok(k in T, k);
  assert.equal(T.lantern_count_night2, 6);
  assert.equal(T.night2_duration_s, 360);
});

test('P2-1 night 2 layout: night field, 6 lanterns L1..L6 on a 28 m ring, 360 s', () => {
  const r = headless({ night: 2, scenario: quiet(), ticks: 0 });
  const s = r.snaps[0];
  assert.equal(s.night, 2);
  assert.deepEqual(s.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
  for (const l of s.lanterns) near(Math.hypot(l.pos[0], l.pos[2]), 28, 0.01);
  assert.deepEqual(s.lanterns[0].pos, [0, 0, 28]);
  assert.equal(s.time_left_s, T.night2_duration_s);
  assert.equal(headless({ scenario: quiet(), ticks: 0 }).snaps[0].night, 1);
});

test('P2-2 night 2 is won only when all 6 lanterns are lit', () => {
  const five = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const sc = (lanterns) => quiet({ player: { pos: [0, 0, 26], carried: 5 }, lanterns });
  const notYet = headless({ night: 2, scenario: sc(five), inputs: { frames: [{ tick: 0, interact: true }] }, ticks: 5 });
  assert.equal(notYet.ev('lantern_lit').length, 1); // L1 lit → 5/6
  assert.equal(notYet.end.state, 'playing');
  const all = headless({ night: 2, scenario: sc([...five, { id: 'L6', lit: true }]), inputs: { frames: [{ tick: 0, interact: true }] }, ticks: 5 });
  assert.deepEqual(all.ev('game_over')[0].data, { result: 'won', reason: 'all_lit' });
  assert.equal(all.end.score, T.score.per_lantern + T.score.per_second_left * Math.floor(T.night2_duration_s - 1 / 60) + T.score.per_flame_left * T.flames);
});

test('P2-3 Bóng Mực Lớn moves at big_shade_speed and hits at big_shade_hit_radius', () => {
  const r = headless({ night: 2, scenario: quiet({ shades: [{ id: 'B', kind: 'big', pos: [20, 1, 0] }] }), ticks: 60, every: 60 });
  assert.equal(r.snaps[0].shades[0].kind, 'big');
  near(r.snapAt(60).shades[0].pos[0], 20 - T.big_shade_speed);
  // shade standing still at exactly big radius (player moves away is not needed: 1 tick, shade moves toward player first)
  const reach = T.big_shade_hit_radius + T.big_shade_speed / 60; // after one chase step it is exactly at the hit radius
  const hit = headless({ night: 2, scenario: quiet({ shades: [{ kind: 'big', pos: [reach, 1, 0] }] }), ticks: 1 });
  assert.equal(hit.ev('player_hit').length, 1);
  const miss = headless({ night: 2, scenario: quiet({ shades: [{ kind: 'big', pos: [reach + 0.05, 1, 0] }] }), ticks: 1 });
  assert.equal(miss.ev('player_hit').length, 0);
  // an ordinary shade at the same distance does not hit
  const ink = headless({ night: 2, scenario: quiet({ shades: [{ pos: [reach, 1, 0] }] }), ticks: 1 });
  assert.equal(ink.ev('player_hit').length, 0);
});

test('P2-3 pulse stuns Bóng Mực Lớn like an ordinary shade', () => {
  const r = headless({ night: 2, scenario: quiet({ player: { carried: 1 }, shades: [{ id: 'B', kind: 'big', pos: [3, 1, 0] }] }), inputs: { frames: [{ tick: 0, pulse: true }] }, ticks: 1, every: 1 });
  assert.deepEqual(r.ev('pulse')[0].data.stunned_ids, ['B']);
  assert.equal(r.snapAt(1).shades[0].state, 'stunned');
});

test('P2-4 default night 2: every third spawned shade is big; night 1 never spawns big', () => {
  // the player waits inside a lit lantern's safe circle so the night lasts long enough for 3 spawns
  const safe = { player: { pos: [0, 0, 28] }, lanterns: [{ id: 'L1', lit: true }] };
  const r = headless({ night: 2, scenario: safe, ticks: 60 * 40, every: 60 * 40 });
  const ids = r.ev('shade_spawned').map((e) => e.data.id);
  assert.ok(ids.length >= 3, `spawned ${ids.length}`);
  const last = r.snaps.at(-1);
  const kinds = Object.fromEntries(last.shades.map((s) => [s.id, s.kind]));
  assert.equal(kinds[ids[0]], 'ink'); assert.equal(kinds[ids[1]], 'ink'); assert.equal(kinds[ids[2]], 'big');
  const n1 = headless({ night: 1, scenario: { player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }] }, ticks: 60 * 60, every: 60 * 60 });
  assert.ok(n1.snaps.at(-1).shades.length >= 3);
  assert.ok(n1.snaps.at(-1).shades.every((s) => s.kind === 'ink'));
});

test('P2-5 CR-1: an unlit lantern does not repel shades', () => {
  const r = headless({ scenario: quiet({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', pos: [0, 0, 25] }], shades: [{ pos: [0, 1, 22] }] }), ticks: 120, every: 1 });
  assert.ok(r.ev('player_hit').length >= 1);
  assert.ok(distXZ(r.snaps[0].shades[0].pos, [0, 0, 25]) < T.safe_radius);
});

test('P2-5 CR-1: a lantern lit this step pushes a shade inside its circle out in the same step', () => {
  const r = headless({
    scenario: quiet({ player: { pos: [0, 0, 23], carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 25] }], shades: [{ id: 'A', pos: [2, 1, 27] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] }, ticks: 1, every: 1,
  });
  assert.equal(r.ev('lantern_lit').length, 1);
  assert.ok(distXZ(r.snapAt(1).shades[0].pos, [0, 0, 25]) >= T.safe_radius);
});

test('P2-6 lantern ids depend on the night; bad kind / night are rejected', () => {
  assert.equal(headless({ night: 2, scenario: { lanterns: [{ id: 'L6', lit: true }] }, ticks: 1 }).code, 0);
  assert.equal(headless({ night: 1, scenario: { lanterns: [{ id: 'L6', lit: true }] }, ticks: 1 }).code, 2);
  assert.equal(headless({ night: 2, scenario: { shades: [{ pos: [5, 1, 5], kind: 'giant' }] }, ticks: 1 }).code, 2);
  assert.notEqual(headless({ night: 3, ticks: 1 }).code, 0);
});

test('night 2 is deterministic too', () => {
  const a = headless({ night: 2, seed: 9, ticks: 3000, inputs: { frames: [{ tick: 0, move: [0.4, 1] }] } });
  const b = headless({ night: 2, seed: 9, ticks: 3000, inputs: { frames: [{ tick: 0, move: [0.4, 1] }] } });
  assert.equal(a.text, b.text);
});
