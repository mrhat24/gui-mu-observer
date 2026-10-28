import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
let base = '/';
try { base = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8')).start_url; } catch { /* Support a pre-PWA build. */ }
const port = Number(process.env.PORT || 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535');
const url = `http://127.0.0.1:${port}${base}`;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json; charset=utf-8' };

try { await readFile(resolve(root, 'index.html')); }
catch { console.error('Production build missing. Run pnpm build in web first.'); process.exit(1); }

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, url).pathname);
    if (pathname === base.slice(0, -1) && base !== '/') {
      response.writeHead(302, { Location: base }); response.end(); return;
    }
    if (!pathname.startsWith(base)) { response.writeHead(404); response.end('Not found'); return; }
    const relativePath = pathname.slice(base.length);
    const target = resolve(root, relativePath || 'index.html');
    if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403); response.end(); return; }
    const data = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(target)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404); response.end('Not found'); }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. If the tracker is running, open ${url}` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Gui Mu Observer: ${url}\nLocal only. Keep this window open. Press Ctrl+C to stop.`);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true });
    browser.on('error', () => console.log(`Open ${url} in your browser.`));
    browser.unref();
  }
});
