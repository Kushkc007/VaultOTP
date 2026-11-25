# Third-party notices

## jsQR (`vendor/jsQR.js`)

- Upstream: https://github.com/cozmo/jsQR
- Version: 1.4.0 (webpack UMD bundle, unmodified)
- Licence: Apache License 2.0

```
Copyright 2016 Cosmo Wolfe

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## Fonts (`src/fonts/`)

| File | Family | Licence |
|---|---|---|
| `plus-jakarta-sans-latin.woff2` | Plus Jakarta Sans (variable, latin subset) | SIL Open Font License 1.1 |
| `jetbrains-mono-latin.woff2` | JetBrains Mono (variable, latin subset) | SIL Open Font License 1.1 |

Both are subsetted latin variable-font files fetched from Google Fonts’ CDN at build time and stored locally; they are redistributed under the SIL OFL 1.1, which permits bundling inside applications.

## Runtime and tooling

| Package | Licence |
|---|---|
| Electron | MIT |
| Capacitor (`@capacitor/*`) | MIT |
| electron-builder | MIT |
| @resvg/resvg-js | MPL-2.0 |

None of these are shipped inside the web build; they are packaging tooling only.
