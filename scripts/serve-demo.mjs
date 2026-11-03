import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Deliberately no application API, storage, credentials, npm dependencies or proxy.
const assets = new Map([
  ['/', ['devfest.html', 'text/html; charset=utf-8']],
  ['/devfest.html', ['devfest.html', 'text/html; charset=utf-8']],
  ['/devfest.css', ['devfest.css', 'text/css; charset=utf-8']],
  ['/devfest-demo.js', ['devfest-demo.js', 'text/javascript; charset=utf-8']],
  ['/devfest-fixtures.js', ['devfest-fixtures.js', 'text/javascript; charset=utf-8']],
]);
export function createDemoServer() {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('This demonstration does not accept data.'); return;
    }
    const asset = assets.get((req.url || '').split('?')[0]);
    if (!asset) { res.writeHead(404); res.end('Not part of the offline demonstration.'); return; }
    try {
      const bytes = await readFile(new URL('../frontend/public/' + asset[0], import.meta.url));
      res.writeHead(200, { 'Content-Type': asset[1], 'Content-Length': bytes.length });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bundled demo assets are missing. Restore the frontend/public/devfest files.');
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.DEMO_PORT || 3031);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('DEMO_PORT must be an integer between 1 and 65535.'); process.exitCode = 1;
  } else {
    const server = createDemoServer();
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? 'Demo port is busy. Choose another DEMO_PORT.' : 'The local demonstration server could not start.');
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log('StrikeOut fictional offline demo: http://localhost:' + port + '/devfest.html'));
  }
}
