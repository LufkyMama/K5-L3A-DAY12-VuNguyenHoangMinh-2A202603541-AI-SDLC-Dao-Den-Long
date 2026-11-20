#!/usr/bin/env node
// Headless runner (Test Contract v1.0 section B).
// node src/headless.js --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out f.jsonl [--snapshot-every n]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Game } from './sim.js';
import { NIGHTS } from './tuning.js';
import { FormatError, validateInputs, validateScenario } from './validate.js';

class UsageError extends Error {}

function parseArgs(argv) {
  const known = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) throw new UsageError(`unexpected argument: ${tok}`);
    let key = tok.slice(2), val;
    const eq = key.indexOf('=');
    if (eq >= 0) { val = key.slice(eq + 1); key = key.slice(0, eq); } // --ticks=600
    const next = argv[i + 1];
    const nextIsValue = next !== undefined && !(next.startsWith('--') && !/^--?\d/.test(next));
    if (!known.has(key)) {
      // unknown flag: warn and skip it (and its value, if it has one), never abort the run
      process.stderr.write(`warning: ignoring unknown flag --${key}\n`);
      if (val === undefined && nextIsValue) i++;
      continue;
    }
    if (val === undefined) {
      if (!nextIsValue) throw new UsageError(`missing value for --${key}`);
      val = next; i++;
    }
    a[key] = val;
  }
  const int = (k, def) => {
    if (a[k] === undefined) {
      if (def === undefined) throw new UsageError(`--${k} is required`);
      return def;
    }
    if (!/^-?\d+$/.test(a[k])) throw new UsageError(`--${k} must be an integer`);
    return Number(a[k]);
  };
  const opts = {
    seed: int('seed', 0),
    night: int('night', 1),
    ticks: int('ticks'),
    every: int('snapshot-every', 10),
    scenario: a.scenario,
    inputs: a.inputs,
    out: a.out,
  };
  if (!opts.out) throw new UsageError('--out is required');
  if (opts.ticks < 0) throw new UsageError('--ticks must be >= 0');
  if (opts.every < 1) throw new UsageError('--snapshot-every must be >= 1');
  if (!NIGHTS[opts.night]) throw new UsageError(`--night ${opts.night} is not available (nights: ${Object.keys(NIGHTS).join(', ')})`);
  return opts;
}

function readJson(path, label) {
  let text;
  try { text = fs.readFileSync(path, 'utf8'); } catch (e) { throw new FormatError(`${label}: cannot read ${path}: ${e.message}`); }
  try { return JSON.parse(text); } catch (e) { throw new FormatError(`${label}: invalid JSON in ${path}: ${e.message}`); }
}

export function run(opts) {
  const scenario = opts.scenario ? validateScenario(readJson(opts.scenario, 'scenario'), NIGHTS[opts.night].lanterns) : null;
  const frames = opts.inputs ? validateInputs(readJson(opts.inputs, 'inputs')).frames : [];
  const game = new Game({ seed: opts.seed, night: opts.night, scenario, creative: false });

  const fd = fs.openSync(opts.out, 'w');
  let buf = [];
  const emit = (o) => {
    buf.push(JSON.stringify(o));
    if (buf.length >= 2000) { fs.writeSync(fd, buf.join('\n') + '\n'); buf = []; }
  };

  const held = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let fi = 0;
  emit(game.snapshot());
  for (let k = 0; k < opts.ticks && game.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      for (const key of Object.keys(held)) if (key in f) held[key] = f[key];
    }
    for (const e of game.step(held)) emit(e);
    if (game.tick % opts.every === 0) emit(game.snapshot());
  }
  emit({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
  fs.writeSync(fd, buf.join('\n') + '\n');
  fs.closeSync(fd);
  return game;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  try {
    run(parseArgs(process.argv.slice(2)));
    process.exit(0);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(e instanceof FormatError ? 2 : 1);
  }
}
