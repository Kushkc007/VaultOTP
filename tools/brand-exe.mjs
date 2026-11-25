/**
 * Developer utility: brand an already-built Windows EXE with the VaultOTP icon
 * and version metadata using resedit (pure JS — no signing tooling required).
 *
 * Useful on machines where electron-builder cannot create symlinks from the
 * winCodeSign archive (no Developer Mode / admin rights), so the build has to
 * run with `-c.win.signAndEditExecutable=false`.
 *
 *   npm i --no-save resedit
 *   node tools/brand-exe.mjs dist/desktop/VaultOTP-3.0.0-portable.exe
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NtExecutable, NtExecutableResource, Resource, Data } from 'resedit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('usage: node tools/brand-exe.mjs <app.exe> [more.exe…]');
  process.exit(1);
}

// A real .ico is required (resedit parses the ICO container, not a PNG).
const iconCandidates = [
  join(ROOT, 'build', 'desktop', 'icon.ico'),
  join(ROOT, 'dist', 'desktop', '.icon-ico', 'icon.ico'),
];
const iconFile = iconCandidates.find(p => existsSync(p));
if (!iconFile) {
  console.error('No .ico found. Build the desktop app first, or place build/desktop/icon.ico.');
  process.exit(1);
}

for (const target of targets) {
  const exe = NtExecutable.from(readFileSync(target), { ignoreCert: true });
  const res = NtExecutableResource.from(exe);

  // Icon groups — replace every group so Explorer, the taskbar and the
  // installer stub all show the VaultOTP mark.
  const icon = Data.IconFile.from(readFileSync(iconFile));
  const iconGroups = res.entries.filter(e => e.type === 14).map(e => e.id);
  for (const id of (iconGroups.length ? iconGroups : [1])) {
    Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      id,
      1033,
      icon.icons.map(i => i.data)
    );
  }
  console.log(`  icon groups patched: ${(iconGroups.join(', ') || '1')} (${target.replace(ROOT, '.')})`);

  // Version metadata
  const vi = Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) {
    vi.setFileVersion(3, 0, 0, 0);
    vi.setProductVersion(3, 0, 0, 0);
    vi.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        ProductName: 'VaultOTP',
        FileDescription: 'VaultOTP — offline TOTP authenticator',
        CompanyName: 'VaultOTP contributors',
        LegalCopyright: 'MIT licensed',
        OriginalFilename: target.split(/[\\/]/).pop(),
        InternalName: 'VaultOTP',
        ProductVersion: pkg.version,
        FileVersion: pkg.version,
      }
    );
    vi.outputToResourceEntries(res.entries);
  }

  res.outputResource(exe);
  writeFileSync(target, Buffer.from(exe.generate()));
  console.log('branded', target.replace(ROOT, '.'));
}
