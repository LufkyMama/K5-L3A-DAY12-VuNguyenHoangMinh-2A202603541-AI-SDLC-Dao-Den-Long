// Minimal static server for the browser build (no extra dependencies).
// npm start  ->  http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const MOUNTS = [
  ['/vendor/three.module.js', path.join(ROOT, 'node_modules/three/build/three.module.js')],
  ['/src/', path.join(ROOT, 'src/')],
  ['/', path.join(ROOT, 'web/')],
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };

http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/') url = '/index.html';
  for (const [prefix, target] of MOUNTS) {
    if (!url.startsWith(prefix)) continue;
    const file = prefix.endsWith('/') ? path.join(target, url.slice(prefix.length)) : target;
    if (!file.startsWith(target)) break; // path traversal guard
    return fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  }
  res.writeHead(404); res.end('not found');
}).listen(PORT, () => console.log(`Đảo Đèn Lồng: open http://localhost:${PORT}`));
