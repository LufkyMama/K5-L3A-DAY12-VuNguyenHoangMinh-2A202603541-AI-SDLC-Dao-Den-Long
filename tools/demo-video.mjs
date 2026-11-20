// Records docs/demo/demo.mp4 (< 5 min) with no extra software: a HEADED Chrome window placed off-screen
// streams the game tab (Page.startScreencast, HUD included) into a recorder tab whose canvas is captured by
// MediaRecorder (H.264/MP4). Headless Chrome cannot encode H.264, hence the off-screen window.
//   node tools/demo-video.mjs            (needs Google Chrome; ~3 minutes)
// Content: title, Night 1 played by a steering bot (clearly labelled), campaign → Night 2 (big shade, pause, dash),
// then evidence slides built from the real files in the repo (proof report, bench, fuzz, git log, harness).
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixDuration } from './mp4-fix-duration.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'demo', 'demo.mp4');
const W = 1280, H = 720;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && fs.existsSync(p));
if (!CHROME) { console.error('demo-video: Chrome not found (set CHROME_PATH)'); process.exit(1); }
const freePort = () => new Promise((r) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const webPort = await freePort(), cdpPort = await freePort();
const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(webPort) }, stdio: 'ignore' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-video-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-position=-3000,0', `--window-size=${W},${H + 140}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} };
process.on('exit', cleanup);

// ---- CDP plumbing (one websocket per tab) ----
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl); await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const handlers = {};
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method && handlers[d.method]) handlers[d.method](d.params); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return { ws, send, ev, on: (m, f) => { handlers[m] = f; } };
}
let list;
for (let i = 0; i < 75 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); } catch { await sleep(200); } }
const game = await connect(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
// the recorder gets its OWN window (a background tab would be throttled and the game tab would stop rendering)
const browser = await connect((await (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json()).webSocketDebuggerUrl);
const { targetId } = (await browser.send('Target.createTarget', { url: 'about:blank', newWindow: true })).result;
const { windowId } = (await browser.send('Browser.getWindowForTarget', { targetId })).result;
await browser.send('Browser.setWindowBounds', { windowId, bounds: { left: -3000, top: 900, width: W + 40, height: H + 140 } });
let recT; for (let i = 0; i < 20 && !recT; i++) { recT = (await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()).find((x) => x.id === targetId); if (!recT) await sleep(200); }
const rec = await connect(recT.webSocketDebuggerUrl);
await game.send('Page.enable'); await game.send('Runtime.enable');
await game.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

// ---- recorder tab: canvas fed with screencast frames, captured by MediaRecorder as MP4 ----
await rec.ev(`(() => {
  document.body.style.margin = 0;
  const cv = document.createElement('canvas'); cv.width = ${W}; cv.height = ${H}; document.body.appendChild(cv);
  const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, ${W}, ${H});
  const stream = cv.captureStream(0); const track = stream.getVideoTracks()[0];
  const mime = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
  const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1500000 });
  window.__chunks = []; r.ondataavailable = (e) => { if (e.data.size) window.__chunks.push(e.data); };
  window.__rec = r; window.__mime = mime; window.__frames = 0;
  const img = new Image(); let latest = null, shown = null, busy = false;
  window.__push = (b64) => { latest = b64; };
  // repaint at a steady 25 fps with the newest screencast frame (duplicates keep real-time pacing)
  setInterval(() => {
    if (busy) return;
    // same picture as last time (static page): just repeat the frame — re-assigning the same src fires no onload
    if (!latest || latest === shown) { track.requestFrame(); return; }
    busy = true; const next = latest;
    img.onload = () => { g.drawImage(img, 0, 0, ${W}, ${H}); track.requestFrame(); window.__frames++; shown = next; busy = false; };
    img.onerror = () => { busy = false; };
    img.src = 'data:image/jpeg;base64,' + next;
  }, 40);
  r.start(1000);
  return mime;
})()`);
// Frame source: poll Page.captureScreenshot (always returns the current frame; the screencast API silently
// stopped sending frames after navigations). ~10–15 fps is enough for a demo; the recorder repaints at 25 fps.
let pumping = true;
const pump = (async () => {
  while (pumping) {
    const s = await game.send('Page.captureScreenshot', { format: 'jpeg', quality: 75 });
    if (s.result?.data) await rec.send('Runtime.evaluate', { expression: `window.__push(${JSON.stringify(s.result.data)})` });
  }
})();
async function nav(url, waitMs) { await game.send('Page.navigate', { url }); await sleep(waitMs); }
const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);

// ---- slides: HTML from real repo data ----
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function slide(title, bodyHtml, ms) {
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;width:${W}px;height:${H}px;background:#120822;color:#ffe9c4;font-family:system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 80px;box-sizing:border-box">
  <h1 style="color:#ffc46b;font-size:44px;margin:0 0 24px">${title}</h1><div style="font-size:24px;line-height:1.5">${bodyHtml}</div></body>`;
  await nav('data:text/html;charset=utf-8,' + encodeURIComponent(html), ms);
}
const proofMd = fs.readFileSync(path.join(ROOT, 'docs/proof/phase-4/REPORT.md'), 'utf8');
const proofRows = [...proofMd.matchAll(/^\| ([^|]+) \| `[^`]*` \|.*\| (✅ PASS|❌ FAIL) \|$/gm)].map((m) => [m[1].trim(), m[2]]);
const bench = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/proof/phase-4/bench.json'), 'utf8'));
const fuzzJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/proof/phase-4/fuzz.json'), 'utf8'));
const testsLine = (fs.readFileSync(path.join(ROOT, 'docs/proof/phase-4/test-report.txt'), 'utf8').match(/ℹ tests \d+[\s\S]*?ℹ fail \d+/) || [''])[0].replace(/\s*ℹ /g, ' · ').replace(/^ · /, '');
const pt = (f) => (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/Overall: (\w+)\*\* \((\d+\/\d+)\)/) || []).slice(1).join(' ');
const gitLog = execSync('git log --oneline -14', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
const tags = execSync('git tag --list', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').join(' · ');

// ---- the steering bot (same idea as tools/playtest.mjs); presses real keys in the game tab ----
const KEYS = { KeyW: ['w', 87], KeyA: ['a', 65], KeyS: ['s', 83], KeyD: ['d', 68], KeyE: ['e', 69], KeyF: ['f', 70], KeyP: ['p', 80], ShiftLeft: ['Shift', 16] };
const held = new Set();
const keyDown = async (c) => { if (held.has(c)) return; held.add(c); await game.send('Input.dispatchKeyEvent', { type: 'keyDown', code: c, key: KEYS[c][0], windowsVirtualKeyCode: KEYS[c][1] }); };
const keyUp = async (c) => { if (!held.has(c)) return; held.delete(c); await game.send('Input.dispatchKeyEvent', { type: 'keyUp', code: c, key: KEYS[c][0], windowsVirtualKeyCode: KEYS[c][1] }); };
const tap = async (c) => { await keyDown(c); await sleep(70); await keyUp(c); };
const click = async (id) => { const c = await game.ev(`(() => { const b = document.getElementById('${id}'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`); if (!c) return false; for (const type of ['mousePressed', 'mouseReleased']) await game.send('Input.dispatchMouseEvent', { type, x: c[0], y: c[1], button: 'left', clickCount: 1 }); return true; };
const state = () => game.ev(`(() => { const g = window.__game(); if (!g) return null; return { st: g.state, p: g.player.pos, c: g.player.carried, cd: g.pulseCooldown, dcd: g.dashCooldown, lit: g.lanterns.filter((l) => l.lit).length, L: g.lanterns.map((l) => ({ pos: l.pos, lit: l.lit, dep: l.deposited })), M: g.motes.map((m) => m.pos), S: g.shades.map((s) => ({ pos: s.pos, st: s.state, kind: s.kind })) }; })()`);
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const steer = async (dx, dz) => { const want = new Set(); const n = Math.hypot(dx, dz) || 1; if (dz / n > 0.38) want.add('KeyW'); if (dz / n < -0.38) want.add('KeyS'); if (dx / n > 0.38) want.add('KeyA'); if (dx / n < -0.38) want.add('KeyD'); for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await (want.has(k) ? keyDown(k) : keyUp(k)); };
async function play(budgetMs, extras = {}) {
  const tS = Date.now(); let paused = false, dashed = false;
  while (Date.now() - tS < budgetMs) {
    const s = await state(); if (!s || s.st !== 'playing') break;
    const el = (Date.now() - tS) / 1000;
    if (extras.pauseAt && !paused && el > extras.pauseAt) { paused = true; for (const k of [...held]) await keyUp(k); await tap('KeyP'); await sleep(2500); await tap('KeyP'); continue; }
    const L = s.L.filter((l) => !l.lit).reduce((b, l) => (!b || d2(s.p, l.pos) < d2(s.p, b.pos) ? l : b), null);
    const target = (s.c >= Math.min(5 - L.dep, 5) || (s.c > 0 && !s.M.length)) ? L.pos : (s.M.reduce((b, m) => (!b || d2(s.p, m) < d2(s.p, b) ? m : b), null) || [0, 0, 0]);
    const threats = s.S.filter((x) => x.st !== 'stunned' && d2(x.pos, s.p) < (x.kind === 'big' ? 5.5 : 4.5));
    if (threats.length && s.c >= 1 && s.cd === 0) { await tap('KeyF'); continue; }
    let dx = target[0] - s.p[0], dz = target[2] - s.p[2];
    for (const t of threats) { const dd = Math.max(0.3, d2(t.pos, s.p)); dx += ((s.p[0] - t.pos[0]) / dd) * 12; dz += ((s.p[2] - t.pos[2]) / dd) * 12; }
    if (target === L.pos && d2(s.p, L.pos) <= 2.2 && s.c > 0) { await steer(0, 0); await tap('KeyE'); continue; }
    await steer(dx, dz);
    if (extras.dash && !dashed && el > 3 && s.dcd === 0 && d2(s.p, target) > 8) { dashed = true; await tap('ShiftLeft'); }
    await sleep(40);
  }
  for (const k of [...held]) await keyUp(k);
}

try {
  await slide('Đảo Đèn Lồng · demo v1.0.0', `Game 3D Three.js + chế độ headless theo Test Contract.<br>Lab Day 12 · AI SDLC · 2A202603541 – Vu Nguyen Hoang Minh<br><br>
    <span style="color:#ffd27a">Lưu ý trung thực:</span> phần chơi trong video do <b>bot điều khiển bằng phím thật</b> (W/A/S/D, E, F, Shift, P qua Chrome DevTools), không phải người chơi tay.<br>Ticket-02/03/04 là ticket tự đặt (không có giảng viên phát hành).`, 7000);
  log('Night 1');
  await nav(`http://localhost:${webPort}/?seed=11`, 3500);
  for (let i = 0; i < 5 && !(await state()); i++) { await click('start'); await sleep(700); }
  if (!(await state())) throw new Error('game did not start (Night 1)');
  log('Night 1 started');
  await play(95000, { dash: true, pauseAt: 25 });
  await sleep(3500); // end screen
  log('campaign → Night 2');
  const viaButton = await click('next');
  if (!viaButton) { log('Night 1 not won in time: starting Night 2 directly'); await nav(`http://localhost:${webPort}/?seed=12&autostart&night=2`, 3000); }
  await sleep(500);
  if (!(await state())) throw new Error('game did not start (Night 2)');
  await play(45000, { dash: true });
  await sleep(1500);
  log('evidence slides');
  await slide('Kiểm chứng tự động (npm test · npm run proof -- 4)', `<b>${esc(testsLine)}</b><br><br>${proofRows.map(([r, ok]) => `${ok.startsWith('✅') ? '✅' : '❌'} ${esc(r)}`).join('<br>')}`.replace(/<br>/g, '<br style="line-height:1">').replace('<div', '<div'), 9000);
  await slide('Hiệu năng · ổn định · chơi thử GUI', `Bench (${esc(bench.machine)}):<br>${bench.results.map((r) => `Đêm ${r.night}: ${r.end.ticks} tick trong <b>${r.cli_ms_median} ms</b> qua CLI · bước gameplay ${r.step_ms_avg} ms (${r.realtime_factor}× thời gian thực)`).join('<br>')}<br><br>
    Fuzz: ${fuzzJ.valid} ca hợp lệ + ${fuzzJ.malformed} ca hỏng · <b>${fuzzJ.crashes} crash · ${fuzzJ.failures.length} vi phạm</b> · ${fuzzJ.deterministicChecked} lần chạy lại giống từng byte<br><br>
    Chơi thử GUI bằng phím thật: bản dev <b>${pt('docs/proof/phase-4/playtest/PLAYTEST.md')}</b> · bản build phát hành <b>${pt('docs/proof/phase-4/playtest-dist/PLAYTEST.md')}</b>`, 9000);
  await slide('Harness AI và lịch sử git', `CLAUDE.md · AGENTS.md · hook test-gate (PostToolUse + Stop: chặn kết thúc khi test đỏ) · skill <code>verify</code> · agent <code>contract-reviewer</code> (review độc lập mỗi phase) · CI ubuntu + macOS<br><br>
    Tag: <b>${esc(tags)}</b><br><code style="font-size:17px">${gitLog.map(esc).join('<br>')}</code>`, 9000);
  await slide('Cảm ơn!', 'Mã nguồn, bằng chứng từng phase (<code>docs/proof/</code>), ghi chép, đánh giá và retro (<code>docs/notes/</code>) đều có trong repo.', 4000);
} catch (e) { console.error(e); }

// ---- stop and save ----
pumping = false; await pump;
await sleep(500);
await rec.ev('new Promise((r) => { window.__rec.onstop = r; window.__rec.stop(); })');
const meta = await rec.ev('(async () => { window.__blob = new Blob(window.__chunks, { type: window.__mime }); return { size: window.__blob.size, frames: window.__frames, mime: window.__mime }; })()');
const parts = [];
for (let off = 0; off < meta.size; off += 3 * 1024 * 1024) {
  const b64 = await rec.ev(`(async () => { const buf = new Uint8Array(await window.__blob.slice(${off}, ${off + 3 * 1024 * 1024}).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); })()`);
  parts.push(Buffer.from(b64, 'base64'));
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const video = Buffer.concat(parts);
const fixed = fixDuration(video); // MediaRecorder's fragmented MP4 only declares the first fragment's length
fs.writeFileSync(OUT, video);
console.log(`duration header fixed: ${fixed.seconds?.toFixed(1)} s`);
const secs = (Date.now() - t0) / 1000;
console.log(`demo-video: ${path.relative(ROOT, OUT)} · ${(meta.size / 1e6).toFixed(1)} MB · ~${secs.toFixed(0)} s recorded · ${meta.frames} frames · ${meta.mime}`);
game.ws.close(); rec.ws.close(); cleanup();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may hold files briefly */ }
process.exit(0);
