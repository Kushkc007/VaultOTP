#!/usr/bin/env node
/**
 * Regenerates the Android launcher icons and splash screens from the VaultOTP
 * bolt-shield mark, plus the shared logo SVG. Run with `npm run icons`.
 *
 * The web/PWA icons are produced by tools/build.mjs (same artwork).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID_RES = join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res');

const BOLT = 'M292 92 L164 300 L240 300 L222 420 L350 214 L272 214 Z';

const DEFS = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#06b6d4"/>
    </linearGradient>
    <radialGradient id="sp" cx="0.5" cy="0.18" r="1">
      <stop offset="0" stop-color="#1b2044"/><stop offset="1" stop-color="#07090e"/>
    </radialGradient>
    <filter id="ds" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#04101d" flood-opacity="0.55"/>
    </filter>
  </defs>`;

const fullSlab = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${DEFS}
  <rect width="512" height="512" fill="#07090e"/>
  <rect x="32" y="32" width="448" height="448" rx="112" fill="url(#bg)"/>
  <rect x="44" y="44" width="424" height="424" rx="102" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="6"/>
  <path d="${BOLT}" fill="#ffffff" stroke="#ffffff" stroke-width="18" stroke-linejoin="round" filter="url(#ds)"/>
</svg>`;

const roundArt = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${DEFS}
  <rect width="512" height="512" fill="#07090e"/>
  <circle cx="256" cy="256" r="216" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="206" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="5"/>
  <path d="${BOLT}" fill="#ffffff" stroke="#ffffff" stroke-width="20" stroke-linejoin="round" filter="url(#ds)"/>
</svg>`;

// Bolt only, centred inside the adaptive-icon safe zone.
const boltOnly = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${DEFS}
  <g transform="translate(256 258) scale(0.62) translate(-256 -256)">
    <path d="${BOLT}" fill="#ffffff" stroke="#ffffff" stroke-width="26" stroke-linejoin="round"/>
  </g>
</svg>`;

const splashArt = (W, H) => {
  const L = Math.round(Math.min(H * 0.34, W * 0.55));
  const x = Math.round((W - L) / 2);
  const y = Math.round((H - L) / 2) - Math.round(H * 0.02);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${DEFS}
    <rect width="${W}" height="${H}" fill="url(#sp)"/>
    <svg x="${x}" y="${y}" width="${L}" height="${L}" viewBox="0 0 512 512">
      <rect x="32" y="32" width="448" height="448" rx="112" fill="url(#bg)"/>
      <rect x="44" y="44" width="424" height="424" rx="102" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="6"/>
      <path d="${BOLT}" fill="#ffffff" stroke="#ffffff" stroke-width="18" stroke-linejoin="round" filter="url(#ds)"/>
    </svg>
  </svg>`;
};

let Resvg;
try {
  ({ Resvg } = await import('@resvg/resvg-js'));
} catch {
  console.error('Install dev dependencies first: npm install');
  process.exit(1);
}

const render = (svg, outPath, pxWidth) => {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: pxWidth } }).render().asPng();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log('wrote', outPath.replace(ROOT, '.'), `(${pxWidth}px)`);
};

// Legacy launcher icons
for (const [dir, size] of [['mipmap-mdpi', 48], ['mipmap-hdpi', 72], ['mipmap-xhdpi', 96], ['mipmap-xxhdpi', 144], ['mipmap-xxxhdpi', 192]]) {
  render(fullSlab(), join(ANDROID_RES, dir, 'ic_launcher.png'), size);
  render(roundArt(), join(ANDROID_RES, dir, 'ic_launcher_round.png'), size);
}

// Adaptive icon foregrounds (108dp grid)
for (const [dir, size] of [['mipmap-mdpi', 108], ['mipmap-hdpi', 162], ['mipmap-xhdpi', 216], ['mipmap-xxhdpi', 324], ['mipmap-xxxhdpi', 432]]) {
  render(boltOnly(), join(ANDROID_RES, dir, 'ic_launcher_foreground.png'), size);
}

// Splash screens
const splashes = [
  ['drawable', 480, 800],
  ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280], ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1920, 3200],
  ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720], ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 3200, 1920],
];
for (const [dir, w, h] of splashes) {
  render(splashArt(w, h), join(ANDROID_RES, dir, 'splash.png'), w);
}

// Shared logo for the web build / README
render(fullSlab(), join(ROOT, 'docs', 'logo-512.png'), 512);
console.log('done');
