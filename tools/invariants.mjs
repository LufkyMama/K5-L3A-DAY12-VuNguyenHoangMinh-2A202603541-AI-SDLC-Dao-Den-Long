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
  const maxCarried = Math.max(T.carry_capacity, snaps[0]?.player.carried ?? 0);
  // time_left_s = duration − sim_tick/60 (contract B): the sum must stay constant, also across pauses
  const clock = snaps[0] ? snaps[0].time_left_s + snaps[0].sim_tick / 60 : 0;
  const ids0 = snaps[0] ? snaps[0].lanterns.map((l) => l.id).join(',') : '';
  let prev = null;
  for (const s of snaps) {
    const at = `tick ${s.tick}`;
    if (!allFinite(s)) v(`${at}: non-finite number`);
    const p = s.player;
    if (!(p.flames >= 0 && p.flames <= maxFlames)) v(`${at}: flames ${p.flames} outside [0, ${maxFlames}]`);
    if (!(p.carried >= 0 && p.carried <= maxCarried)) v(`${at}: carried ${p.carried} outside [0, ${maxCarried}]`);
    if (!['playing', 'won', 'lost'].includes(s.state)) v(`${at}: state ${s.state}`);
    if (s.time_left_s < 0) v(`${at}: negative time_left_s`);
    if (s.time_left_s > 0 && Math.abs(s.time_left_s + s.sim_tick / 60 - clock) > TOL) v(`${at}: time_left_s ${s.time_left_s} ≠ duration − sim_tick/60`);
    if (s.lanterns.map((l) => l.id).join(',') !== ids0) v(`${at}: lantern ids changed`);
    if (s.night !== undefined && s.night !== snaps[0].night) v(`${at}: night changed`);
    const sid = s.shades.map((x) => x.id); if (new Set(sid).size !== sid.length) v(`${at}: duplicate shade ids`);
    for (const sh of s.shades) if (sh.kind !== undefined && !['ink', 'big'].includes(sh.kind)) v(`${at}: shade kind ${sh.kind}`);
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
      if (s.player.flames > prev.player.flames) v(`${at}: flames increased ${prev.player.flames} → ${s.player.flames}`);
      for (const l of prev.lanterns) {
        const now = s.lanterns.find((x) => x.id === l.id);
        if (l.lit && !(now && now.lit)) v(`${at}: lantern ${l.id} went out`);
        if (now && now.deposited < l.deposited) v(`${at}: lantern ${l.id} deposited decreased`);
      }
    }
    prev = s;
  }
  let lastTick = 0;
  // interleaving: an event of tick k must come after the snapshot of tick k-1 and before any snapshot of tick > k
  let snapTick = -1;
  for (const l of lines) { if (l.type === 'snapshot') snapTick = l.tick; else if (l.type === 'event' && l.tick <= snapTick) v(`event ${l.name}@${l.tick} written after snapshot ${snapTick}`); }
  for (const e of events) {
    if (e.tick < lastTick) v(`event ticks not ordered at ${e.tick}`);
    lastTick = e.tick;
    if (end.type === 'end' && (e.tick < 1 || e.tick > end.ticks)) v(`event tick ${e.tick} outside [1, ${end.ticks}]`);
    if (!allFinite(e)) v(`event ${e.name}: non-finite number`);
    const d = e.data || {};
    if (e.name === 'mote_picked' && !(d.carried >= 1 && d.carried <= maxCarried)) v(`mote_picked carried ${d.carried}`);
    if (e.name === 'player_hit' && !(d.flames >= 0 && d.flames < maxFlames && d.dropped >= 0)) v(`player_hit data ${JSON.stringify(d)}`);
  }
  if (end.type === 'end' && end.state !== 'playing' && !events.some((e) => e.name === 'game_over')) v('game ended without game_over event');
  if (end.type === 'end' && prev && end.score !== prev.score && prev.tick === end.ticks) v('end.score differs from last snapshot at same tick');
  return bad;
}
