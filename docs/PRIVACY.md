# Privacy

VaultOTP is built so that "we do not collect anything" is a structural fact, not a promise.

## What leaves your device

**Nothing.** There is no backend, no SDK, no analytics, no crash reporter, no update ping.

| Data | Sent anywhere? |
|---|---|
| Secrets / TOTP keys | Never |
| Generated codes | Never |
| Account names / e-mails | Never |
| Camera frames during scanning | Never — decoded in-page, frame discarded |
| Usage statistics, device info, IP | Never |
| Backups | Only where *you* save them (downloads folder, share sheet) |

The only network-capable code in the project is the service worker, which fetches **same-origin** files to cache the app for offline use. The desktop build cancels every request that is not `file://`, `data:` or `blob:`.

## What is stored, and where

| Key | Contents | Encrypted? |
|---|---|---|
| `vaultotp_vault_v3` | your keys (or the encrypted envelope) | **only if a PIN is set** |
| `vaultotp_prefs_v1` | auto-lock minutes, clipboard timeout | no secrets |
| `vaultotp_sort` | sort preference | no secrets |

Storage is per-app:
* Web/PWA: your browser profile for that origin.
* EXE: the Electron user-data folder (`%APPDATA%/VaultOTP`).
* APK: the app's private WebView storage.

Clearing site data / app data deletes the vault permanently. **Export a backup first.**

## Third-party code

| Component | Why | Licence |
|---|---|---|
| `vendor/jsQR.js` | decode QR frames from the camera | Apache-2.0 |
| Plus Jakarta Sans, JetBrains Mono | UI fonts, **self-hosted** (`src/fonts/*.woff2`) | SIL OFL 1.1 |

No CDN, no Google Fonts, no remote images. `tests/repo.test.mjs` fails the build if any `src=`/`href=` points to an `http(s)` URL.

## Permissions

| Platform | Permission | Reason | Optional? |
|---|---|---|---|
| Web | camera | QR scanning | yes — manual entry always works |
| EXE | camera | QR scanning | yes |
| APK | camera | QR scanning | yes |
| APK | internet | required by the Android WebView runtime; no requests are made | — |

No contacts, no storage-wide access, no location, no notifications, no accessibility access.

## Server-side logs

VaultOTP has no servers. If you host `web/index.html` yourself, *your* host's access logs are the only logs that can exist — and they never see secrets, because nothing is transmitted.

## Children / GDPR / DPDP

Because no personal data is collected or transmitted, there is nothing to be a data controller *of*. The app runs entirely on your device under your control.
