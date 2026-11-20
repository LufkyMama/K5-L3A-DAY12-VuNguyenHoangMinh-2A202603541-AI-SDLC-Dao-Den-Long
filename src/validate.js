// Strict validation for --inputs and --scenario files (contract C, D).
// Any problem throws FormatError -> headless exits with code 2.
export class FormatError extends Error {}

const fail = (msg) => { throw new FormatError(msg); };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const BUTTONS = ['jump', 'interact', 'pulse', 'dash'];
export const LANTERN_IDS = ['L1', 'L2', 'L3', 'L4', 'L5'];

export function validateInputs(doc) {
  if (!isObj(doc) || !Array.isArray(doc.frames)) fail('inputs: expected {"frames": [...]}');
  let prev = -1;
  doc.frames.forEach((f, i) => {
    const at = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${at}: frame must be an object`);
    if (!isInt(f.tick) || f.tick < 0) fail(`${at}.tick: must be an integer >= 0`);
    if (f.tick <= prev) fail(`${at}.tick: ticks must be strictly increasing`);
    prev = f.tick;
    if ('move' in f) {
      const m = f.move;
      if (!Array.isArray(m) || m.length !== 2 || !m.every(isNum) || m.some((v) => v < -1 || v > 1)) {
        fail(`${at}.move: must be [x, z] with each value in [-1, 1]`);
      }
    }
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) fail(`${at}.cam_yaw_deg: must be a number`);
    for (const b of BUTTONS) if (b in f && typeof f[b] !== 'boolean') fail(`${at}.${b}: must be boolean`);
  });
  return doc;
}

export function validateScenario(doc) {
  if (!isObj(doc)) fail('scenario: must be a JSON object');
  if ('player' in doc) {
    const p = doc.player;
    if (!isObj(p)) fail('scenario.player: must be an object');
    if ('pos' in p && !isVec3(p.pos)) fail('scenario.player.pos: must be [x, y, z]');
    if ('carried' in p && (!isInt(p.carried) || p.carried < 0)) fail('scenario.player.carried: integer >= 0');
    if ('flames' in p && (!isInt(p.flames) || p.flames < 0)) fail('scenario.player.flames: integer >= 0');
  }
  for (const k of ['random_motes', 'random_shades']) {
    if (k in doc && typeof doc[k] !== 'boolean') fail(`scenario.${k}: must be boolean`);
  }
  if ('motes' in doc) {
    if (!Array.isArray(doc.motes)) fail('scenario.motes: must be an array');
    doc.motes.forEach((m, i) => { if (!isVec3(m)) fail(`scenario.motes[${i}]: must be [x, y, z]`); });
  }
  if ('shades' in doc) {
    if (!Array.isArray(doc.shades)) fail('scenario.shades: must be an array');
    const ids = new Set();
    doc.shades.forEach((s, i) => {
      if (!isObj(s) || !isVec3(s.pos)) fail(`scenario.shades[${i}]: needs pos [x, y, z]`);
      if ('id' in s) {
        if (typeof s.id !== 'string' || !s.id) fail(`scenario.shades[${i}].id: non-empty string`);
        if (ids.has(s.id)) fail(`scenario.shades[${i}].id: duplicate id ${s.id}`);
        ids.add(s.id);
      }
    });
  }
  if ('lanterns' in doc) {
    if (!Array.isArray(doc.lanterns)) fail('scenario.lanterns: must be an array');
    doc.lanterns.forEach((l, i) => {
      if (!isObj(l) || !LANTERN_IDS.includes(l.id)) fail(`scenario.lanterns[${i}].id: must be one of L1..L5`);
      if ('pos' in l && !isVec3(l.pos)) fail(`scenario.lanterns[${i}].pos: must be [x, y, z]`);
      if ('deposited' in l && (!isInt(l.deposited) || l.deposited < 0)) fail(`scenario.lanterns[${i}].deposited: integer >= 0`);
      if ('lit' in l && typeof l.lit !== 'boolean') fail(`scenario.lanterns[${i}].lit: must be boolean`);
    });
  }
  if ('time_left_s' in doc && (!isNum(doc.time_left_s) || doc.time_left_s < 0)) {
    fail('scenario.time_left_s: number >= 0');
  }
  return doc;
}
