// Local dev server: serves public/ and routes /api/* to the Vercel function files.
// Usage: npm run dev  (reads .env.local if present)
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);

const envFile = path.join(root, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.json': 'application/json', '.woff2': 'font/woff2',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const file = path.join(root, 'api', path.basename(url.pathname) + '.js');
      if (!existsSync(file)) { res.writeHead(404).end(); return; }
      const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
      const handler = mod[req.method];
      if (!handler) { res.writeHead(405).end(); return; }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(url, {
        method: req.method, headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = path.join(pub, p);
    if (!file.startsWith(pub)) { res.writeHead(403).end(); return; }
    if (!existsSync(file) && existsSync(file + '.html')) file += '.html'; // cleanUrls
    if (!existsSync(file) || !(await stat(file)).isFile()) { res.writeHead(404).end('Not found'); return; }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    let data = await readFile(file);
    const headers = { 'Content-Type': type };
    // Gzip text like Vercel does, so local Lighthouse numbers are realistic.
    if (/text|javascript|svg|xml|json/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      data = gzipSync(data); headers['Content-Encoding'] = 'gzip';
    }
    res.writeHead(200, headers);
    res.end(data);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end('Server error');
  }
}).listen(port, () => console.log(`Dev server: http://localhost:${port}`));
