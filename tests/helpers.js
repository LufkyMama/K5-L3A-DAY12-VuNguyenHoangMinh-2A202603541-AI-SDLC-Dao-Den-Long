import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
export const T = CONTRACT.tuning;

/** Run the real headless CLI exactly as a grader would (headless_cmd + flags). */
export function headless({ seed = 1, scenario, inputs, ticks = 60, every, rawInputs, rawScenario, extra = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
  const args = ['src/headless.js', '--seed', String(seed), '--night', '1', '--ticks', String(ticks)];
  if (scenario || rawScenario !== undefined) {
    const f = path.join(dir, 'scenario.json');
    fs.writeFileSync(f, rawScenario ?? JSON.stringify(scenario));
    args.push('--scenario', f);
  }
  if (inputs || rawInputs !== undefined) {
    const f = path.join(dir, 'inputs.json');
    fs.writeFileSync(f, rawInputs ?? JSON.stringify(inputs));
    args.push('--inputs', f);
  }
  const out = path.join(dir, 'out.jsonl');
  args.push('--out', out);
  if (every) args.push('--snapshot-every', String(every));
  args.push(...extra);
  const p = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const lines = text.trim() ? text.trim().split('\n').map((l) => JSON.parse(l)) : [];
  return {
    code: p.status,
    stderr: p.stderr,
    text,
    lines,
    snaps: lines.filter((l) => l.type === 'snapshot'),
    events: lines.filter((l) => l.type === 'event'),
    end: lines[lines.length - 1],
    ev(name) { return this.events.filter((e) => e.name === name); },
    snapAt(tick) { return this.snaps.find((s) => s.tick === tick); },
  };
}

/** Empty, controlled world: no random motes/shades. */
export const quiet = (extra = {}) => ({ random_motes: false, random_shades: false, motes: [], shades: [], ...extra });
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
