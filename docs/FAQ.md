# FAQ

### Is VaultOTP really free and offline?

Yes. MIT-licensed, no account, no subscription, no network calls at runtime.

### Which platforms are supported?

* **Web** — any modern browser (Chrome/Edge 90+, Firefox 90+, Safari 15+). Installable as a PWA.
* **Windows** — portable `.exe` (no install) and an NSIS installer. macOS `.dmg` and Linux `.AppImage` are produced by CI.
* **Android** — APK for Android 7.0 (API 24) and newer.

### Are the codes the same as Google Authenticator's?

Yes — TOTP is standardised (RFC 6238). Same secret + same clock = same code. VaultOTP even runs the RFC's test vectors as an in-app self-test (**⚙️ → Run self-test**).

### How do I move my existing keys in?

* **From a backup file:** Export → Import.
* **From a QR:** Scan the service's QR code (or the "transfer accounts" QR from Google Authenticator).
* **Manually:** paste the Base32 secret, or paste the whole `otpauth://` URI into the secret field.

### Where do I find the secret if the service only shows a QR?

Use **Scan QR**, or right-click → copy image address of the QR (many sites expose an `otpauth://` URL), or use any offline QR reader. The secret is the `secret=` parameter.

### I forgot my PIN — can I recover the vault?

No. The PIN derives the encryption key and is never stored. If you have a backup file, import it; otherwise the encrypted vault is unrecoverable by design. This is why the app warns you before enabling a PIN.

### How do I restore a backup?

**Import** → pick the `.json` or `.votp` file → for `.votp`, enter the backup password → select the keys → Import. Duplicates are detected and skipped.

### The codes are rejected. Why?

1. Device clock drift — enable automatic time sync.
2. Wrong secret (truncated/whitespace copy).
3. The service expects a different digit count or period (VaultOTP auto-detects these from QR codes; check the add-form dropdowns when entering manually).
4. The service wants HOTP (counter-based) — not supported.

### Does the clipboard create a risk?

Set **⚙️ → Clear clipboard after** to 15/30 s. VaultOTP wipes the clipboard after copying a code.

### Can I use it on two devices?

Not automatically — there is no sync by design. Export an encrypted `.votp` backup and import it on the second device.

### What happens if I clear my browser data?

The vault is deleted. Export first. On Windows the vault lives in `%APPDATA%/VaultOTP`; on Android it is in the app's private storage (cleared when you uninstall).

### Can I put the single HTML file on a USB stick?

Yes — `web/VaultOTP.html` is fully self-contained (fonts and QR decoder inlined). Double-click it; `file://` works, though the camera may be blocked by the browser on `file://` (manual paste still works).

### Is the app store version available?

Not yet. Android ships as a signed APK; Windows as an EXE. Play Store / Microsoft Store packaging is on the roadmap.

### Why does the APK ask for internet permission?

The Android WebView runtime declares it and Capacitor's local server uses it. VaultOTP makes no outbound requests; the desktop build goes further and cancels all non-local traffic.

### How do I verify a build?

```bash
npm ci && npm test && npm run build
sha256sum web/index.html     # compare with the SHA printed by tools/build.mjs
```

### Can I contribute a translation?

Yes — see [CONTRIBUTING.md](../CONTRIBUTING.md); localisation extraction is on the roadmap.

### Are time-based codes secure enough?

TOTP is far better than a password alone but is phishable (a fake site can relay a code in real time). Where a service supports passkeys/WebAuthn, prefer those; use VaultOTP where it does not.
