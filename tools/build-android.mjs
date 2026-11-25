#!/usr/bin/env node
/**
 * Android build pipeline:
 *   1. build the web assets (tools/build.mjs)  → mobile/www
 *   2. npm install in mobile/ (Capacitor + plugins)
 *   3. capacitor sync android                  → copies www into the native project
 *   4. gradle assembleDebug (+ assembleRelease when signing is configured)
 *
 * Environment: JAVA_HOME (JDK 17+) and ANDROID_HOME / ANDROID_SDK_ROOT.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(ROOT, 'mobile');
const ANDROID = join(MOBILE, 'android');
const isWin = process.platform === 'win32';

const run = (cmd, args, cwd, env = {}) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}   (${cwd.replace(ROOT, '.')})`);
  // Node is launched directly (its path contains spaces); npm/npx/gradlew need a shell.
  const useShell = isWin && cmd !== process.execPath;
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: useShell,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
};

// 1) web assets
run(process.execPath, [join(ROOT, 'tools', 'build.mjs')], ROOT);

// 2) mobile dependencies
if (!existsSync(join(MOBILE, 'node_modules', '@capacitor', 'cli'))) {
  run('npm', ['install', '--no-audit', '--no-fund'], MOBILE);
}

// 3) capacitor sync
run('npx', ['cap', 'sync', 'android'], MOBILE);

// 4) gradle
// On POSIX the wrapper is run through sh so a missing execute bit (common when the
// repository is checked out on Windows) cannot break the build.
const gradlew = isWin ? 'gradlew.bat' : './gradlew';
const env = {};

if (!process.env.JAVA_HOME) {
  console.warn('\n[warn] JAVA_HOME is not set — Gradle needs a JDK (17 or newer, 21 recommended).');
}
if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  console.warn('[warn] ANDROID_HOME is not set — Gradle cannot find the Android SDK.');
}

// Optional release signing injected from environment variables (never committed).
// CI can either point VAULTOTP_KEYSTORE_PATH at an existing file or supply the
// keystore as base64 in VAULTOTP_KEYSTORE_BASE64.
let keystorePath = process.env.VAULTOTP_KEYSTORE_PATH;
const keystoreBase64 = process.env.VAULTOTP_KEYSTORE_BASE64;

if (!keystorePath && keystoreBase64) {
  const { tmpdir } = await import('node:os');
  keystorePath = join(tmpdir(), 'vaultotp-release.jks');
  writeFileSync(keystorePath, Buffer.from(keystoreBase64, 'base64'));
  console.log('[info] release keystore decoded from VAULTOTP_KEYSTORE_BASE64');
}

const signing = {
  storeFile: keystorePath,
  storePassword: process.env.VAULTOTP_KEYSTORE_PASSWORD,
  keyAlias: process.env.VAULTOTP_KEY_ALIAS,
  keyPassword: process.env.VAULTOTP_KEY_PASSWORD,
};
const signingConfigured = signing.storeFile && signing.storePassword && signing.keyAlias && signing.keyPassword;
const signingFile = join(ANDROID, 'keystore.properties');

if (signingConfigured) {
  writeFileSync(
    signingFile,
    [
      `storeFile=${signing.storeFile}`,
      `storePassword=${signing.storePassword}`,
      `keyAlias=${signing.keyAlias}`,
      `keyPassword=${signing.keyPassword}`,
      '',
    ].join('\n')
  );
  console.log('\n[info] release signing configured from environment variables');
}

try {
  // POSIX: `sh ./gradlew <tasks>` so a missing execute bit cannot break the build.
  const gradle = (...tasks) =>
    isWin ? run(gradlew, tasks, ANDROID, env) : run('sh', [gradlew, ...tasks], ANDROID, env);
  gradle('assembleDebug');
  if (signingConfigured) {
    gradle('assembleRelease');
  } else {
    console.log('\n[info] skipping assembleRelease (no VAULTOTP_KEYSTORE_* environment variables)');
  }
} finally {
  if (signingConfigured && existsSync(signingFile)) rmSync(signingFile, { force: true });
}

// 5) report
const apkDir = join(ANDROID, 'app', 'build', 'outputs', 'apk');
const outputs = [];
for (const flavour of ['debug', 'release']) {
  const path = join(apkDir, flavour, flavour === 'debug' ? 'app-debug.apk' : 'app-release.apk');
  if (existsSync(path)) {
    const size = (readFileSync(path).length / 1024 / 1024).toFixed(1);
    outputs.push(`  ${path.replace(ROOT, '.')}  (${size} MB)`);
  }
}
console.log(`\nAPK output:\n${outputs.join('\n') || '  (none found)'}`);
