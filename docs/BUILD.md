# Build guide

Everything is built from `src/app.html`. There is no framework, no transpiler and no bundler.

```
npm install          # dev tooling only: resvg (icons), electron, electron-builder
npm test             # 30 checks: RFC 6238 vectors + repository hygiene
npm run build        # web/ + web/VaultOTP.html + mobile/www/
```

| Script | What it produces |
|---|---|
| `npm run dev` | builds, then serves `web/` on <http://localhost:4173> |
| `npm run build` | static web app, single-file HTML, PWA assets, `mobile/www` |
| `npm run build:desktop` | portable `.exe` + NSIS installer (+ `.dmg`/`.AppImage` on those hosts) |
| `npm run build:android` | unsigned/debug-signed `.apk` via Gradle |
| `npm run build:all` | desktop + android |
| `npm run icons` | regenerates Android/iOS launcher + splash artwork |

---

## 1. Web app

```bash
npm install
npm run build
# web/index.html          ← serve this over http(s)
# web/VaultOTP.html       ← single file: double-click, works offline
```

Requirements: Node.js ≥ 20. No network access is needed at runtime; the build itself needs npm once.

Hosting notes:

* Any static host works (GitHub Pages, Netlify, S3, a USB stick for the single file).
* Serve over **HTTPS** (or `localhost`) — clipboard, camera and service workers require a secure context.
* `.github/workflows/pages.yml` deploys `web/` to GitHub Pages on every push to `main`.

---

## 2. Windows EXE (Electron)

```bash
npm install
npm run build:desktop
```

Output (`dist/desktop/`):

| File | Use |
|---|---|
| `VaultOTP-<version>-portable.exe` | single executable, no install, no admin rights |
| `VaultOTP-Setup-<version>.exe` | NSIS installer with Start-menu/desktop shortcuts |
| `win-unpacked/` | raw app directory for debugging |

Details:

* Electron version is pinned in `package.json` `devDependencies`.
* The shell is `desktop/main.js`; the packaged files are `desktop/main.js`, `web/**` and `package.json` (see `desktop/electron-builder.yml`).
* `npmRebuild: false` — there are no native modules.
* First local build downloads the Electron binary (~100 MB) and the NSIS/winCodeSign tooling; later builds are offline.
**If `electron-builder` fails with `Cannot create symbolic link … winCodeSign`:**
Windows needs Developer Mode (or admin rights) to extract the signing tools, which are only needed
to *stamp* the icon and metadata into the exe. Two options:

```bash
# 1) skip stamping, then apply the icon/metadata with pure JS
npx electron-builder --config desktop/electron-builder.yml -c.win.signAndEditExecutable=false
npm i --no-save resedit && node tools/brand-exe.mjs dist/desktop/VaultOTP-*-portable.exe dist/desktop/VaultOTP-Setup-*.exe

# 2) enable Windows Developer Mode (Settings → System → For developers) and rebuild normally
```

CI runners do not have this restriction, so release builds are stamped automatically.

* Unsigned builds show a SmartScreen warning. For a clean prompt, add a code-signing certificate:

```yaml
# desktop/electron-builder.yml
win:
  certificateFile: build/desktop/cert.pfx      # never commit this file
  certificatePassword: ${env.WIN_CSC_KEY_PASSWORD}
```

macOS/Linux: the same script emits `.dmg` and `.AppImage` when run on those platforms (CI does this).

---

## 3. Android APK

```bash
npm install
npm run build:android
```

Requirements:

| Tool | Version |
|---|---|
| JDK | 21 |
| Android SDK Platform | 36 |
| Android Build-Tools | 36.0.0 |
| Gradle | 8.14.3 (wrapper, bundled) |

Environment:

```bash
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=/path/to/android-sdk
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

The script runs `node tools/build.mjs` → `npx cap sync android` → `./gradlew assembleDebug assembleRelease`.

Output:

```
mobile/android/app/build/outputs/apk/debug/app-debug.apk       (debug keystore, installable)
mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Release signing

1. Create a keystore **outside the repo** (never commit it):

```bash
keytool -genkey -v -keystore ~/vaultotp-release.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias vaultotp
```

2. Provide credentials via environment variables / GitHub secrets:

```
VAULTOTP_KEYSTORE_PATH   (absolute path or base64 of the .jks)
VAULTOTP_KEYSTORE_PASSWORD
VAULTOTP_KEY_ALIAS
VAULTOTP_KEY_PASSWORD
```

3. The release workflow (`.github/workflows/release.yml`) decodes the keystore, injects a temporary `signing.properties`, signs and uploads `VaultOTP-<version>.apk`.

`.gitignore` already blocks `*.jks`, `*.keystore`, `keystore.properties` and `local.properties`.

### iOS (optional, macOS only)

The repository ships the Android shell only. To add iOS:

```bash
cd mobile
npm install
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios        # archive in Xcode
```
The web layer needs no changes — `mobile/www` is platform-neutral.

---

## 4. CI / releases

| Workflow | Trigger | Result |
|---|---|---|
| `ci.yml` | push / PR | `npm test`, web build on Node 20 & 22, artifact upload |
| `release.yml` | tag `v*` | tests → web zip + EXE (Windows runner) + APK (Ubuntu runner with SDK) + dmg/AppImage → GitHub Release |
| `pages.yml` | push to `main` | deploys `web/` to GitHub Pages |

Cut a release:

```bash
npm version patch        # or minor / major — updates package.json
git push --follow-tags   # release.yml builds and publishes the assets
```

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| `electron-builder` cannot find `web/` | run `npm run build` first (the `build:desktop` script does it for you) |
| Gradle: `SDK location not found` | set `ANDROID_HOME`, or create `mobile/android/local.properties` with `sdk.dir=…` (git-ignored) |
| Gradle: `Unsupported class file major version` | use JDK 21 for AGP 8.x |
| APK installs but camera is black | grant Camera permission in Android settings |
| Codes are rejected by the service | check the device clock (auto time sync) and that the secret was copied completely |
| `npm install` fails behind a proxy | `npm config set proxy …`, or install on a machine with direct access |

---

## 6. Publishing a release

```bash
npm run build:all      # EXE installer + portable + APK
npm run build          # web/ + single-file HTML

mkdir -p release
cp dist/desktop/VaultOTP-<v>-portable.exe dist/desktop/VaultOTP-Setup-<v>.exe    mobile/android/app/build/outputs/apk/debug/app-debug.apk release/
cp web/VaultOTP.html release/VaultOTP-<v>-single-file.html
cp web/*.js web/*.json web/*.png release/ 2>/dev/null || true
(cd release && sha256sum *.exe *.apk *.html > SHA256SUMS.txt)

git tag -a v<v> -m "VaultOTP <v>" && git push origin main --tags

gh release create v<v>   release/VaultOTP-<v>-portable.exe   release/VaultOTP-Setup-<v>.exe   release/VaultOTP-<v>.apk   release/VaultOTP-<v>-single-file.html   release/VaultOTP-<v>-web.zip   release/SHA256SUMS.txt   --title "VaultOTP <v>" --notes-file CHANGELOG.md
```

Pushing a tag also triggers `.github/workflows/release.yml`, which builds the
Windows EXE, Android APK, macOS DMG and Linux AppImage on GitHub's runners and
attaches them to the same release — handy when you do not want to build locally.

Binary artefacts are intentionally **not** committed: `.gitignore` keeps
`release/`, `dist/`, `web/`, `mobile/www/` and `*.apk` out of git.
