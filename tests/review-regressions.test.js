// Regression tests for defects found by the independent contract-reviewer agent (see docs/notes/evaluation.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headless, quiet, T, distXZ } from './helpers.js';

test('D1: exactly r away counts as within r even off-origin (float error)', () => {
  // all three motes are exactly pickup_radius (1.2) from [10,0,10]: offsets (0.72,0.96), (-0.72,-0.96), (1.2,0)
  const r = headless({ scenario: quiet({ player: { pos: [10, 0, 10] }, motes: [[10.72, 0, 10.96], [9.28, 0, 9.04], [11.2, 0, 10]] }), ticks: 1 });
  assert.equal(r.ev('mote_picked').length, 3);
});

test('D1: shade exactly shade_hit_radius away off-origin hits; pulse at exactly pulse_radius stuns', () => {
  const k = T.shade_hit_radius / 1.2; // scale the 0.72/0.96 triangle to the hit radius
  const hit = headless({ scenario: quiet({ player: { pos: [10, 0, 10] }, shades: [{ pos: [10 + 0.72 * k, 1, 10 + 0.96 * k] }] }), ticks: 1 });
  assert.equal(hit.ev('player_hit').length, 1);
  const kp = T.pulse_radius / 1.2;
  const p = headless({
    scenario: quiet({ player: { pos: [10, 0, 10], carried: 1 }, shades: [{ id: 'A', pos: [10 + 0.72 * kp, 1, 10 + 0.96 * kp] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] }, ticks: 1,
  });
  assert.deepEqual(p.ev('pulse')[0].data.stunned_ids, ['A']);
});

test('D2/D3: unknown flag without value is ignored; --key=value works', () => {
  const a = headless({ scenario: quiet(), ticks: 5, extra: ['--verbose'] });
  assert.equal(a.code, 0, a.stderr);
  assert.match(a.stderr, /unknown flag --verbose/);
  const b = headless({ scenario: quiet(), ticks: 5, extra: ['--snapshot-every=1'] });
  assert.equal(b.code, 0, b.stderr);
  assert.equal(b.snaps.length, 6);
});

test('R-a: a night that starts with all 5 lanterns lit is won on the first step', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = headless({ scenario: quiet({ lanterns }), ticks: 100 });
  assert.deepEqual(r.ev('game_over')[0], { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  // no lantern points (built lit), only the win bonus
  assert.equal(r.end.score, T.score.per_second_left * Math.floor(T.night1_duration_s - 1 / 60) + T.score.per_flame_left * T.flames);
});

test('R-b: a lantern built with deposited = lantern_cost is lit (no event, no score)', () => {
  const r = headless({ scenario: quiet({ lanterns: [{ id: 'L2', deposited: T.lantern_cost }] }), ticks: 1, every: 1 });
  assert.equal(r.snaps[0].lanterns.find((l) => l.id === 'L2').lit, true);
  assert.equal(r.events.length, 0);
});

test('R-c: a scenario shade placed inside safe_radius of a LIT lantern is outside it already at snapshot 0 (CR-1)', () => {
  const r = headless({ scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true }], shades: [{ pos: [0, 1, 24] }] }), ticks: 1, every: 1 });
  assert.ok(distXZ(r.snaps[0].shades[0].pos, [0, 0, 25]) >= T.safe_radius);
});

test('R-d: a scenario with flames 0 is lost (no_flames) on the first step', () => {
  const r = headless({ scenario: quiet({ player: { flames: 0 } }), ticks: 100 });
  assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.ticks, 1);
});
