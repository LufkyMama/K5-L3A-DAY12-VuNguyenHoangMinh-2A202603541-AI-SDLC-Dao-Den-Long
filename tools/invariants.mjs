// Stability invariants (Ticket-04) checked on parsed headless output lines. Returns a list of violations ([] = OK).
// Kept independent of src/sim.js on purpose: it reads only the contract output + game.contract.json numbers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8')).tuning;
const ISLAND_R = 40; // documented in docs/notes/phase-1.md (assumption 8)
const TOL = 2e-3; // output is rounded to 3 decimals

const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function allFinite(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(allFinite);
  if (v && typeof v === 'object') return Object.values(v).every(allFinite);
  return true;
}

export function checkRun(lines, { startFlames } = {}) {
  const bad = [];
  const v = (msg) => { if (bad.length < 20) bad.push(msg); };
  if (!lines.length) return ['no output'];
  const end = lines.at(-1);
  if (end.type !== 'end') v('last line is not {type:"end"}');
  if (end.type === 'end' && !['playing', 'won', 'lost'].includes(end.state)) v(`end.state ${end.state}`);
  const snaps = lines.filter((l) => l.type === 'snapshot');
  const events = lines.filter((l) => l.type === 'event');
  if (!snaps.length || snaps[0].tick !== 0) v('first snapshot is not tick 0');
  const maxFlames = startFlames ?? snaps[0]?.player.flames ?? T.flames;
  let prev = null;
  for (const s of snaps) {
    const at = `tick ${s.tick}`;
    if (!allFinite(s)) v(`${at}: non-finite number`);
    const p = s.player;
    if (!(p.flames >= 0 && p.flames <= maxFlames)) v(`${at}: flames ${p.flames} outside [0, ${maxFlames}]`);
    if (!(p.carried >= 0)) v(`${at}: carried ${p.carried}`);
    if (Math.hypot(p.pos[0], p.pos[2]) > ISLAND_R + TOL) v(`${at}: player off the island`);
    if (!(s.sim_tick <= s.tick)) v(`${at}: sim_tick ${s.sim_tick} > tick`);
    for (const sh of s.shades) {
      for (const l of s.lanterns) {
        if (l.lit && dist(sh.pos, l.pos) < T.safe_radius - TOL) v(`${at}: shade ${sh.id} inside lit ${l.id}`);
      }
    }
    if (prev) {
      if (s.tick <= prev.tick) v(`${at}: snapshot ticks not increasing`);
      if (s.score < prev.score) v(`${at}: score decreased ${prev.score} → ${s.score}`);
      if (s.time_left_s > prev.time_left_s + 1e-9) v(`${at}: time_left_s increased`);
      if (s.sim_tick < prev.sim_tick) v(`${at}: sim_tick decreased`);
      for (const l of prev.lanterns) {
        const now = s.lanterns.find((x) => x.id === l.id);
        if (l.lit && !(now && now.lit)) v(`${at}: lantern ${l.id} went out`);
        if (now && now.deposited < l.deposited) v(`${at}: lantern ${l.id} deposited decreased`);
      }
    }
    prev = s;
  }
  let lastTick = 0;
  for (const e of events) {
    if (e.tick < lastTick) v(`event ticks not ordered at ${e.tick}`);
    lastTick = e.tick;
    if (end.type === 'end' && (e.tick < 1 || e.tick > end.ticks)) v(`event tick ${e.tick} outside [1, ${end.ticks}]`);
    if (!allFinite(e)) v(`event ${e.name}: non-finite number`);
  }
  if (end.type === 'end' && end.state !== 'playing' && !events.some((e) => e.name === 'game_over')) v('game ended without game_over event');
  if (end.type === 'end' && prev && end.score !== prev.score && prev.tick === end.ticks) v('end.score differs from last snapshot at same tick');
  return bad;
}
