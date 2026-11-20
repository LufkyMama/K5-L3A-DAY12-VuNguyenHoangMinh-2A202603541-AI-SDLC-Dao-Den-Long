// Deterministic game simulation for Đảo Đèn Lồng. Shared by headless runner and browser client.
// Pure logic: no DOM, no timers, no Math.random. Fixed step = 1/60 s.
import { TUNING, WORLD } from './tuning.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
// "Within r" means distance <= r. EPS absorbs float error so an entity placed exactly r away
// (e.g. offsets 0.72/0.96 → hypot = 1.2000000000000002) still counts as within r.
const EPS = 1e-6;
const within = (a, b, r) => distXZ(a, b) <= r + EPS;
const secToTicks = (s) => Math.round(s * WORLD.tps);

export function defaultLanterns(count = TUNING.lantern_count_night1) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    out.push({
      id: `L${i + 1}`,
      pos: [r3(WORLD.lanternRing * Math.sin(a)), 0, r3(WORLD.lanternRing * Math.cos(a))],
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

/** Rotate a [x,z] stick input by camera yaw (contract C) and clamp length to 1. */
export function worldMove(move, yawDeg) {
  let [x, z] = move;
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  const t = (yawDeg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return [x * c + z * s, -x * s + z * c];
}

export class Game {
  /**
   * @param {object} o
   * @param {number} o.seed
   * @param {number} [o.night]
   * @param {object|null} [o.scenario] already-validated scenario object
   * @param {boolean} [o.creative] enable extra content (GUI only; headless keeps it off)
   */
  constructor({ seed = 0, night = 1, scenario = null, creative = false } = {}) {
    const T = TUNING;
    this.t = T;
    this.night = night;
    this.creative = creative;
    this.rand = mulberry32(seed);
    this.steps = 0;
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.duration = T.night1_duration_s;
    this.prevButtons = { jump: false, interact: false, pulse: false, dash: false };
    this.nextMoteN = 1;
    this.nextShadeN = 1;
    this.moteRespawnTimer = 0;
    this.shadeSpawnTimer = secToTicks(WORLD.shadeFirstS);
    this.pulseCooldown = 0;
    this.invuln = 0;
    this.lastPulseTick = -9999; // presentation only
    this.lastHitTick = -9999; // presentation only
    this.boost = 0; // creative: golden firefly speed boost ticks

    const sc = scenario || {};
    this.player = {
      pos: [0, 0, 0], vy: 0,
      flames: T.flames,
      carried: 0,
    };
    if (sc.player) {
      if (sc.player.pos) this.player.pos = [...sc.player.pos];
      if (sc.player.carried !== undefined) this.player.carried = sc.player.carried;
      if (sc.player.flames !== undefined) this.player.flames = sc.player.flames;
    }
    this.lanterns = defaultLanterns();
    for (const l of sc.lanterns || []) {
      const tgt = this.lanterns.find((x) => x.id === l.id);
      if (l.pos) tgt.pos = [...l.pos];
      if (l.deposited !== undefined) tgt.deposited = l.deposited;
      if (l.lit !== undefined) {
        tgt.lit = l.lit;
        if (l.lit && l.deposited === undefined) tgt.deposited = T.lantern_cost;
      } else if (tgt.deposited >= T.lantern_cost) {
        tgt.lit = true; // a full lantern is a lit lantern (no event, no score while building)
      }
    }
    if (sc.time_left_s !== undefined) this.duration = sc.time_left_s;
    this.randomMotes = sc.random_motes !== false;
    this.randomShades = sc.random_shades !== false;

    this.motes = [];
    if (sc.motes) {
      for (const p of sc.motes) this.addMote(p);
    } else if (this.randomMotes) {
      for (let i = 0; i < WORLD.moteInitial; i++) this.addMote(this.randomMotePos());
    }
    this.shades = [];
    if (sc.shades) {
      const used = new Set(sc.shades.filter((s) => s.id).map((s) => s.id));
      for (const s of sc.shades) {
        let id = s.id;
        if (!id) { id = this.allocShadeId(used); used.add(id); }
        const shade = { id, pos: [...s.pos], state: 'chase', stun: 0 };
        this.constrainShade(shade); // a shade can never stand inside a lantern's safe circle, even at tick 0
        this.shades.push(shade);
      }
    }
  }

  get timeLeft() { return this.duration - this.steps / WORLD.tps; }

  allocShadeId(extraUsed = new Set()) {
    for (;;) {
      const id = `S${this.nextShadeN++}`;
      if (!extraUsed.has(id) && !this.shades.some((s) => s.id === id)) return id;
    }
  }

  addMote(pos, golden = false) {
    const m = { id: `M${this.nextMoteN++}`, pos: [pos[0], pos[1] ?? 0, pos[2]] };
    if (golden) m.golden = true;
    this.motes.push(m);
    return m;
  }

  randomMotePos() {
    for (let tries = 0; ; tries++) {
      const a = this.rand() * Math.PI * 2;
      const r = WORLD.moteMinR + Math.sqrt(this.rand()) * (WORLD.moteMaxR - WORLD.moteMinR);
      const p = [r3(r * Math.sin(a)), 0, r3(r * Math.cos(a))];
      const nearLantern = this.lanterns.some((l) => distXZ(l.pos, p) < 2);
      if (!nearLantern || tries > 10) return p;
    }
  }

  /** Keep a shade out of every lantern's safe circle and within the play area. */
  constrainShade(s) {
    for (const l of this.lanterns) {
      const d = distXZ(s.pos, l.pos);
      if (d <= this.t.safe_radius + EPS) {
        let dx = s.pos[0] - l.pos[0], dz = s.pos[2] - l.pos[2];
        if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
        const R = this.t.safe_radius + WORLD.safeEps;
        s.pos[0] = l.pos[0] + dx * R;
        s.pos[2] = l.pos[2] + dz * R;
      }
    }
    const rr = Math.hypot(s.pos[0], s.pos[2]);
    if (rr > WORLD.shadeMaxRadius) {
      s.pos[0] *= WORLD.shadeMaxRadius / rr;
      s.pos[2] *= WORLD.shadeMaxRadius / rr;
    }
  }

  /**
   * Advance one tick. `input` is the full held-input state for this tick:
   * { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash }.
   * Returns the list of events produced (tick = state index after this step).
   */
  step(input) {
    const events = [];
    if (this.state !== 'playing') return events;
    const T = this.t;
    this.steps += 1;
    const tick = this.steps;
    const ev = (name, data) => events.push({ type: 'event', tick, name, data });
    const edge = (k) => !!input[k] && !this.prevButtons[k];
    const jumpE = edge('jump'), interactE = edge('interact'), pulseE = edge('pulse');
    for (const k of Object.keys(this.prevButtons)) this.prevButtons[k] = !!input[k];

    // 1. timers
    if (this.invuln > 0) this.invuln--;
    if (this.pulseCooldown > 0) this.pulseCooldown--;
    if (this.boost > 0) this.boost--;
    for (const s of this.shades) {
      if (s.stun > 0) { s.stun--; if (s.stun === 0) s.state = 'chase'; }
    }

    // 2. player movement
    const p = this.player;
    const [wx, wz] = worldMove(input.move || [0, 0], input.cam_yaw_deg || 0);
    const speed = T.player_speed * (this.boost > 0 ? 1.4 : 1);
    p.pos[0] += (wx * speed) / WORLD.tps;
    p.pos[2] += (wz * speed) / WORLD.tps;
    const pr = Math.hypot(p.pos[0], p.pos[2]);
    if (pr > WORLD.islandRadius) {
      p.pos[0] *= WORLD.islandRadius / pr;
      p.pos[2] *= WORLD.islandRadius / pr;
    }
    const grounded = p.pos[1] <= 0 && p.vy <= 0;
    if (jumpE && grounded) p.vy = WORLD.jumpSpeed;
    if (p.pos[1] > 0 || p.vy > 0) {
      p.vy -= WORLD.gravity / WORLD.tps;
      p.pos[1] += p.vy / WORLD.tps;
      if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
    }

    // 3. pick up fireflies (automatic on contact)
    if (p.carried < T.carry_capacity) {
      const keep = [];
      for (const m of this.motes) {
        if (p.carried < T.carry_capacity && within(p.pos, m.pos, T.pickup_radius)) {
          p.carried += 1;
          this.score += T.score.per_mote;
          if (m.golden) this.boost = secToTicks(4);
          ev('mote_picked', { carried: p.carried });
        } else keep.push(m);
      }
      this.motes = keep;
    }

    // 4. interact: deposit into nearest unlit lantern in range
    if (interactE && p.carried > 0) {
      let best = null, bestD = Infinity;
      for (const l of this.lanterns) {
        const d = distXZ(p.pos, l.pos);
        if (!l.lit && d <= T.interact_radius + EPS && d < bestD) { best = l; bestD = d; }
      }
      if (best) {
        const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= T.lantern_cost) {
            best.lit = true;
            this.score += T.score.per_lantern;
            ev('lantern_lit', { lantern_id: best.id });
            if (this.checkAllLit(ev)) return events;
          }
        }
      }
    }

    // 5. pulse: costs fireflies, stuns + pushes shades in radius
    if (pulseE && this.pulseCooldown === 0 && p.carried >= T.pulse_cost) {
      p.carried -= T.pulse_cost;
      this.pulseCooldown = secToTicks(T.pulse_cooldown_s);
      this.lastPulseTick = tick;
      const stunned = [];
      for (const s of this.shades) {
        const d = distXZ(p.pos, s.pos);
        if (d <= T.pulse_radius + EPS) {
          let dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2];
          if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
          s.pos[0] += dx * T.pulse_push_m;
          s.pos[2] += dz * T.pulse_push_m;
          this.constrainShade(s);
          s.state = 'stunned';
          s.stun = secToTicks(T.pulse_stun_s);
          stunned.push(s.id);
          this.score += T.score.per_stun;
        }
      }
      stunned.sort();
      ev('pulse', { stunned_ids: stunned });
    }

    // 6. shades chase
    const step = T.shade_speed / WORLD.tps;
    for (const s of this.shades) {
      if (s.state === 'stunned') continue;
      const d = distXZ(s.pos, p.pos);
      if (d > 1e-9) {
        const k = Math.min(step, d) / d;
        s.pos[0] += (p.pos[0] - s.pos[0]) * k;
        s.pos[2] += (p.pos[2] - s.pos[2]) * k;
      }
      this.constrainShade(s);
    }

    // 7. shade contact
    if (this.invuln === 0) {
      const hitter = this.shades.find(
        (s) => s.state !== 'stunned' && within(s.pos, p.pos, T.shade_hit_radius),
      );
      if (hitter) {
        p.flames = Math.max(0, p.flames - 1);
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        this.invuln = secToTicks(T.invuln_s);
        this.lastHitTick = tick;
        ev('player_hit', { by: 'shade', flames: p.flames, dropped });
        if (p.flames <= 0) { this.end('lost', 'no_flames', ev); return events; }
      }
    }

    // 8. spawning (only when the night generates entities)
    if (this.randomMotes) {
      if (this.moteRespawnTimer > 0) this.moteRespawnTimer--;
      if (this.motes.length < WORLD.moteMinActive && this.moteRespawnTimer === 0) {
        this.addMote(this.randomMotePos());
        this.moteRespawnTimer = secToTicks(WORLD.moteRespawnS);
      }
      // creative: a golden firefly appears every 20 s (GUI only)
      if (this.creative && tick % secToTicks(20) === 0 && !this.motes.some((m) => m.golden)) {
        this.addMote(this.randomMotePos(), true);
      }
    }
    if (this.randomShades) {
      if (this.shadeSpawnTimer > 0) this.shadeSpawnTimer--;
      if (this.shadeSpawnTimer === 0 && this.shades.length < WORLD.shadeMax) {
        let a = this.rand() * Math.PI * 2;
        let pos = [WORLD.shadeSpawnRing * Math.sin(a), WORLD.shadeHeight, WORLD.shadeSpawnRing * Math.cos(a)];
        if (distXZ(pos, p.pos) < 12) { pos = [-pos[0], pos[1], -pos[2]]; }
        const s = { id: this.allocShadeId(), pos, state: 'chase', stun: 0 };
        this.constrainShade(s);
        this.shades.push(s);
        ev('shade_spawned', { id: s.id });
        this.shadeSpawnTimer = secToTicks(WORLD.shadeEveryS);
      }
    }

    // 9. scenario edge cases: a night that starts fully lit is won; a player with no flames has lost
    if (this.checkAllLit(ev)) return events;
    if (p.flames <= 0) { this.end('lost', 'no_flames', ev); return events; }

    // 10. dawn
    if (this.timeLeft <= 1e-9) this.end('lost', 'dawn', ev);
    return events;
  }

  /** Win when every lantern is lit: +per_second_left × floor(time left) +per_flame_left × flames. */
  checkAllLit(ev) {
    if (this.state !== 'playing' || !this.lanterns.every((l) => l.lit)) return false;
    const T = this.t;
    this.score += T.score.per_second_left * Math.floor(Math.max(0, this.timeLeft));
    this.score += T.score.per_flame_left * this.player.flames;
    this.end('won', 'all_lit', ev);
    return true;
  }

  end(result, reason, ev) {
    this.state = result;
    this.result = { result, reason };
    ev('game_over', { result, reason });
  }

  snapshot() {
    return {
      type: 'snapshot',
      tick: this.steps,
      sim_tick: this.steps,
      state: this.state,
      time_left_s: r3(Math.max(0, this.timeLeft)),
      score: this.score,
      player: {
        pos: this.player.pos.map(r3),
        flames: this.player.flames,
        carried: this.player.carried,
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
    };
  }
}
