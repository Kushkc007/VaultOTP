# Testing VaultOTP

## Automated checks

```bash
npm test
```

30 checks on plain `node --test` — nothing to install.

| File | What it proves |
|---|---|
| `tests/totp.test.mjs` | The eight official RFC 6238 vectors for SHA‑1, SHA‑256 and SHA‑512, zero-padding, 30 s / 60 s periods, 8-digit codes, Base32 edge cases and >32-bit counters |
| `tests/repo.test.mjs` | Repository hygiene: no `eval` / `new Function` / `document.write`, no remote asset URLs, no committed credentials or demo secrets, and every `onclick="…"` handler and `getElementById` id in `src/app.html` exists |

CI runs the same suite on Node 20 and 22 (`.github/workflows/ci.yml`) plus CodeQL.

---

## Manual release checklist

| Check | Expected |
|---|---|
| Open `web/index.html` via `npm run dev` | Vault renders, no console errors, no network requests after load |
| Add a key with a bad secret (`not-base32!!`) | Rejected with a clear message, nothing saved |
| Paste a full `otpauth://` URI into the secret field | Issuer / account / digits / period / algorithm parsed |
| Tap a code | Copied, toast shown without echoing the code |
| Delete a key → Recycle Bin → Restore | Key returns with the same code |
| Export `.json`, re-import it | Duplicate keys are detected and skipped |
| Export `.votp`, open it in a text editor | `enc: true`, no readable secrets |
| Set a PIN, reload the page | Lock screen, no six-digit codes in the DOM |
| Five wrong PINs | 30 s cool-down, then the correct PIN unlocks |
| Install the APK on a phone | Camera permission asked only after tapping **Scan QR** |
| Scan a real `otpauth://` QR | Form opens pre-filled; nothing saved until **Save Key** |
| Airplane mode | Codes keep generating |
| Desktop `Ctrl+L` | Vault locks immediately |

---

## Refreshing the screenshots

The PNGs in `docs/screenshots/` are generated from the real `web/` build with fake
demo keys. If you change the UI, retake them at 1600×1000 (desktop) and 400×860
(mobile) and keep the file names — the README links to them directly.
