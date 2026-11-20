// Regression check between two git refs: runs the same headless cases on both and compares output
// after removing fields that the newer contract only ADDS.
// Usage: node tools/regress.mjs <oldRef> [newRef=WORKTREE] [--drop=f1,f2] [--skip=prefix1,prefix2]
import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [oldRef, newRefArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dropArg = process.argv.find((a) => a.startsWith('--drop='));
const DROP = new Set(dropArg ? dropArg.slice(7).split(',') : []);
// scenarios that exercise features the old ref does not have (e.g. --skip=p3-) are left out
const skipArg = process.argv.find((a) => a.startsWith('--skip='));
const SKIP = skipArg ? skipArg.slice(7).split(',') : [];
const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-regress-'));
const extract = (ref) => { const d = path.join(tmp, ref.replace(/\W/g, '_')); fs.mkdirSync(d); execSync(`git archive ${ref} | tar -x -C "${d}"`, { cwd: root, shell: 'bash' }); return d; };
const oldDir = extract(oldRef);
const newDir = newRefArg ? extract(newRefArg) : root;
const sc = (n) => path.join(root, 'tests', 'scenarios', n);
const cases = [];
for (const night of [1, 2]) for (const seed of [1, 2, 3, 7]) cases.push({ name: `default n${night} s${seed} idle`, args: ['--seed', seed, '--night', night, '--ticks', 6000] });
for (const f of fs.readdirSync(path.join(root, 'tests', 'scenarios')).filter((f) => f.endsWith('.scenario.json') && !SKIP.some((p) => f.startsWith(p)))) {
  const base = f.replace('.scenario.json', ''); const inp = sc(`${base}.inputs.json`);
  const night = base.startsWith('p2-') ? 2 : 1;
  cases.push({ name: base, args: ['--seed', 1, '--night', night, '--ticks', 2000, '--snapshot-every', 1, '--scenario', sc(f), ...(fs.existsSync(inp) ? ['--inputs', inp] : [])] });
}
for (const n of [1, 2]) { const ap = sc(n === 1 ? 'autopilot-seed1.inputs.json' : 'autopilot-night2-seed1.inputs.json'); if (fs.existsSync(ap)) cases.push({ name: `autopilot n${n}`, args: ['--seed', 1, '--night', n, '--ticks', 21600, '--inputs', ap] }); }
const strip = (o) => { if (Array.isArray(o)) return o.map(strip); if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([k]) => !DROP.has(k)).map(([k, v]) => [k, strip(v)])); return o; };
const run = (dir, args, out) => { const p = spawnSync(process.execPath, ['src/headless.js', ...args.map(String), '--out', out], { cwd: dir, encoding: 'utf8' }); return { code: p.status, text: fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.stringify(strip(JSON.parse(l)))).join('\n') : '' }; };
let same = 0;
for (const c of cases) {
  const a = run(oldDir, c.args, path.join(tmp, 'a.jsonl')), b = run(newDir, c.args, path.join(tmp, 'b.jsonl'));
  const ok = a.code === b.code && a.text === b.text;
  if (ok) same++;
  console.log(`${ok ? 'SAME' : 'DIFF'}  ${c.name}${ok ? '' : `  (exit ${a.code} vs ${b.code})`}`);
}
console.log(`regress ${oldRef} → ${newRefArg || 'worktree'}: ${same}/${cases.length} identical (ignoring added fields: ${[...DROP].join(', ') || 'none'})`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(same === cases.length ? 0 : 1);
