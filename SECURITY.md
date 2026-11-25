# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

* Use GitHub's private "Report a vulnerability" form (Security → Advisories), or
* e-mail the maintainers listed in `package.json`.

Include the version/artifact (web build, EXE, APK), your OS, and a minimal reproduction. We aim to acknowledge within 72 hours and to ship a fix within 30 days.

Please never include real secrets, real OTP seeds or personal account data in a report — use a throwaway key such as `JBSWY3DPEHPK3PXP`.

---

## Supported versions

| Version | Supported |
|---|---|
| 3.x | ✅ |
| 2.x and older | ❌ (prototype, plaintext storage) |

---

## Threat model

### Defended

| Threat | Mitigation |
|---|---|
| Someone reads the stored vault without your PIN | AES‑256‑GCM envelope, PBKDF2‑SHA256 (310k), per-PIN random salt, IV per save |
| Tampering with the stored blob (bit-flip/format swap) | GCM authentication tag + AAD binding to the container format |
| Offline brute force of the PIN | PBKDF2 iteration cost; use a long PIN/passphrase for high-value vaults |
| Shoulder-surfing secrets in the UI | Secrets masked in the DOM until revealed; codes never shown in notifications |
| Clipboard snooping by other apps | Clipboard auto-wipe after 15/30/60 s (configurable) |
| Malicious QR payload (HTML/JS in a QR code) | Payloads are validated as an `otpauth://` URI or Base32; only field values are stored, all rendering is HTML-escaped |
| Stored XSS from imported icons/labels | `escapeHTML()` on every interpolated value; custom emoji stripped of HTML-significant characters; no `eval`/`new Function` (test-enforced) |
| Exfiltration over the network from the desktop app | All non-`file:`/`data:`/`blob:` requests cancelled in `webRequest` |
| Remote content / phishing redirects in the EXE | `will-navigate`, `will-redirect`, `setWindowOpenHandler`, `will-attach-webview` all blocked |
| Renderer escape in the EXE | `contextIsolation`, `sandbox`, no `nodeIntegration`, no preload bridge exposing Node |
| Two instances corrupting the same profile | Electron single-instance lock |
| Silent data loss from concurrent writes | All saves serialised through a promise queue |

### Not defended (out of scope)

| Threat | Note |
|---|---|
| **Forgotten PIN** | By design the key does not exist anywhere. Restore from a backup instead. |
| Malware with your user privileges (keylogger, memory scraper) | Any authenticator app on a compromised host is readable. Use a clean device. |
| A forged/compromised build | Verify the release artefacts; build from source with `npm run build` if in doubt. |
| Someone who knows your PIN | The PIN is the security boundary — treat it as a passphrase. |
| Compromised dependency during build | Dependencies are dev-only (electron, electron-builder, resvg); pin versions and review `npm ls`. |
| Server-side code weaknesses (phishing, real-time code relay) | Time-based codes are phishing-resistant only with hardware keys/WebAuthn. Prefer passkeys where a service offers them. |
| Physical access to an unlocked, PIN-less vault | Set a PIN. |
| Losing the device without a backup | Export `.votp` backups regularly. |

---

## Cryptography details

```
KDF      PBKDF2-HMAC-SHA256, 310 000 iterations, 16-byte random salt
Cipher   AES-256-GCM
IV       12 random bytes per encryption (never reused)
AAD      "vaultotp-container-v3" (vault), same for backup containers
Envelope { v, enc, kdf:{name,iterations,salt}, iv, ct }   // all binary fields base64
```

* The key lives in a `CryptoKey` object marked non-extractable and is dropped on lock.
* `crypto.subtle` is the only cryptographic primitive used — no hand-rolled crypto in VaultOTP itself. (TOTP uses HMAC via WebCrypto; the truncation logic follows RFC 4226 §5.4 and is verified against RFC 6238 vectors.)
* New PIN or password ⇒ new salt; each save ⇒ new IV.

---

## Hardening checklist for users

1. Set a PIN of 10+ characters (digits alone are fine if long).
2. Enable auto-lock (3 minutes) and clipboard wipe (30 s).
3. Export an encrypted `.votp` backup after adding a batch of keys.
4. Keep the OS and browser updated; do not run the app on a machine you do not trust.
5. Prefer the signed releases over random mirrors; compare the SHA-256 in the release notes.

---

## Disclosure history

No public vulnerabilities reported to date.
