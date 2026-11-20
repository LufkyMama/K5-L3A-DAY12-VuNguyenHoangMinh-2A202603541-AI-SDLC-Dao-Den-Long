// Greedy autopilot: plays the DEFAULT night (no scenario) and records an inputs file.
// Used as evidence that Night 1 is winnable end-to-end; the recorded file is then replayed
// through the real headless CLI (tools/proof.js) so the proof does not depend on this code.
import { Game } from '../src/sim.js';
import { TUNING as T } from '../src/tuning.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function autopilot(seed, maxTicks = T.night1_duration_s * 60) {
  const g = new Game({ seed });
  const frames = [];
  let last = {};
  let interactHeld = false, pulseHeld = false;
  for (let k = 0; k < maxTicks && g.state === 'playing'; k++) {
    const p = g.player;
    const unlit = g.lanterns.filter((l) => !l.lit);
    const nearestL = unlit.reduce((b, l) => (!b || d2(p.pos, l.pos) < d2(p.pos, b.pos) ? l : b), null);
    const need = nearestL ? T.lantern_cost - nearestL.deposited : 0;
    let target;
    if (nearestL && (p.carried >= Math.min(need, T.carry_capacity) || (p.carried > 0 && g.motes.length === 0))) target = nearestL.pos;
    else if (g.motes.length) target = g.motes.reduce((b, m) => (!b || d2(p.pos, m.pos) < d2(p.pos, b.pos) ? m : b), null).pos;
    else target = [0, 0, 0];

    let dir = [target[0] - p.pos[0], target[2] - p.pos[2]];
    // flee/steer away from close active shades
    const threats = g.shades.filter((s) => s.state !== 'stunned' && d2(s.pos, p.pos) < 4.5);
    let pulse = false;
    if (threats.length) {
      if (p.carried >= T.pulse_cost && g.pulseCooldown === 0 && !pulseHeld) pulse = true;
      for (const s of threats) {
        const dd = Math.max(0.3, d2(s.pos, p.pos));
        dir[0] += ((p.pos[0] - s.pos[0]) / dd) * 12;
        dir[1] += ((p.pos[2] - s.pos[2]) / dd) * 12;
      }
    }
    const len = Math.hypot(dir[0], dir[1]);
    const move = len > 0.05 ? [Math.round((dir[0] / len) * 100) / 100, Math.round((dir[1] / len) * 100) / 100] : [0, 0];
    const interact = !interactHeld && nearestL && p.carried > 0 && d2(p.pos, nearestL.pos) <= T.interact_radius - 0.2;
    interactHeld = interact; pulseHeld = pulse;

    const inp = { move, cam_yaw_deg: 0, interact: !!interact, pulse };
    const f = { tick: k };
    for (const key of Object.keys(inp)) if (JSON.stringify(inp[key]) !== JSON.stringify(last[key])) f[key] = inp[key];
    if (Object.keys(f).length > 1) frames.push(f);
    last = inp;
    g.step(inp);
  }
  return { frames, state: g.state, result: g.result, score: g.score, ticks: g.steps };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/autopilot.js') && process.argv[2]) {
  const r = autopilot(Number(process.argv[2]));
  console.log(JSON.stringify({ state: r.state, result: r.result, score: r.score, ticks: r.ticks, frames: r.frames.length }));
}
