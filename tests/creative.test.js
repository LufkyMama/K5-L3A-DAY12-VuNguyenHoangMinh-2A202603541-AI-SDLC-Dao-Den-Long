// "Sáng tạo của tôi" must not change headless output: extras exist only with creative:true (GUI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim.js';

const play = (creative) => {
  const g = new Game({ seed: 3, creative });
  let golden = 0;
  for (let k = 0; k < 60 * 120 && g.state === 'playing'; k++) {
    g.step({ move: [Math.sin(k / 90), Math.cos(k / 90)], cam_yaw_deg: 0 });
    golden = Math.max(golden, g.motes.filter((m) => m.golden).length);
  }
  return golden;
};

test('golden fireflies appear only when creative is on (GUI)', () => {
  assert.equal(play(false), 0);
  assert.ok(play(true) > 0);
});

test('headless CLI constructs the game with creative:false', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/headless.js', import.meta.url), 'utf8');
  assert.match(src, /creative:\s*false/);
});
