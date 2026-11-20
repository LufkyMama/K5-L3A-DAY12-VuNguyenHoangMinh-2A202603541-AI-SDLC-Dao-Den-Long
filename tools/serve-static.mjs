// Tiny static file server used to check the release build: node tools/serve-static.mjs <dir> <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const [dir, port] = [path.resolve(process.argv[2] || 'dist/web'), Number(process.argv[3] || 8090)];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(dir, p);
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
}).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}/`));
