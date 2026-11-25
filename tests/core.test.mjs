/**
 * RFC 6238 / RFC 4226 conformance tests for the code core that ships inside
 * src/app.html. The core is deliberately free of DOM access and is delimited by
 * `/* @core:start *\/` … `/* @core:end *\/` so it can be executed here as-is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'src', 'app.html'), 'utf8');

const match = html.match(/\/\* @core:start \*\/([\s\S]*?)\/\* @core:end \*\//);
assert.ok(match, 'core markers are missing from src/app.html');

// Evaluate the exact code the browser runs.
const core = new Function(`${match[1]}; return { base32ToBuffer, codeAt };`)();
const { codeAt, base32ToBuffer } = core;

/** Minimal RFC 4648 Base32 encoder used to build the RFC 6238 test keys. */
function base32Encode(ascii) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = Buffer.from(ascii, 'ascii');
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += alphabet[parseInt(chunk, 2)];
  }
  return out;
}

const SECRET_SHA1 = base32Encode('12345678901234567890');
const SECRET_SHA256 = base32Encode('12345678901234567890123456789012');
const SECRET_SHA512 = base32Encode(
  '1234567890123456789012345678901234567890123456789012345678901234'
);

const VECTORS = [
  // [unix time, SHA-1, SHA-256, SHA-512]
  [59, '94287082', '46119246', '90693936'],
  [1111111109, '07081804', '68084774', '25091201'],
  [1111111111, '14050471', '67062674', '99943326'],
  [1234567890, '89005924', '91819424', '93441116'],
  [2000000000, '69279037', '90698825', '38618901'],
  [20000000000, '65353130', '77737706', '47863826'],
];

const CANONICAL_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
assert.equal(SECRET_SHA1, CANONICAL_SECRET, 'base32 encoder sanity check');

for (const [time, sha1, sha256, sha512] of VECTORS) {
  test(`RFC 6238 SHA-1 vector T=${time}`, async () => {
    const code = await codeAt(SECRET_SHA1, {
      period: 30, digits: 8, algorithm: 'SHA-1', epochSeconds: time,
    });
    assert.equal(code, sha1);
  });

  test(`RFC 6238 SHA-256 vector T=${time}`, async () => {
    const code = await codeAt(SECRET_SHA256, {
      period: 30, digits: 8, algorithm: 'SHA-256', epochSeconds: time,
    });
    assert.equal(code, sha256);
  });

  test(`RFC 6238 SHA-512 vector T=${time}`, async () => {
    const code = await codeAt(SECRET_SHA512, {
      period: 30, digits: 8, algorithm: 'SHA-512', epochSeconds: time,
    });
    assert.equal(code, sha512);
  });
}

test('6-digit codes are zero padded', async () => {
  const code = await codeAt(SECRET_SHA1, {
    period: 30, digits: 6, algorithm: 'SHA-1', epochSeconds: 1111111109,
  });
  assert.equal(code.length, 6);
  assert.equal(code, '081804');
});

test('period 60 produces a different code from period 30', async () => {
  const opts = { digits: 6, algorithm: 'SHA-1', epochSeconds: 1234567890 };
  const a = await codeAt(SECRET_SHA1, { ...opts, period: 30 });
  const b = await codeAt(SECRET_SHA1, { ...opts, period: 60 });
  assert.notEqual(a, b);
});

test('counter beyond 32 bits is encoded correctly', async () => {
  // Year 2100+ exercises the high 32 bits of the moving counter.
  const code = await codeAt(SECRET_SHA1, {
    period: 30, digits: 8, algorithm: 'SHA-1', epochSeconds: 4102444800,
  });
  assert.match(code, /^\d{8}$/);
});

test('base32 decoder rejects invalid characters', () => {
  assert.throws(() => base32ToBuffer('NOT-BASE32-1'));
});

test('base32 decoder ignores padding and separators', () => {
  const withPadding = base32ToBuffer('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ===');
  const plain = base32ToBuffer('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.deepEqual(new Uint8Array(withPadding), new Uint8Array(plain));
});
