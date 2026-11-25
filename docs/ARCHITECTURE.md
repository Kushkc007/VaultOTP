# Architecture

VaultOTP is deliberately boring: one HTML file holds the whole UI and all crypto, and three thin shells (browser/PWA, Electron, Capacitor) wrap it. That keeps the security surface small and means the web app, the EXE and the APK run *literally the same* audited code.

```
┌───────────────────────────────────────────────────────────────────────┐
│                          src/app.html                                 │
│  markup · CSS (self-hosted fonts) · state · code core · UI logic       │
│  storage container v3 (plaintext or PBKDF2+AES-GCM)                    │
└───────────────┬───────────────────────────────┬───────────────────────┘
                │  tools/build.mjs              │
      ┌─────────▼─────────┐          ┌──────────▼──────────┐
      │  web/             │          │  mobile/www/        │
      │  index.html       │          │  (Capacitor webDir) │
      │  jsQR.js fonts/   │          └──────────┬──────────┘
      │  manifest.webmanifest icons/ sw.js      │  npx cap sync
      │  VaultOTP.html (single file)            ▼
      └─────────┬─────────┘          ┌─────────────────────┐
                │                    │ android/  → APK/AAB │
                │ electron-builder   │ ios/      → IPA     │
                ▼                    └─────────────────────┘
      ┌───────────────────┐
      │ dist/desktop/     │
      │ portable.exe,     │
      │ Setup.exe, dmg,   │
      │ AppImage          │
      └───────────────────┘
```

---

## Layers

| Layer | File(s) | Responsibility |
|---|---|---|
| Application | `src/app.html` | Rendering, state, code generation, QR parsing, encryption, settings, keyboard UX |
| Build | `tools/build.mjs` | Copies/inlines assets, renders PWA icons, generates manifest + service worker, syncs `mobile/www` |
| Web shell | browser | PWA install, service worker cache, Web Share for backups |
| Desktop shell | `desktop/main.js` | Window, menu, sandbox, request filtering, permission policy |
| Mobile shell | `mobile/android` | Capacitor bridge + native share/filesystem plugins for backups |
| CI | `.github/workflows` | Tests, build matrix, signed release assets, GitHub Pages deploy |

---

## State machine inside the app

```
            ┌──────────────┐   no PIN container   ┌───────────────┐
  boot ────►│  loadVault() │─────────────────────►│   unlocked    │
            └──────┬───────┘                      │  (renderCards)│
                   │ enc:true                     └───────┬───────┘
                   ▼                                      │ lock / auto-lock
            ┌──────────────┐   correct PIN        ┌───────▼───────┐
            │    locked    │◄────────────────────►│  decrypting   │
            │ (no secrets  │                      └───────────────┘
            │  in memory)  │  5 failures → 30 s cool-down
            └──────────────┘
```

* `vault` — in‑memory `{ accounts, recycleBin }`; emptied on lock.
* `sessionKey` — `CryptoKey` for AES‑GCM; `null` while locked.
* `saveVault()` — serialises every write through a promise chain so rapid edits cannot interleave, then encrypts (if enabled) and stores.
* Auto‑lock is armed by pointer/keyboard/focus activity and cleared when the tab is hidden.

## Persistent keys

| Key | Purpose |
|---|---|
| `vaultotp_vault_v3` | the vault container (plaintext JSON or encrypted envelope) |
| `vaultotp_prefs_v1` | `{ autoLockMinutes, clipboardSeconds }` — no secrets |
| `vaultotp_sort` | last selected sort order |
| `vaultotp_data`, `vaultotp_data_v2` | legacy keys, migrated once then deleted |

---

## Security boundaries in each shell

**Browser / PWA**
- No third‑party origins in the document (fonts + QR decoder are local), enforced by `tests/repo.test.mjs`.
- Service worker caches only same‑origin assets and serves cache‑first, so the app is inert offline.
- Clipboard writes use the async Clipboard API with a `execCommand` fallback, then a timed wipe.

**Electron (`desktop/main.js`)**
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`.
- `webRequest.onBeforeRequest` cancels anything that is not `file:`, `data:` or `blob:`.
- `setWindowOpenHandler` denies new windows; `will-navigate`/`will-redirect`/`will-attach-webview` are blocked.
- Permission handler grants only `media` (camera) — geolocation, notifications, MIDI, USB etc. are denied.
- Single‑instance lock so two copies cannot race on the same profile.

**Capacitor (Android/iOS)**
- `webDir: mobile/www`; no remote URL is loaded, so the WebView stays on `https://localhost`-style local origin.
- Native share/filesystem plugins are used *only* to hand a backup file to the OS share sheet.
- Android manifest requests `INTERNET` (WebView requirement) and `CAMERA` only.

---

## Why a single HTML file?

* **Auditable** — one diffable artefact, no bundler output to reverse‑engineer.
* **Portable** — `web/VaultOTP.html` runs from a USB stick with no server and no install.
* **Identical everywhere** — the EXE and APK cannot drift from the web build; CI builds them from the same file.
* **Cheap to build** — no framework, no transpiler, no runtime dependencies; `npm run build` is a copy + inline step.

Trade‑off: the file is large (≈420 KB with the QR decoder and fonts inlined). That is well under the size of a single web font request on most sites, and it buys full offline operation.

---

## Test strategy

```
tests/core.test.mjs   → extracts /* @core */ from src/app.html, runs RFC 6238 SHA-1/256/512
                        vectors, 6/8-digit padding, period 60, >32-bit counters, base32 errors
tests/repo.test.mjs   → no eval/new Function/document.write, no remote URLs, no credentials,
                        no demo secrets, every inline handler + getElementById resolves
```

CI runs both on Linux with Node 20 and 22, then builds the web bundle; the release workflow re‑runs the tests before packaging EXE/APK/DMG.
