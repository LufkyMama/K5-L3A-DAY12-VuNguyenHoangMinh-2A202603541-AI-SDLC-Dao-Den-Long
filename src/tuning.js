// Single source of truth for gameplay numbers.
// tests/contract.test.js asserts game.contract.json "tuning" equals TUNING exactly.
export const TUNING = {
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  lantern_count_night2: 6,
  pickup_radius: 1.2,
  interact_radius: 2.5,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  night2_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 1,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 4,
  shade_speed: 3.5,
  shade_hit_radius: 1,
  big_shade_speed: 2.5,
  big_shade_hit_radius: 1.6,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 20,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

// Non-contract world constants (documented in docs/notes/phase-1.md).
export const WORLD = {
  tps: 60,
  islandRadius: 40,
  gravity: 20,
  jumpSpeed: 7,
  lanternRing: 25,
  shadeHeight: 1,
  shadeMaxRadius: 42,
  shadeSpawnRing: 37,
  shadeFirstS: 8,
  shadeEveryS: 15,
  shadeMax: 5,
  moteInitial: 30,
  moteMinActive: 20,
  moteRespawnS: 2,
  moteMinR: 3,
  moteMaxR: 38,
  safeEps: 0.01,
};

// Per-night layout and spawning (Ticket-02). Not contract numbers; documented in docs/notes/phase-2.md.
export const NIGHTS = {
  1: { lanterns: TUNING.lantern_count_night1, duration: TUNING.night1_duration_s, ring: 25, shadeFirstS: 8, shadeEveryS: 15, shadeMax: 5, bigEvery: 0 },
  2: { lanterns: TUNING.lantern_count_night2, duration: TUNING.night2_duration_s, ring: 28, shadeFirstS: 5, shadeEveryS: 12, shadeMax: 6, bigEvery: 3 },
};
