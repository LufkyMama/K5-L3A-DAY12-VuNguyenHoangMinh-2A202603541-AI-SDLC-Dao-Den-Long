// "Sáng tạo của tôi" must not change headless output: extras exist only with creative:true (GUI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim.js';
import { headless } from './helpers.js';

const move = (k) => [Math.round(Math.sin(k / 90) * 100) / 100, Math.round(Math.cos(k / 90) * 100) / 100];
const TICKS = 60 * 60;

function inProcess(creative) {
  const g = new Game({ seed: 3, creative });
  const snaps = [g.snapshot()];
  let golden = 0;
  for (let k = 0; k < TICKS && g.state === 'playing'; k++) {
    g.step({ move: move(k), cam_yaw_deg: 0 });
    golden = Math.max(golden, g.motes.filter((m) => m.golden).length);
    if (g.steps % 600 === 0) snaps.push(g.snapshot());
  }
  return { snaps, golden };
}

test('golden fireflies appear only when creative is on (GUI)', () => {
  assert.equal(inProcess(false).golden, 0);
  assert.ok(inProcess(true).golden > 0);
});

test('headless CLI output equals the creative:false game, and differs from creative:true', () => {
  const frames = Array.from({ length: TICKS }, (_, k) => ({ tick: k, move: move(k) }));
  const cli = headless({ seed: 3, ticks: TICKS, every: 600, inputs: { frames } });
  assert.equal(cli.code, 0, cli.stderr);
  assert.deepEqual(cli.snaps, inProcess(false).snaps);
  assert.notDeepEqual(cli.snaps, inProcess(true).snaps);
});
