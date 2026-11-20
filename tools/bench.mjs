// Performance measurement (Ticket-04):  npm run bench
// For each night: a full default night (random fireflies + shades) where the player waits inside a lit lantern's
// safe circle so the night really lasts until dawn. Measures (a) the real CLI with --snapshot-every 1 (median of 3)
// and (b) the average gameplay step in-process. Thresholds: CLI < 2 s per night, step < 0.5 ms.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, defaultLanterns } from '../src/sim.js';
import { NIGHTS } from '../src/tuning.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT_CLI_MS = 2000, LIMIT_STEP_MS = 0.5;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
const results = [];
for (const night of Object.keys(NIGHTS).map(Number)) {
  const L1 = defaultLanterns(night)[0];
  const scenario = { player: { pos: L1.pos }, lanterns: [{ id: 'L1', lit: true }] };
  const sf = path.join(tmp, `n${night}.json`); fs.writeFileSync(sf, JSON.stringify(scenario));
  const ticks = NIGHTS[night].duration * 60;
  const times = []; let end = null, bytes = 0;
  for (let rep = 0; rep < 3; rep++) {
    const out = path.join(tmp, `o${night}.jsonl`);
    const t0 = performance.now();
    const p = spawnSync(process.execPath, ['src/headless.js', '--seed', '7', '--night', String(night), '--scenario', sf, '--ticks', String(ticks), '--snapshot-every', '1', '--out', out], { cwd: ROOT, encoding: 'utf8' });
    times.push(performance.now() - t0);
    if (p.status !== 0) throw new Error(p.stderr);
    const text = fs.readFileSync(out, 'utf8'); bytes = text.length; end = JSON.parse(text.trim().split('\n').at(-1));
  }
  times.sort((a, b) => a - b);
  const g = new Game({ seed: 7, night, scenario });
  const idle = { move: [0, 0], cam_yaw_deg: 0 };
  const s0 = performance.now();
  while (g.state === 'playing' && g.tick < ticks) g.step(idle);
  const stepMs = (performance.now() - s0) / g.steps;
  results.push({
    night, ticks_requested: ticks, end, output_mb: +(bytes / 1e6).toFixed(1),
    cli_ms_median: +times[1].toFixed(0), cli_ms_runs: times.map((t) => +t.toFixed(0)),
    ticks_per_s_cli: Math.round(end.ticks / (times[1] / 1000)),
    step_ms_avg: +stepMs.toFixed(4), realtime_factor: Math.round((1000 / 60) / stepMs),
    shades_at_end: g.shades.length, ok: times[1] < LIMIT_CLI_MS && stepMs < LIMIT_STEP_MS && end.ticks === ticks,
  });
}
fs.rmSync(tmp, { recursive: true, force: true });
const report = {
  generated: new Date().toISOString(), machine: `${os.type()} ${os.release()} · ${os.cpus()[0]?.model?.trim()} ×${os.cpus().length} · ${Math.round(os.totalmem() / 2 ** 30)} GB · Node ${process.version}`,
  thresholds: { cli_ms_per_night: LIMIT_CLI_MS, step_ms: LIMIT_STEP_MS }, results, ok: results.every((r) => r.ok),
};
const outDir = path.join(ROOT, 'docs', 'proof', 'phase-4'); fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'bench.json'), JSON.stringify(report, null, 2) + '\n');
for (const r of results) console.log(`night ${r.night}: ${r.end.ticks} ticks to ${r.end.state} · CLI ${r.cli_ms_median} ms (limit ${LIMIT_CLI_MS}) · ${r.ticks_per_s_cli} ticks/s · step ${r.step_ms_avg} ms (limit ${LIMIT_STEP_MS}) = ${r.realtime_factor}× real time · ${r.ok ? 'PASS' : 'FAIL'}`);
console.log(`bench: ${report.ok ? 'PASS' : 'FAIL'} (${report.machine})`);
process.exit(report.ok ? 0 : 1);
