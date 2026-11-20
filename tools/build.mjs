// Release build (Ticket-04):  npm run build [-- --out <dir>]
// Produces <out>/web/ (static site: index.html, main.js, src/, vendor/three.module.js, all paths relative)
// and <out>/dao-den-long-v<version>-web.zip. No dependencies: a minimal STORE-only zip writer is included.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(ROOT, 'dist');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const WEB = path.join(OUT, 'web');

fs.rmSync(WEB, { recursive: true, force: true });
fs.mkdirSync(path.join(WEB, 'src'), { recursive: true });
fs.mkdirSync(path.join(WEB, 'vendor'), { recursive: true });

const replaceAll = (text, pairs, file) => {
  for (const [a, b] of pairs) {
    if (!text.includes(a)) throw new Error(`build: expected "${a}" in ${file}`);
    text = text.split(a).join(b);
  }
  return text;
};
fs.writeFileSync(path.join(WEB, 'index.html'), replaceAll(fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8'),
  [['"three": "/vendor/three.module.js"', '"three": "./vendor/three.module.js"'], ['src="/main.js"', 'src="./main.js"']], 'index.html'));
fs.writeFileSync(path.join(WEB, 'main.js'), replaceAll(fs.readFileSync(path.join(ROOT, 'web/main.js'), 'utf8'),
  [["from '/src/", "from './src/"]], 'main.js'));
for (const f of fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== 'headless.js')) {
  fs.copyFileSync(path.join(ROOT, 'src', f), path.join(WEB, 'src', f));
}
const three = path.join(ROOT, 'node_modules/three/build/three.module.js');
if (!fs.existsSync(three)) { console.error('build: run npm install first (three.js missing)'); process.exit(1); }
fs.copyFileSync(three, path.join(WEB, 'vendor/three.module.js'));
fs.copyFileSync(path.join(ROOT, 'node_modules/three/LICENSE'), path.join(WEB, 'vendor/THREE-LICENSE.txt'));
fs.writeFileSync(path.join(WEB, 'README.txt'),
  `Dao Den Long v${version} - static web build\n\nServe this folder with any static web server, then open it in a browser, e.g.\n  npx serve .        or   python3 -m http.server 8080\nOpening index.html directly (file://) does not work: browsers block ES modules there.\n`);

// ---- minimal zip writer (STORE, no compression) ----
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const parts = [], central = []; let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8'); const crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cenSize = central.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cenSize, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, eocd]);
}
const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name), `${base}${e.name}/`) : [{ name: `dao-den-long-v${version}/${base}${e.name}`, data: fs.readFileSync(path.join(dir, e.name)) }]);
const zipPath = path.join(OUT, `dao-den-long-v${version}-web.zip`);
fs.writeFileSync(zipPath, zip(walk(WEB)));
console.log(`build: ${path.relative(ROOT, WEB) || WEB} + ${path.basename(zipPath)} (${(fs.statSync(zipPath).size / 1024).toFixed(0)} KB)`);
