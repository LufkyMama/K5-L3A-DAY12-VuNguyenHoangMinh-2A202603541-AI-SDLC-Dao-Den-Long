// Hook: keeps the agent honest about tests.
//   post  (PostToolUse on Edit/Write): if a game/test/contract file changed, run the tests;
//         on failure exit 2 so the failure is fed back to the agent immediately.
//   stop  (Stop): run the tests; if red, exit 2 to block the agent from finishing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const mode = process.argv[2];
let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* no payload */ }

const run = () => spawnSync(process.execPath, ['--test', 'tests/*.test.js'], {
  cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(), encoding: 'utf8',
});

if (mode === 'post') {
  const file = String(payload?.tool_input?.file_path || '').replace(/\\/g, '/');
  if (!/\/(src|tests|tools)\/|game\.contract\.json$/.test(file)) process.exit(0);
}

const r = run();
if (r.status === 0) process.exit(0);
const tail = (r.stdout + r.stderr).split('\n')
  .filter((l) => /not ok|✖|Error|expected|actual|fail \d/.test(l)).slice(0, 40).join('\n');
if (mode === 'stop' && payload?.stop_hook_active) {
  // Already blocked once this turn: don't loop forever, but say it loudly.
  process.stderr.write(`WARNING: tests are still RED. Do not claim the work is done.\n${tail}\n`);
  process.exit(0);
}
process.stderr.write(`Tests are RED. Fix the code (not the expectation) before continuing.\n${tail}\n`);
process.exit(2);
