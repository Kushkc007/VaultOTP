#!/usr/bin/env node
/**
 * Zero-dependency static server for local development and PWA testing.
 *   npm run dev   ->  http://localhost:4173
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

/* DIR=release serves the artefacts folder instead of the web build. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', process.env.DIR || 'web');
const PORT = Number(process.env.PORT || 4173);
/** Bind to all interfaces so a phone on the same Wi-Fi can open the app. */
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = join(ROOT, normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    filePath = join(ROOT, 'index.html');
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      // Enables clipboard + service worker on http://localhost
      'Service-Worker-Allowed': '/',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`VaultOTP dev server → http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    const nets = networkInterfaces();
    for (const list of Object.values(nets)) {
      for (const net of list || []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  phone / LAN → http://${net.address}:${PORT}`);
        }
      }
    }
  }
  console.log('Press Ctrl+C to stop.');
});
