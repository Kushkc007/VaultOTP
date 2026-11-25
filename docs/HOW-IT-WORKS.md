# How VaultOTP works

This document explains, end to end, what happens between "my bank shows me a QR code" and "the six digits appear on my screen" — plus where your secrets live and what protects them.

---

## 1. What a TOTP secret actually is

When a service enables two‑factor authentication it generates a **shared secret** — 16–32 random bytes, printed in **Base32** (`A–Z`, `2–7`) so humans can type it. Google Authenticator, 1Password, Aegis and VaultOTP all store that same string. It is usually delivered as a QR code containing an `otpauth://` URI:

```
otpauth://totp/GitHub:you@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30&algorithm=SHA1
        │      │        │                │                              │          │          │
        │      │        │                │                              │          │          └─ default SHA-1
        │      │        │                │                              │          └─ 30-second step
        │      │        │                │                              └─ code length
        │      │        │                └─ Base32 shared secret
        │      │        └─ account label ("issuer:account" or just account)
        │      └─ type (VaultOTP supports totp; hotp/counter-based is refused)
        └─ scheme
```

The secret is the *only* thing both sides share. Everything else is derived from it plus the clock, which is why two devices showing the same secret always agree.

---

## 2. The code generation pipeline

```
             ┌──────────────────────────────────────────────────────────────┐
 Base32      │ 1. decode  "JBSWY3DPEHPK3PXP"  →  10 raw bytes               │
 secret ────►│    (5 bits per character, padding ignored)                    │
             └──────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
             ┌──────────────────────────────────────────────────────────────┐
             │ 2. counter = floor(unixSeconds / period)                     │
             │    8-byte big-endian, high word + low word                   │
             └──────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
             ┌──────────────────────────────────────────────────────────────┐
             │ 3. HMAC-<hash>(secret, counter)   hash ∈ SHA-1/256/512       │
             │    via WebCrypto: crypto.subtle.sign("HMAC", key, counter)   │
             └──────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
             ┌──────────────────────────────────────────────────────────────┐
             │ 4. dynamic truncation (RFC 4226 §5.4):                       │
             │      off  = digest[last] & 0x0f                              │
             │      bin  = (digest[off]   & 0x7f) << 24                     │
             │           |  digest[off+1]        << 16                      │
             │           |  digest[off+2]        << 8                       │
             │           |  digest[off+3]                                   │
             └──────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
             ┌──────────────────────────────────────────────────────────────┐
             │ 5. code = bin mod 10^digits, zero-padded to `digits`         │
             └──────────────────────────────────────────────────────────────┘
```

The server performs the same five steps and accepts the current step plus ±1 step of drift. VaultOTP's implementation lives in `src/app.html` between `/* @core:start */` and `/* @core:end */` and is executed verbatim by the test suite against the official RFC 6238 vectors.

**Clock requirement.** Codes come from your device clock. If it drifts more than ~30 s behind/ahead, codes fail. Fix: let the OS sync time.

**"Next Code" button.** It bumps a per‑card *display offset* by one period so you can pre‑type the next code. The offset is intentionally **not** persisted and resets on reload.

---

## 3. Where secrets are stored

Everything lives in one `localStorage` entry, key `vaultotp_vault_v3`.

### Without a PIN (default)

```json
{ "v": 3, "accounts": [ { "id": "acc_…", "name": "GitHub", "secret": "…", "digits": 6, "period": 30, "algorithm": "SHA-1", "icon": "🐙" } ], "recycleBin": [] }
```

Plain text, same profile/sandbox only. Convenient, and exactly how most open‑source TOTP web apps behave — but anyone with access to your unlocked browser profile (or a disk image) can read it.

### With a PIN (recommended)

```json
{
  "v": 3,
  "enc": true,
  "kdf": { "name": "PBKDF2-SHA256", "iterations": 310000, "salt": "<16 random bytes, base64>" },
  "iv":  "<12 random bytes, base64>",
  "ct":  "<AEAD ciphertext, base64>"
}
```

```
PIN ──PBKDF2-SHA256──► 256-bit AES key ──AES-256-GCM──► ct
                        (memory only)     AAD = "vaultotp-container-v3"
```

* **PBKDF2‑SHA256, 310 000 iterations** — OWASP's current recommendation for password‑based key derivation, costing an attacker ~310 000 HMAC operations per guess.
* **Random 16‑byte salt** per PIN, so identical PINs on two devices produce different keys.
* **AES‑256‑GCM** with a fresh random 12‑byte IV on *every* save; the additional authenticated data binds the ciphertext to the container format, so a tampered blob fails authentication instead of decrypting to garbage.
* The **key is never written anywhere**. Locking drops the key and the plaintext arrays from memory and clears the DOM.

Wrong PINs are indistinguishable from tampered data (both fail the GCM tag check), which is exactly what you want. After five failures the unlock form pauses for 30 seconds.

> Losing the PIN is equivalent to losing the vault. VaultOTP shows this warning before encryption is enabled — keep an exported backup.

---

## 4. Backups

| Format | Contents | Protection |
|---|---|---|
| `.json` ("Export") | `{ app, kind: "plaintext-backup", accounts[] }` | none — readable by anyone |
| `.votp` ("Encrypted backup") | same payload, sealed with **your backup password** | PBKDF2 + AES‑256‑GCM |

The backup password is independent of the vault PIN: you can hand an encrypted backup to a friend or keep it in cloud storage without exposing the vault.

On import VaultOTP: parses the container → decrypts if needed → validates every Base32 secret → skips duplicates → asks which keys you want.

---

## 5. QR scanning

* **Web / Android / desktop:** `getUserMedia` → video frames are drawn to a `<canvas>` at 420 px wide → `jsQR` decodes luminance data → the resulting string is parsed.
* Accepted payloads: `otpauth://totp/…` and a bare Base32 secret. `otpauth://hotp/…` is rejected (counter‑based codes need a moving counter we cannot observe).
* Scanning never uploads frames; the canvas is local and discarded each tick.
* The form is **pre‑filled, not saved** — you review the name/secret before anything is written.

**Desktop note.** Windows cameras are supported by Electron; if no camera is available, the paste‑an‑`otpauth://`‑URI path covers the same use case (the browser-based `web/index.html` can also scan and then be exported/imported).

---

## 6. The three builds share one source

```
                    src/app.html   (markup + CSS + JS, no build step required)
                          │
                 tools/build.mjs
        ┌─────────────────┼──────────────────────────┐
        ▼                 ▼                          ▼
  web/index.html   web/VaultOTP.html        mobile/www/*  ──cap sync──►  android/  →  APK
  (+ PWA files)    (everything inlined)                             └─►  ios/      →  IPA
        │
        └──► desktop/main.js (Electron shell) ──► portable EXE / installer
```

There is exactly one copy of the application logic. `web/`, `mobile/www/` and `dist/` are build output and git‑ignored.

---

## 7. Self‑verification

Two layers:

1. **`npm test`** extracts the TOTP core from the HTML and checks it against the RFC 6238 vectors for SHA‑1, SHA‑256 and SHA‑512, plus repository hygiene (no `eval`, no remote URLs, no credentials, no dangling UI handlers).
2. **⚙️ → Run self‑test** runs the same RFC vectors inside the running app, so an installed EXE/APK can prove its crypto is intact on that device.

If both pass, the digits you see are the digits every other RFC‑compliant authenticator would show.
