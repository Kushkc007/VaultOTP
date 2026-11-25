# Changelog

All notable changes to VaultOTP are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [3.1.0] — 2025-11-25

Layout release: the vault now uses the whole window instead of leaving large side gutters.

### Changed
- **Vault grid**: cards per row went from 2 to **4 on wide screens** (3 on laptops, 2 on tablets, 1 on phones). The container widened from 900 px to 1480 px, so the side gutters shrink from ~180 px to 24–60 px.
- **Narrow cards reflow**: container queries shrink the code font and hide the “Copy Code” label when a card is under ~355 px, so 4-up layouts never look cramped.
- Card actions wrap instead of overflowing on small phone widths.

### Added
- Phone testing over Wi-Fi: `tools/serve.mjs` binds to `0.0.0.0` by default and prints the LAN URLs; `DIR=release PORT=8081 node tools/serve.mjs` serves the APK for download on the same network.
- `docs/TESTING.md` — what the automated checks prove and the manual release checklist.
- Fresh README screenshots taken from the 3.1.0 build, plus Dependabot and CodeQL for repository upkeep.

## [3.0.0] — 2025-11-25

First public, GitHub-ready release. Same UI as the prototype, with the storage, crypto and packaging rebuilt.

### Added
- **PIN lock with real encryption**: PBKDF2-SHA256 (310 000 iterations) → AES-256-GCM, random salt per PIN, random IV per save, AAD bound to the container.
- **Auto-lock** (1/3/5/15 min or never) plus a one-click Lock button.
- **Encrypted backups** (`.votp`) protected by a separate backup password.
- **Clipboard auto-wipe** (15/30/60 s), configurable.
- **SHA-256 / SHA-512 TOTP** support in addition to SHA-1.
- **In-app self-test** running the RFC 6238 vectors on the device.
- **Keyboard shortcuts** (`/`, `N`, `S`, `L`, `,`, `Esc`) and a shortcuts dialog.
- **PWA**: web manifest, service worker, installable, fully offline.
- **Single-file build** `web/VaultOTP.html` (fonts + QR decoder inlined).
- **Electron desktop shell** with a hardened security policy, native menu and portable/NSIS builds.
- **CI**: tests on Node 20/22, GitHub Pages deploy, and a release pipeline that attaches EXE/APK/DMG/AppImage.
- Documentation set: README, HOW-IT-WORKS, ARCHITECTURE, BUILD, PRIVACY, FAQ, SECURITY, CONTRIBUTING.
- Test suite: 30 checks (RFC 6238 vectors for SHA-1/256/512, padding, >32-bit counters, plus repository hygiene).

### Fixed
- **Storage key mismatch** — data was written to `vaultotp_data` while the loader read `vaultotp_data_v2`, so the vault only survived via the legacy-migration path. All reads and writes now share one v3 container key with automatic migration.
- **Unvalidated secrets** — the add form accepted any string, producing `ERROR` cards. Base32 is now validated (character set + minimum length) with a clear message.
- **Stored XSS via icons/labels** — imported or custom icons were interpolated into `innerHTML` unescaped. All interpolated values are escaped and custom emoji are stripped of HTML characters.
- **Duplicate handling** — duplicate detection compared name *and* secret; it now compares secrets, so renaming a service no longer creates a hidden duplicate.
- **"Next Code" desync** — the display offset was not reflected in the countdown, and the offset leaked into persistence. The timer is now offset-aware and the offset is session-only.
- **32-bit counter truncation** — the moving counter now writes both halves of the 64-bit big-endian value.
- **Concurrent writes** — saves are serialised through a promise queue, so rapid edits cannot interleave.
- **Secrets exposed in the DOM** — inline secret drawers now render a mask and only insert the real value on demand.
- Codes echoed in the copy toast — the toast no longer prints the code.

### Changed
- Secrets are no longer stored under the prototype's plain-text key; a one-time migration runs on first launch and then deletes the legacy keys.
- Google Fonts CDN links removed; both variable fonts are self-hosted (`src/fonts`) so the app makes zero third-party requests.
- Repository restructured: `src/` (source), `vendor/` (third-party), `tools/` (build), `desktop/`, `mobile/`, `tests/`, `docs/`. Generated folders (`web/`, `mobile/www/`, `dist/`) are git-ignored.
- Demo/sample entries and prototype data fixtures removed from the codebase.

### Security
- Desktop shell: navigation, redirects, new windows, webviews and all non-`file:` requests blocked; only the camera permission is granted; single-instance lock.
- Fail-open removed from the unlock path: wrong PIN shows a throttled error (five attempts → 30 s cool-down) and never renders partial data.

## [2.0.0] — 2025-08 (prototype, unpublished)

### Added
- Recycle bin, emoji icon picker, multi-select import/export, QR scanning, search and sorting, splash screen, Android/iOS Capacitor scaffolding.

## [1.0.0] — 2025-08 (prototype, unpublished)

### Added
- Initial single-file TOTP authenticator with Base32 + WebCrypto HMAC-SHA1.

[3.0.0]: https://github.com/Kushkc007/vaultotp/releases/tag/v3.0.0
[2.0.0]: https://github.com/Kushkc007/vaultotp
[1.0.0]: https://github.com/Kushkc007/vaultotp
