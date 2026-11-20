// Browser client: renders the shared deterministic sim (src/sim.js) with Three.js.
// All gameplay rules live in sim.js; this file only does input, rendering, HUD and sound.
import * as THREE from 'three';
import { Game, mulberry32, defaultLanterns } from '/src/sim.js';
import { TUNING, WORLD } from '/src/tuning.js';

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- palette ----------
const NIGHT = new THREE.Color('#120822'), DAWNISH = new THREE.Color('#3a2a55');
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(0x1a0b2e, 0.03);
const hemi = new THREE.HemisphereLight(0x8a7cff, 0x2a1530, 0.35);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb9b0ff, 0.25);
moon.position.set(-30, 50, 20);
scene.add(moon);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

// ---------- static world ----------
const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.islandRadius, WORLD.islandRadius - 7, 6, 72), mat('#2c3b2a'));
island.position.y = -3;
scene.add(island);
const rim = new THREE.Mesh(new THREE.TorusGeometry(WORLD.islandRadius, 0.25, 8, 96), mat('#5b4a3a'));
rim.rotation.x = Math.PI / 2; rim.position.y = 0.05;
scene.add(rim);
const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 48), mat('#2a1d45', { roughness: 1 }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -9;
scene.add(sea);
const deco = mulberry32(2026);
const cloudMat = mat('#4b3b70', { roughness: 1 });
for (let i = 0; i < 60; i++) {
  const a = deco() * Math.PI * 2, r = 50 + deco() * 90;
  const c = new THREE.Mesh(new THREE.SphereGeometry(3 + deco() * 6, 12, 8), cloudMat);
  c.position.set(Math.sin(a) * r, -8 + deco() * 2, Math.cos(a) * r);
  c.scale.y = 0.45;
  scene.add(c);
}
// trees and rocks (seeded, avoid lantern spots and centre)
const tmpGame = new Game({ seed: 0 });
const allLanternSpots = [...defaultLanterns(1), ...defaultLanterns(2)];
for (let i = 0; i < 40; i++) {
  const a = deco() * Math.PI * 2, r = 8 + deco() * 30;
  const x = Math.sin(a) * r, z = Math.cos(a) * r;
  if (allLanternSpots.some((l) => Math.hypot(l.pos[0] - x, l.pos[2] - z) < 9)) continue;
  const g = new THREE.Group();
  if (deco() < 0.7) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6), mat('#3b2a20'));
    trunk.position.y = 0.6;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.7 + deco() * 0.4, 1.8 + deco() * 0.8, 7), mat('#1f3a2e'));
    crown.position.y = 2.2;
    g.add(trunk, crown);
  } else {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + deco() * 0.6), mat('#4a4458'));
    rock.position.y = 0.3;
    g.add(rock);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

// creative: Cá Voi Mây — a gentle cloud whale swimming around the island (visual only)
const whale = new THREE.Group();
const wbody = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 14), mat('#7f74b8', { emissive: '#1d1640' }));
wbody.scale.set(2.2, 0.9, 1);
const wtail = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 4), mat('#7f74b8'));
wtail.rotation.z = Math.PI / 2; wtail.position.x = -10;
whale.add(wbody, wtail);
for (let i = 0; i < 6; i++) {
  const spot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd38a' }));
  spot.position.set(-4 + i * 1.6, 2.6, (i % 2 ? 1 : -1) * 1.2);
  whale.add(spot);
}
scene.add(whale);

// ---------- player: Mây with nón lá + little lantern ----------
const player = new THREE.Group();
const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 1.05, 12), mat('#3f6fa6'));
robe.position.y = 0.53;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat('#f1c9a0'));
head.position.y = 1.28;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.42, 28), mat('#e3c27a'));
hat.position.y = 1.62;
const hatLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 10), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
hatLantern.position.set(0, 1.18, 0.66);
const hatString = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25), mat('#222'));
hatString.position.set(0, 1.38, 0.66);
const playerLight = new THREE.PointLight(0xffa64d, 6, 9, 1.6);
playerLight.position.set(0, 1.3, 0.6);
player.add(robe, head, hat, hatLantern, hatString, playerLight);
scene.add(player);

// ---------- lanterns ----------
const lanternViews = new Map();
function buildLantern(l) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), mat('#4a3426'));
  pole.position.y = 1.6;
  const bodyMat = mat('#5a1f1a', { emissive: '#000000' });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12), bodyMat);
  body.position.y = 3.6;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 12), mat('#2b1a14'));
  cap.position.y = 4.4;
  const light = new THREE.PointLight(0xffa040, 0, 30, 1.4);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.08, TUNING.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  const bars = [];
  for (let i = 0; i < TUNING.lantern_cost; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: '#3a2a20' }));
    const a = (i / TUNING.lantern_cost) * Math.PI * 2;
    b.position.set(Math.sin(a) * 0.75, 2.8, Math.cos(a) * 0.75);
    bars.push(b); g.add(b);
  }
  g.add(pole, body, cap, light, ring);
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);
  scene.add(g);
  return { g, bodyMat, light, bars, ring };
}

// ---------- dynamic entities ----------
const moteGeo = new THREE.SphereGeometry(0.16, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: '#f6ff9a' });
const goldMat = new THREE.MeshBasicMaterial({ color: '#ffcf3a' });
const shadeGeo = new THREE.SphereGeometry(0.75, 16, 12);
const eyeGeo = new THREE.SphereGeometry(0.1, 8, 6);
const eyeMat = new THREE.MeshBasicMaterial({ color: '#d14bff' });
const moteViews = new Map(), shadeViews = new Map();
let effects = [];

function syncMap(map, list, make) {
  const seen = new Set();
  for (const e of list) {
    seen.add(e.id);
    if (!map.has(e.id)) map.set(e.id, make(e));
  }
  for (const [id, v] of map) if (!seen.has(id)) { scene.remove(v.obj); map.delete(id); }
}
const makeMote = (m) => {
  const obj = new THREE.Mesh(moteGeo, m.golden ? goldMat : moteMat);
  if (m.golden) obj.scale.setScalar(1.8);
  scene.add(obj);
  return { obj, phase: (parseInt(m.id.slice(1), 10) * 1.7) % 6.28 };
};
const makeShade = (s) => {
  const m = new THREE.MeshStandardMaterial({ color: '#14051f', emissive: '#2e0a48', roughness: 0.4, transparent: true, opacity: 0.92 });
  const obj = new THREE.Group();
  const blob = new THREE.Mesh(shadeGeo, m);
  blob.scale.y = 1.25;
  const e1 = new THREE.Mesh(eyeGeo, eyeMat), e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(-0.25, 0.3, 0.62); e2.position.set(0.25, 0.3, 0.62);
  obj.add(blob, e1, e2);
  if (s.kind === 'big') obj.scale.setScalar(1.7); // Bóng Mực Lớn
  scene.add(obj);
  return { obj, m };
};

// ---------- sound (procedural WebAudio, no asset files) ----------
let actx = null;
function tone(freq, dur = 0.15, type = 'sine', vol = 0.12, slide = 0) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
}
const SFX = {
  mote_picked: () => tone(1200, 0.12, 'triangle', 0.08, 1.5),
  deposit: () => tone(520, 0.25, 'sine', 0.12, 1.3),
  lantern_lit: () => { tone(523, 0.6); setTimeout(() => tone(659, 0.6), 90); setTimeout(() => tone(784, 0.8), 180); },
  pulse: () => tone(300, 0.4, 'sawtooth', 0.05, 3),
  player_hit: () => tone(140, 0.35, 'square', 0.08, 0.5),
  shade_spawned: () => tone(90, 0.6, 'sine', 0.06, 0.7),
  game_over: () => {},
};

// ---------- input ----------
const keys = new Set();
const latched = { jump: false, interact: false, pulse: false, dash: false, pause: false };
const KEYMAP = { Space: 'jump', KeyE: 'interact', KeyF: 'pulse', ShiftLeft: 'dash', ShiftRight: 'dash', KeyP: 'pause', Escape: 'pause' };
let yaw = 0; // degrees, sent to the sim as cam_yaw_deg
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (KEYMAP[e.code]) latched[KEYMAP[e.code]] = true;
  if (e.code === 'KeyR' && game && game.state !== 'playing') startGame();
  if (e.code === 'KeyN' && game && game.state === 'won' && currentNight === 1) startGame(2);
  if (e.code === 'Digit2' && !game) startGame(2);
  if (e.code === 'Digit1' && !game) startGame(1);
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let dragging = false, lastX = 0;
renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => { if (dragging) { yaw -= (e.clientX - lastX) * 0.3; lastX = e.clientX; } });

function readInput() {
  const k = (c) => keys.has(c);
  // camera forward at yaw 0 is +Z; screen-right is -X (see docs/notes/phase-1.md)
  const z = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  const x = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0);
  const inp = { move: [x, z], cam_yaw_deg: yaw };
  for (const b of Object.keys(latched)) {
    inp[b] = latched[b] || [...Object.entries(KEYMAP)].some(([code, name]) => name === b && keys.has(code));
    latched[b] = false;
  }
  return inp;
}

// ---------- game lifecycle ----------
let game = null;
const NIGHT_LOOK = {
  1: { name: 'Đêm 1 – Đảo Bến', sky: '#120822', fog: 0x1a0b2e, density: 0.03, ground: '#2c3b2a' },
  2: { name: 'Đêm 2 – Rừng Sương', sky: '#08140f', fog: 0x0f2219, density: 0.042, ground: '#1f3326' },
};
let currentNight = 1;
function startGame(night = currentNight) {
  currentNight = night;
  if (!actx) { try { actx = new AudioContext(); } catch { /* sound optional */ } }
  for (const v of lanternViews.values()) scene.remove(v.g);
  lanternViews.clear();
  for (const m of [moteViews, shadeViews]) { for (const v of m.values()) scene.remove(v.obj); m.clear(); }
  // URL options (for reproducible screenshots): ?autostart&night=2&seed=5&lit=3&shade
  const q = new URLSearchParams(location.search);
  const seed = q.has('seed') ? Number(q.get('seed')) : (Date.now() & 0x7fffffff);
  const litN = Number(q.get('lit') || 0);
  let scenario = null;
  if (litN || q.has('shade')) {
    const ids = defaultLanterns(night).map((l) => l.id);
    scenario = { player: { pos: [0, 0, 20] }, lanterns: ids.slice(0, Math.max(litN, q.has('shade') ? 1 : 0)).map((id) => ({ id, lit: true })) };
    if (q.has('shade')) scenario.shades = [{ id: 'S1', pos: [-2.5, 1, 26] }, { id: 'S2', kind: night === 2 ? 'big' : 'ink', pos: [3, 1, 27] }];
  }
  if (q.has('nearwin') && night === 1) { // screenshot/playtest preset: 4 lanterns lit, standing at L5 with 5 fireflies
    const L5 = defaultLanterns(1)[4];
    scenario = { player: { pos: [L5.pos[0] * 0.92, 0, L5.pos[2] * 0.92], carried: 5 }, lanterns: ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true })) };
  }
  game = new Game({ seed, night, scenario, creative: true });
  const look = NIGHT_LOOK[night];
  NIGHT.set(look.sky); scene.fog.color.set(look.fog); island.material.color.set(look.ground);
  for (const l of game.lanterns) lanternViews.set(l.id, buildLantern(l));
  $('overlay').classList.add('hidden');
}
$('start').addEventListener('click', () => startGame(1));
$('start2').addEventListener('click', () => startGame(2));

// ---------- high scores (Ticket-04): per night, browser storage, optional ----------
const bestKey = (n) => `ddl.best.night${n}`;
function getBest(n) { try { return Number(localStorage.getItem(bestKey(n))) || 0; } catch { return 0; } }
function saveBest(n, score) { try { if (score > getBest(n)) { localStorage.setItem(bestKey(n), String(score)); return true; } } catch { /* storage blocked */ } return false; }
function showBestOnStart() {
  const el = $('best'); if (!el) return;
  const b1 = getBest(1), b2 = getBest(2);
  el.textContent = b1 || b2 ? `Kỷ lục: Đêm 1 – ${b1} điểm · Đêm 2 – ${b2} điểm` : '';
}
showBestOnStart();

function showEnd() {
  const won = game.state === 'won';
  const isNew = saveBest(currentNight, game.score);
  const reason = { all_lit: `Cả ${game.lanterns.length} Đèn Lồng Lớn đã sáng!`, dawn: 'Trời đã sáng mà đảo vẫn còn tối…', no_flames: 'Ngọn lửa của Mây đã tắt…' }[game.result.reason];
  $('card').innerHTML = `<h1>${won ? 'Đảo đã sáng lại!' : 'Thua rồi'}</h1><p>${NIGHT_LOOK[currentNight].name}: ${reason}</p>
    <p>Điểm: <b>${game.score}</b> · Kỷ lục: <b id="best-now">${getBest(currentNight)}</b>${isNew ? ' <b style="color:#ffd27a">(kỷ lục mới!)</b>' : ''}</p>
    <button id="again">Chơi lại (R)</button>${won && currentNight === 1 ? ' <button id="next">Sang Đêm 2 → (N)</button>' : ''}`;
  $('again').addEventListener('click', () => startGame());
  $('next')?.addEventListener('click', () => startGame(2));
  $('overlay').classList.remove('hidden');
}

function onEvents(evs) {
  for (const e of evs) {
    SFX[e.name]?.();
    if (e.name === 'pulse') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.6, 48),
        new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(game.player.pos[0], 0.2, game.player.pos[2]);
      scene.add(ring);
      effects.push({ obj: ring, t: 0, dur: 0.45, grow: TUNING.pulse_radius });
    }
    if (e.name === 'player_hit') { $('flash').style.opacity = 1; setTimeout(() => { $('flash').style.opacity = 0; }, 220); }
    if (e.name === 'game_over') setTimeout(showEnd, 600);
  }
}

// ---------- frame loop: fixed 60 Hz sim, render every frame ----------
let acc = 0, last = performance.now(), clock = 0, facing = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000); last = now; clock += dt;
  if (keys.has('ArrowLeft')) yaw += 90 * dt;
  if (keys.has('ArrowRight')) yaw -= 90 * dt;
  if (game && game.state === 'playing') {
    acc += dt;
    while (acc >= 1 / 60) { acc -= 1 / 60; onEvents(game.step(readInput())); if (game.state !== 'playing') break; }
  }
  render(dt);
}

function render(dt) {
  const g = game || tmpGame;
  const p = g.player;
  // player
  const prev = player.position.clone();
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const mv = player.position.clone().sub(prev);
  if (mv.lengthSq() > 1e-6) facing = Math.atan2(mv.x, mv.z);
  player.rotation.y += ((facing - player.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 12);
  const blink = game && game.invuln > 0 && Math.floor(clock * 12) % 2 === 0;
  player.visible = !blink;
  playerLight.intensity = 2 + 2 * p.flames + 0.6 * p.carried;
  // camera behind player along yaw
  const t = (yaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(t) * 9, p.pos[1] + 5.5, p.pos[2] - Math.cos(t) * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
  // lanterns + island brightness
  let lit = 0;
  for (const l of g.lanterns) {
    const v = lanternViews.get(l.id);
    if (l.lit) lit++;
    if (!v) continue;
    v.light.intensity = l.lit ? 40 + Math.sin(clock * 3 + l.pos[0]) * 4 : 0;
    v.bodyMat.emissive.set(l.lit ? '#ff8a2a' : '#000000');
    v.bodyMat.color.set(l.lit ? '#ffb35c' : '#5a1f1a');
    v.bars.forEach((b, i) => b.material.color.set(i < l.deposited ? '#ffc46b' : '#3a2a20'));
    v.ring.material.opacity = l.lit ? 0.25 : 0; // CR-1: only lit lanterns keep shades away
  }
  const k = lit / g.lanterns.length;
  scene.fog.density = NIGHT_LOOK[g.night].density * (1 - 0.6 * k);
  hemi.intensity = 0.35 + 0.9 * k;
  scene.background.copy(NIGHT).lerp(DAWNISH, k);
  // motes
  syncMap(moteViews, g.motes, makeMote);
  for (const m of g.motes) {
    const v = moteViews.get(m.id);
    v.obj.position.set(m.pos[0] + Math.sin(clock * 2 + v.phase) * 0.15, 0.8 + Math.sin(clock * 3 + v.phase) * 0.25, m.pos[2]);
  }
  // shades
  syncMap(shadeViews, g.shades, makeShade);
  for (const s of g.shades) {
    const v = shadeViews.get(s.id);
    v.obj.position.set(s.pos[0], s.pos[1] + Math.sin(clock * 4 + s.pos[0]) * 0.12, s.pos[2]);
    v.obj.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    const stunned = s.state === 'stunned';
    v.m.color.set(stunned ? '#8f9fc4' : '#14051f');
    v.m.emissive.set(stunned ? '#202840' : '#2e0a48');
    v.m.opacity = stunned ? 0.5 : 0.92;
  }
  // effects
  effects = effects.filter((e) => {
    e.t += dt;
    const f = e.t / e.dur;
    e.obj.scale.setScalar(1 + f * e.grow * 1.6);
    e.obj.material.opacity = 0.8 * (1 - f);
    if (f >= 1) { scene.remove(e.obj); return false; }
    return true;
  });
  // whale
  const wa = clock * 0.05;
  whale.position.set(Math.sin(wa) * 75, -5 + Math.sin(clock * 0.7) * 0.8, Math.cos(wa) * 75);
  whale.rotation.y = wa + Math.PI;
  renderer.render(scene, camera);
  if (game) hud(g, lit);
}

function hud(g, lit) {
  const p = g.player;
  $('h-flames').textContent = '🔥'.repeat(p.flames) + '·'.repeat(Math.max(0, TUNING.flames - p.flames));
  $('h-carried').textContent = `${p.carried}/${TUNING.carry_capacity}`;
  $('h-lit').textContent = `${lit}/${g.lanterns.length}`;
  $('h-night').textContent = String(g.night);
  $('h-score').textContent = g.score;
  const tl = Math.max(0, g.timeLeft);
  $('h-time').textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  $('h-pulse').textContent = g.pulseCooldown > 0 ? '…' : p.carried >= TUNING.pulse_cost ? 'sẵn sàng (F)' : 'cần đom đóm';
  $('h-dash').textContent = g.dashCooldown > 0 ? '…' : 'sẵn sàng (Shift)';
  $('paused').classList.toggle('hidden', !(g.paused && g.state === 'playing'));
  let hint = '';
  const nearL = g.lanterns.find((l) => !l.lit && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= TUNING.interact_radius);
  if (nearL) hint = p.carried > 0 ? `Nhấn E để nạp ánh sáng vào ${nearL.id} (${nearL.deposited}/${TUNING.lantern_cost})` : `${nearL.id} cần ${TUNING.lantern_cost - nearL.deposited} đom đóm nữa`;
  else if (p.carried >= TUNING.carry_capacity) hint = 'Túi đầy, mang đom đóm về một Đèn Lồng Lớn!';
  if (g.boost > 0) hint = '✨ Đom Đóm Vàng: Mây chạy nhanh hơn!';
  $('hint').textContent = g.state === 'playing' ? hint : '';
}

requestAnimationFrame(frame);
{ const q0 = new URLSearchParams(location.search); if (q0.has('autostart')) startGame(Number(q0.get('night') || 1)); }
window.__game = () => game; // debug hook for screenshots / manual checks
