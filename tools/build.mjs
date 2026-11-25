#!/usr/bin/env node
/**
 * VaultOTP build script.
 *
 * src/app.html is the single source of truth for the UI + crypto. This script
 * turns it into the shippable artifacts:
 *
 *   web/                 static web app (served over HTTPS, installable as a PWA)
 *   web/VaultOTP.html    one self-contained HTML file (no network, no build step)
 *   mobile/www/          the same assets, consumed by Capacitor for Android/iOS
 *
 * Everything else (desktop EXE, Android APK) is built from those outputs.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const WEB = join(ROOT, 'web');
const MOBILE_WWW = join(ROOT, 'mobile', 'www');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const log = (...args) => console.log('[build]', ...args);

/** Recursively (re)create a directory. */
function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

/** Copy a file, creating parent directories as needed. */
function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

// ---------------------------------------------------------------- icons
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#07090e"/>
  <rect x="32" y="32" width="448" height="448" rx="104" fill="url(#bg)"/>
  <rect x="44" y="44" width="424" height="424" rx="94" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="6"/>
  <path d="M292 92 L164 300 L240 300 L222 420 L350 214 L272 214 Z" fill="#ffffff" stroke="#ffffff" stroke-width="18" stroke-linejoin="round"/>
</svg>`;

const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 258) scale(0.62) translate(-256 -256)">
    <path d="M292 92 L164 300 L240 300 L222 420 L350 214 L272 214 Z" fill="#ffffff" stroke="#ffffff" stroke-width="28" stroke-linejoin="round"/>
  </g>
</svg>`;

async function writeIcons(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'logo.svg'), ICON_SVG);

  let Resvg;
  try {
    ({ Resvg } = await import('@resvg/resvg-js'));
  } catch {
    log('skipping PNG icon render (@resvg/resvg-js not installed)');
    return;
  }

  const render = (svg, px) =>
    new Resvg(svg, { fitTo: { mode: 'width', value: px } }).render().asPng();

  writeFileSync(join(dir, 'icon-192.png'), render(ICON_SVG, 192));
  writeFileSync(join(dir, 'icon-512.png'), render(ICON_SVG, 512));
  writeFileSync(join(dir, 'icon-maskable-512.png'), render(MASKABLE_SVG, 512));
  writeFileSync(join(dir, 'icon-1024.png'), render(ICON_SVG, 1024));
  writeFileSync(join(dir, 'favicon.ico'), render(ICON_SVG, 64));
  log('icons rendered');
}

// ---------------------------------------------------------------- PWA
const MANIFEST = {
  name: 'VaultOTP — OTP Generator',
  short_name: 'VaultOTP',
  description:
    'Private, fully offline OTP generator. No accounts, no cloud, no telemetry.',
  start_url: './index.html',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  background_color: '#07090e',
  theme_color: '#07090e',
  categories: ['security', 'utilities', 'productivity'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

const SERVICE_WORKER = `/* VaultOTP service worker — cache-first so the app works with no network. */
const CACHE = 'vaultotp-${VERSION}';
const ASSETS = [
  './',
  './index.html',
  './jsQR.js',
  './manifest.webmanifest',
  './fonts/plus-jakarta-sans-latin.woff2',
  './fonts/jetbrains-mono-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
`;

// ---------------------------------------------------------------- build
function build() {
  log('version', VERSION);
  resetDir(WEB);

  const html = readFileSync(join(SRC, 'app.html'), 'utf8');
  writeFileSync(join(WEB, 'index.html'), html);
  copy(join(ROOT, 'vendor', 'jsQR.js'), join(WEB, 'jsQR.js'));

  const fontDir = join(SRC, 'fonts');
  for (const file of readdirSync(fontDir)) {
    copy(join(fontDir, file), join(WEB, 'fonts', file));
  }

  writeFileSync(join(WEB, 'manifest.webmanifest'), JSON.stringify(MANIFEST, null, 2));
  writeFileSync(join(WEB, 'sw.js'), SERVICE_WORKER);

  // Static hosts (GitHub Pages) serve .nojekyll; harmless elsewhere.
  writeFileSync(join(WEB, '.nojekyll'), '');

  // --- single-file build -------------------------------------------------
  let single = html;

  const jsqr = readFileSync(join(ROOT, 'vendor', 'jsQR.js'), 'utf8');
  single = single.replace(
    /<script src="jsQR\.js"><\/script>/,
    () => `<script>\n${jsqr}\n</script>`
  );

  for (const file of readdirSync(fontDir)) {
    const data = readFileSync(join(fontDir, file)).toString('base64');
    single = single.replaceAll(
      `fonts/${file}`,
      `data:font/woff2;base64,${data}`
    );
  }

  // A lone HTML file has no manifest/service worker neighbours.
  single = single
    .replace(/\s*<link rel="manifest"[^>]*>/, '')
    .replace(/\s*<link rel="icon"[^>]*>/, '')
    .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '');

  writeFileSync(join(WEB, 'VaultOTP.html'), single);
  log('single-file build', (single.length / 1024).toFixed(0) + ' KB');

  return buildPwaIcons();
}

async function buildPwaIcons() {
  await writeIcons(join(WEB, 'icons'));
  syncMobile();
}

function syncMobile() {
  resetDir(MOBILE_WWW);
  for (const entry of readdirSync(WEB)) {
    if (entry === 'VaultOTP.html' || entry === '.nojekyll') continue;
    const from = join(WEB, entry);
    const to = join(MOBILE_WWW, entry);
    if (entry.endsWith('.png') || entry.endsWith('.js') || entry.endsWith('.woff2')) {
      copy(from, to);
    } else if (entry === 'index.html' || entry === 'manifest.webmanifest') {
      copy(from, to);
    } else if (entry === 'fonts' || entry === 'icons') {
      for (const nested of readdirSync(from)) copy(join(from, nested), join(to, nested));
    }
  }
  // The native shell has no service worker; the registration is already guarded
  // by an http(s) check, so the copied sw.js is inert but harmless.
  copy(join(WEB, 'sw.js'), join(MOBILE_WWW, 'sw.js'));
  log('synced mobile/www');

  // Integrity summary so release notes can be verified by hand.
  const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
  log('index.html sha256:', sha(join(WEB, 'index.html')));
  log('done');
}

if (!existsSync(join(SRC, 'app.html'))) {
  console.error('src/app.html is missing');
  process.exit(1);
}

build();
