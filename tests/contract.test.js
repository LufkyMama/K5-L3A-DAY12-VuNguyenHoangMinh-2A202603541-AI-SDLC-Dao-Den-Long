import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT } from './helpers.js';
import { TUNING } from '../src/tuning.js';
import { defaultLanterns } from '../src/sim.js';

test('game.contract.json has all required top-level fields', () => {
  // Ticket-02 bumped the contract to v1.1 (backward compatible: v1.0 fields unchanged)
  assert.equal(CONTRACT.contract_version, '1.1');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) {
    assert.equal(typeof CONTRACT[k], 'string', k);
    assert.ok(CONTRACT[k].length > 0, k);
  }
});

test('contract tuning is exactly what the game uses (src/tuning.js)', () => {
  assert.deepEqual(CONTRACT.tuning, TUNING);
});

test('contract tuning lists every field from Test Contract v1.0', () => {
  const required = ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius',
    'interact_radius', 'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio',
    'pulse_stun_s', 'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius', 'fall_enabled'];
  for (const k of required) assert.ok(k in CONTRACT.tuning, k);
  for (const k of ['per_mote', 'per_lantern', 'per_stun', 'per_second_left', 'per_flame_left']) {
    assert.ok(k in CONTRACT.tuning.score, `score.${k}`);
  }
});

test('night 1 has lantern_count_night1 = 5 lanterns with ids L1..L5', () => {
  assert.equal(TUNING.lantern_count_night1, 5);
  assert.deepEqual(defaultLanterns(1).map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
});
