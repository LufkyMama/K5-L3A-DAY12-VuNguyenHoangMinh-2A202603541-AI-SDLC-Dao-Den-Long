// GUI playtest: plays the REAL browser game with real keyboard/mouse events (Chrome DevTools Protocol),
// takes screenshots and writes docs/proof/phase-<N>/playtest/PLAYTEST.md with computed PASS/FAIL.
//   npm run playtest -- <phase>        (needs Google Chrome / Chromium; set CHROME_PATH to override)
// It starts its own server (server.js) on a free port and stops it afterwards.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHASE = process.argv[2] || '1';
const OUT = path.join(ROOT, 'docs', 'proof', `phase-${PHASE}`, process.argv.includes('--dist') ? 'playtest-dist' : 'playtest');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
  return c.find((p) => p && fs.existsSync(p));
}
const freePort = () => new Promise((r) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const CHROME = findChrome();
if (!CHROME) { console.error('playtest: Chrome/Chromium not found (set CHROME_PATH)'); process.exit(1); }
const webPort = await freePort(), cdpPort = await freePort();
const DIST = process.argv.includes('--dist');
const server = DIST
  ? spawn(process.execPath, [path.join(ROOT, 'tools/serve-static.mjs'), path.join(ROOT, 'dist/web'), String(webPort)], { stdio: 'ignore' })
  : spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(webPort) }, stdio: 'ignore' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720', '--no-first-run',
  ...(process.env.CI ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} };
process.on('exit', cleanup);

let targets;
for (let i = 0; i < 75 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); } catch { await sleep(200); } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const pageErrors = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') pageErrors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') pageErrors.push(JSON.stringify(d.params.args.map((a) => a.value)));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const t0 = Date.now();
const lines = [];
const log = (s) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`; lines.push(l); console.log(l); };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.result.data, 'base64')); };
const KEYS = { KeyP: ['p', 80], ShiftLeft: ['Shift', 16], KeyW: ['w', 87], KeyA: ['a', 65], KeyS: ['s', 83], KeyD: ['d', 68], KeyE: ['e', 69], KeyF: ['f', 70], KeyR: ['r', 82], Space: [' ', 32] };
const held = new Set();
const keyDown = async (code) => { if (held.has(code)) return; held.add(code); await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: KEYS[code][0], windowsVirtualKeyCode: KEYS[code][1] }); };
const keyUp = async (code) => { if (!held.has(code)) return; held.delete(code); await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: KEYS[code][0], windowsVirtualKeyCode: KEYS[code][1] }); };
const tap = async (code) => { await keyDown(code); await sleep(60); await keyUp(code); };
const clickEl = async (elId) => {
  const c = await ev(`(() => { const b = document.getElementById('${elId}'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  if (!c) return false;
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: c[0], y: c[1], button: 'left', clickCount: 1 });
  return true;
};
const state = () => ev(`(() => { const g = window.__game(); if (!g) return null; return { st: g.state, res: g.result, score: g.score, t: g.timeLeft,
  p: g.player.pos.slice(), fl: g.player.flames, c: g.player.carried, lit: g.lanterns.filter((l) => l.lit).length,
  L: g.lanterns.map((l) => ({ id: l.id, pos: l.pos, lit: l.lit, dep: l.deposited })), M: g.motes.map((m) => m.pos),
  S: g.shades.map((s) => ({ pos: s.pos, st: s.state, kind: s.kind })), cd: g.pulseCooldown, paused: g.paused, dcd: g.dashCooldown, sim: g.steps, pausedOverlay: !document.getElementById('paused')?.classList.contains('hidden'),
  hud: [...document.querySelectorAll('#hud b')].map((b) => b.textContent).join(' | '), hint: document.getElementById('hint').textContent,
  overlay: !document.getElementById('overlay').classList.contains('hidden'), card: document.getElementById('card').innerText.replace(/\\n+/g, ' / ') }; })()`);

const checks = [];
let night1Score = null;
const check = (req, ok, detail) => { checks.push({ req, ok: !!ok, detail }); log(`${ok ? 'PASS' : 'FAIL'} ${req}: ${detail}`); };
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const r2 = (v) => v.map((x) => +x.toFixed(2));

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: `http://localhost:${webPort}/` });
  await sleep(2500);
  await shot('01-start');
  let s = await state();
  check('Start screen', s === null && (await ev(`!document.getElementById('overlay').classList.contains('hidden')`)), 'overlay with story + "Bắt đầu" shown, no game yet');
  await clickEl('start'); await sleep(800);
  s = await state();
  check('Click "Bắt đầu" starts Night 1', s?.st === 'playing' && !s.overlay, `state=${s?.st}, HUD: ${s?.hud}`);

  // movement / camera / jump through real key events
  let a = s.p; await keyDown('KeyW'); await sleep(1000); await keyUp('KeyW'); s = await state();
  check('W moves forward (camera yaw 0 → +Z)', s.p[2] - a[2] > 4 && Math.abs(s.p[0] - a[0]) < 0.1, `${JSON.stringify(r2(a))} → ${JSON.stringify(r2(s.p))}`);
  a = s.p; await keyDown('KeyD'); await sleep(500); await keyUp('KeyD'); s = await state();
  check('D moves screen-right (−X at yaw 0)', a[0] - s.p[0] > 2, `${JSON.stringify(r2(a))} → ${JSON.stringify(r2(s.p))}`);
  await tap('Space'); await sleep(150); s = await state();
  check('Space jumps', s.p[1] > 0.3, `y=${s.p[1].toFixed(2)} m shortly after Space`);
  await sleep(800);

  // ---- Phase 3: pause (P) and dash (Shift) with real keys ----
  if (Number(PHASE) >= 3) {
    await tap('KeyP'); await sleep(300); const p1 = await state(); await shot('p3-paused');
    await keyDown('KeyW'); await sleep(1000); await keyUp('KeyW'); const p2 = await state();
    check('P3-9 P pauses: overlay shown, sim_tick, time and position frozen for 1 s while W is held',
      p1.paused && p1.pausedOverlay && p2.sim === p1.sim && p2.t === p1.t && d2(p2.p, p1.p) === 0,
      `paused=${p1.paused}, overlay=${p1.pausedOverlay}, sim_tick ${p1.sim}→${p2.sim}, time ${p1.t.toFixed(2)}→${p2.t.toFixed(2)}`);
    await tap('KeyP'); await sleep(300); const p3 = await state();
    check('P3-9 P again resumes', !p3.paused && !p3.pausedOverlay && p3.sim > p2.sim, `paused=${p3.paused}, sim_tick ${p2.sim}→${p3.sim}`);
    const a0 = await state(); await keyDown('KeyW'); await sleep(50); await tap('ShiftLeft'); await sleep(250); await keyUp('KeyW'); const a1 = await state();
    // ~0.3 s of W: walking alone covers ~1.8 m; a dash adds player_speed×(mult−1)×duration = 2.4 m more
    check('P3-9 Shift dashes (distance clearly above walking, cooldown started)', d2(a1.p, a0.p) > 3 && a1.dcd > 0,
      `moved ${d2(a1.p, a0.p).toFixed(2)} m in ~0.3 s with W+Shift (walking ≈ 1.8 m), dash cooldown ${a1.dcd} ticks`);
    await sleep(500);
  }

  // play to the end with W/A/S/D + E + F
  const steer = async (dx, dz) => {
    const want = new Set(); const n = Math.hypot(dx, dz) || 1;
    if (dz / n > 0.38) want.add('KeyW'); if (dz / n < -0.38) want.add('KeyS');
    if (dx / n > 0.38) want.add('KeyA'); if (dx / n < -0.38) want.add('KeyD');
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await (want.has(k) ? keyDown(k) : keyUp(k));
  };
  // Steer with W/A/S/D toward fireflies / the nearest unlit lantern, E to deposit, F when a shade is close.
  async function playToEnd(prefix, budgetMs) {
    const o = { firstPick: null, firstDep: null, firstPulse: null, winDep: null, sawShade: false, sawBig: false };
    let shotMid = false; const tStart = Date.now();
    while (Date.now() - tStart < budgetMs) {
      s = await state();
      if (!s || s.st !== 'playing') break;
      if (s.S.length) o.sawShade = true;
      if (s.S.some((x) => x.kind === 'big')) o.sawBig = true;
      if (!o.firstPick && s.c > 0) { o.firstPick = s; await shot(`${prefix}02-pickup`); }
      if (!shotMid && s.lit >= 3) { shotMid = true; await shot(`${prefix}05-three-lit`); }
      const L = s.L.filter((l) => !l.lit).reduce((b, l) => (!b || d2(s.p, l.pos) < d2(s.p, b.pos) ? l : b), null);
      const target = (s.c >= Math.min(5 - L.dep, 5) || (s.c > 0 && !s.M.length)) ? L.pos
        : (s.M.reduce((b, m) => (!b || d2(s.p, m) < d2(s.p, b) ? m : b), null) || [0, 0, 0]);
      const threats = s.S.filter((x) => x.st !== 'stunned' && d2(x.pos, s.p) < (x.kind === 'big' ? 5.5 : 4.5));
      if (threats.length && s.c >= 1 && s.cd === 0) {
        await tap('KeyF'); await sleep(80); const b = await state();
        log(`F (pulse): carried ${s.c}→${b.c}, shades ${b.S.map((x) => x.st).join(',')}, score ${s.score}→${b.score}`);
        if (!o.firstPulse) { o.firstPulse = { before: s, after: b }; await shot(`${prefix}04-pulse`); }
        continue;
      }
      let dx = target[0] - s.p[0], dz = target[2] - s.p[2];
      for (const t of threats) { const dd = Math.max(0.3, d2(t.pos, s.p)); dx += ((s.p[0] - t.pos[0]) / dd) * 12; dz += ((s.p[2] - t.pos[2]) / dd) * 12; }
      if (target === L.pos && d2(s.p, L.pos) <= 2.2 && s.c > 0) {
        await steer(0, 0); await tap('KeyE'); await sleep(80); const b = await state();
        log(`E (deposit) at ${L.id}: carried ${s.c}→${b.c}, lit ${s.lit}→${b.lit}/${s.L.length}, score ${s.score}→${b.score}`);
        if (b.st === 'won') o.winDep = { before: s, after: b };
        if (!o.firstDep) { o.firstDep = { before: s, after: b }; await sleep(300); await shot(`${prefix}03-first-lantern-lit`); }
        continue;
      }
      await steer(dx, dz);
      await sleep(40);
    }
    for (const k of [...held]) await keyUp(k);
    return o;
  }
  const winBonusCheck = (name, winDep) => {
    if (!winDep) return check(name, false, 'game was not won by a deposit');
    // README scoring: last lantern +100, then on win +2 per whole second left and +50 per flame left
    const exp = winDep.before.score + 100 + 2 * Math.floor(winDep.after.t) + 50 * winDep.after.fl;
    check(name, winDep.after.score === exp,
      `score before last deposit ${winDep.before.score} + 100 + 2×floor(${winDep.after.t.toFixed(2)}) + 50×${winDep.after.fl} = ${exp}; game shows ${winDep.after.score}`);
  };
  const { firstPick, firstDep, firstPulse, winDep, sawShade } = await playToEnd('', 200000);
  check('Fireflies are picked up on contact (+10, HUD updates)', firstPick && firstPick.score === 10 * firstPick.c && firstPick.hud.includes(`${firstPick.c}/5`), firstPick ? `carried ${firstPick.c}, score ${firstPick.score}, HUD: ${firstPick.hud}` : 'never picked');
  check('E near a lantern deposits; 5 fireflies light it (+100)', firstDep && firstDep.after.lit === firstDep.before.lit + 1 && firstDep.after.c === firstDep.before.c - 5 && firstDep.before.hint.startsWith('Nhấn E'),
    firstDep ? `hint "${firstDep.before.hint}", carried ${firstDep.before.c}→${firstDep.after.c}, lit ${firstDep.before.lit}→${firstDep.after.lit}` : 'no deposit');
  check('Bóng Mực appear and chase', sawShade, 'shades seen during play');
  // checked at the end (a fallback may navigate away); PLAYTEST_FORCE_PULSE_FALLBACK=1 exercises the fallback path
  const firstPulseInPlay = process.env.PLAYTEST_FORCE_PULSE_FALLBACK ? null : firstPulse;
  await sleep(1500); s = await state(); await shot('06-end-win');
  check('Lighting all lanterns of Night 1 wins and shows the end screen', s.st === 'won' && s.overlay && s.card.includes('Đảo đã sáng lại'), `result ${JSON.stringify(s.res)}, score ${s.score}, card "${s.card}"`);
  winBonusCheck('Win bonus matches README scoring', winDep);
  if (Number(PHASE) >= 4) {
    const best = Number(await ev("document.getElementById('best-now')?.textContent"));
    const hasNext = await ev("!!document.getElementById('next')");
    check('P4-4 Night 1 win screen shows the record and a "Sang Đêm 2" button', best === s.score && hasNext, `record ${best} (score ${s.score}), next button ${hasNext}`);
    night1Score = s.score;
  }

  await tap('KeyR'); await sleep(500); s = await state();
  check('R restarts after a result', s.st === 'playing' && s.score === 0 && s.fl === 3 && s.lit === 0 && !s.overlay, `state ${s.st}, score ${s.score}, flames ${s.fl}, lit ${s.lit}`);
  const tl = Date.now();
  while (Date.now() - tl < 90000) { s = await state(); if (s.st !== 'playing') break; await sleep(500); }
  await sleep(1500); s = await state(); await shot('07-end-lose');
  check('Standing still: Bóng Mực drain flames → lose screen', s.st === 'lost' && s.res.reason === 'no_flames' && s.card.includes('Thua rồi'), `after ${((Date.now() - tl) / 1000).toFixed(0)} s: ${JSON.stringify(s.res)}, card "${s.card}"`);
  await clickEl('again'); await sleep(500); s = await state();
  check('"Chơi lại" button restarts', s.st === 'playing' && s.fl === 3, `state ${s.st}, flames ${s.fl}`);

  // ---- Phase 2: choose Night 2 on the start screen and play it to the end ----
  if (Number(PHASE) >= 2) {
    await send('Page.navigate', { url: `http://localhost:${webPort}/` }); await sleep(2500);
    await clickEl('start2'); await sleep(800); s = await state();
    check('P2-9 "Đêm 2" button starts Night 2 (6 lanterns, HUD shows night 2)', s?.st === 'playing' && s.L.length === 6 && s.hud.startsWith('2 |') && s.hud.includes('0/6'), `HUD: ${s?.hud}`);
    await shot('n2-01-start');
    const n2 = await playToEnd('n2-', 200000);
    await sleep(1500); s = await state(); await shot('n2-06-end');
    check('P2-9 Night 2 played with the keyboard to a win (all 6 lanterns)', s.st === 'won' && s.lit === 6 && s.card.includes('Đêm 2'), `result ${JSON.stringify(s.res)}, lit ${s.lit}/6, card "${s.card}"`);
    check('P2-9 Bóng Mực Lớn appeared during Night 2', n2.sawBig, n2.sawBig ? 'a shade with kind "big" was on the island' : 'no big shade seen');
    winBonusCheck('P2-9 Night 2 win bonus matches README scoring', n2.winDep);
  }
  // ---- Phase 4: record survives a reload; campaign button leads to Night 2 ----
  if (Number(PHASE) >= 4) {
    await send('Page.navigate', { url: `http://localhost:${webPort}/` }); await sleep(2500);
    const bestText = await ev("document.getElementById('best').textContent");
    check('P4-4 Records are kept after reloading the page (start screen)', night1Score !== null && bestText.includes(`Đêm 1 – ${night1Score}`), `start screen: "${bestText}"`);
    await send('Page.navigate', { url: `http://localhost:${webPort}/?autostart&nearwin&seed=3` }); await sleep(2500);
    await tap('KeyE'); await sleep(1500); s = await state();
    const won1 = s?.st === 'won';
    await clickEl('next'); await sleep(800); s = await state(); await shot('p4-campaign-night2');
    check('P4-4 "Sang Đêm 2" after winning Night 1 starts Night 2', won1 && s.st === 'playing' && s.L.length === 6 && s.hud.startsWith('2 |'), `won night 1: ${won1}; now HUD: ${s.hud}`);
  }
  let pulseEv = firstPulseInPlay, pulseHow = 'during play';
  if (!pulseEv) {
    // no shade came close in this (randomly seeded) game: check the pulse deterministically instead —
    // preset with two shades near the player, 2 fireflies in the bag, then the real F key
    pulseHow = 'preset ?shade (no shade came close during play)';
    await send('Page.navigate', { url: `http://localhost:${webPort}/?autostart&shade&seed=5` }); await sleep(2000);
    await ev('(() => { window.__game().player.carried = 2; })()');
    await sleep(600); const before = await state(); await tap('KeyF'); await sleep(150); const after = await state();
    pulseEv = { before, after };
    await shot('04-pulse');
    await send('Page.navigate', { url: `http://localhost:${webPort}/` }); await sleep(2500);
  }
  check('F pulse costs 1 firefly and stuns nearby Bóng Mực', pulseEv && pulseEv.after.c === pulseEv.before.c - 1 && pulseEv.after.S.some((x) => x.st === 'stunned'),
    pulseEv ? `${pulseHow}: carried ${pulseEv.before.c}→${pulseEv.after.c}, states ${pulseEv.after.S.map((x) => x.st).join(',')}` : 'no pulse');
  check('No JavaScript errors on the page', pageErrors.length === 0, pageErrors.length ? pageErrors.join(' ; ') : 'none');
} catch (e) {
  check('Playtest ran to completion', false, e.stack || String(e));
}

const ok = checks.every((c) => c.ok);
const md = `# Phase ${PHASE} GUI playtest (generated by \`npm run playtest -- ${PHASE}\`)

The real browser build (\`npm start\` client) driven in headless Chrome with **real keyboard and mouse events**
(Chrome DevTools Protocol \`Input.dispatchKeyEvent\` / \`dispatchMouseEvent\`), the same events a player produces.
A simple steering script decides which keys to press. State is read from the page after each action.

- Generated: ${new Date().toISOString()} · ${os.type()} ${os.release()} · Node ${process.version} · ${path.basename(CHROME)}
- **Overall: ${ok ? 'PASS' : 'FAIL'}** (${checks.filter((c) => c.ok).length}/${checks.length})

| Check | Result | Observed |
|---|---|---|
${checks.map((c) => `| ${c.req} | ${c.ok ? '✅ PASS' : '❌ FAIL'} | ${String(c.detail).replace(/\|/g, '\\|')} |`).join('\n')}

## Screenshots
| File | Moment |
|---|---|
| [01-start.png](01-start.png) | Start screen |
| [02-pickup.png](02-pickup.png) | First firefly picked up |
| [03-first-lantern-lit.png](03-first-lantern-lit.png) | First lantern lit after pressing E |
| [04-pulse.png](04-pulse.png) | Right after pressing F (stunned Bóng Mực turns pale) |
| [05-three-lit.png](05-three-lit.png) | 3/5 lanterns lit, island brighter |
| [06-end-win.png](06-end-win.png) | Win screen |
| [07-end-lose.png](07-end-lose.png) | Lose screen (no flames) |

## Log
\`\`\`
${lines.join('\n')}
\`\`\`
`;
fs.writeFileSync(path.join(OUT, 'PLAYTEST.md'), md);
console.log(`playtest: ${ok ? 'PASS' : 'FAIL'} → ${path.relative(ROOT, path.join(OUT, 'PLAYTEST.md'))}`);
ws.close(); cleanup();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold files */ }
process.exit(ok ? 0 : 1);
