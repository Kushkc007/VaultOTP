/**
 * Repository hygiene checks: this project ships an authenticator, so a stray
 * secret, an eval() or a remote URL in the UI is a release blocker.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(ROOT, 'src', 'app.html'), 'utf8');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'web', 'www', '.gradle', 'build', 'Pods']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

test('UI never uses eval / new Function / document.write', () => {
  assert.ok(!/\beval\s*\(/.test(app), 'eval() found in src/app.html');
  assert.ok(!/new Function\s*\(/.test(app), 'new Function() found in src/app.html');
  assert.ok(!/document\.write\s*\(/.test(app), 'document.write() found in src/app.html');
});

test('UI loads no third-party resources', () => {
  const remote = app.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/gi) || [];
  assert.deepEqual(remote, [], `external asset(s) found: ${remote.join(', ')}`);
});

test('no hardcoded credentials or API keys in tracked sources', () => {
  const patterns = [
    /ghp_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(?:api[_-]?key|apikey|client[_-]?secret|access[_-]?token|storePassword|keyPassword)\s*[:=]\s*['"][^'"]{8,}/i,
    /xox[baprs]-[A-Za-z0-9-]{10,}/,
  ];

  const offenders = [];
  for (const file of walk(ROOT)) {
    if (!['.html', '.js', '.mjs', '.json', '.yml', '.yaml', '.gradle', '.xml', '.md'].includes(extname(file))) continue;
    if (file.includes('package-lock.json')) continue;
    const text = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(text)) offenders.push(`${file.replace(ROOT, '.')} → ${pattern}`);
    }
  }
  assert.deepEqual(offenders, [], `possible secret(s): \n${offenders.join('\n')}`);
});

test('no demo/sample authenticator secrets are shipped', () => {
  // Known demo keys from earlier prototypes must never come back.
  const banned = ['sample-1', 'JBSWY3DPEHPK3PXP'];
  for (const value of banned) {
    assert.ok(!app.includes(value), `leftover demo fixture "${value}" in src/app.html`);
  }
});

test('every inline event handler resolves to a defined function', () => {
  const calls = new Set();
  for (const match of app.matchAll(/on(?:click|change|input|keydown)="([^"]+)"/g)) {
    for (const call of match[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) {
      calls.add(call[1]);
    }
  }
  const builtins = new Set([
    'if', 'event', 'parseInt', 'String', 'Number', 'document', 'console', 'JSON', 'alert', 'confirm',
  ]);
  const missing = [...calls].filter(name => !builtins.has(name) && !new RegExp(`function\\s+${name}\\s*\\(`).test(app));
  assert.deepEqual(missing, [], `handlers referencing unknown functions: ${missing.join(', ')}`);
});

test('every element accessed with getElementById exists in the markup', () => {
  const ids = new Set([...app.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const dynamic = /^(sec-|bar-|key-drawer-|view-btn-)/;
  const missing = [...app.matchAll(/getElementById\('([^']+)'\)/g)]
    .map(m => m[1])
    .filter(id => !ids.has(id) && !dynamic.test(id));
  assert.deepEqual([...new Set(missing)], [], `missing element id(s): ${[...new Set(missing)].join(', ')}`);
});

test('shipped UI has no leftover TODO/FIXME markers', () => {
  const markers = app.match(/\b(TODO|FIXME|XXX)\b/g) || [];
  assert.deepEqual(markers, []);
});
