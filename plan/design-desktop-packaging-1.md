---
goal: Scope turning Ensemble Viewer (static web app) into an offline, installable Windows program
version: 1.0
date_created: 2026-06-02
last_updated: 2026-06-02
owner: Joseph Kasprzyk
status: 'Planned'
tags: ['architecture', 'design', 'packaging', 'desktop', 'distribution']
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

The v0.2.0 plan (`plan/release-v0.2.0.md`) ships Ensemble Viewer as a **downloadable static
bundle** that the user serves with a tiny local web server. A real-world need has surfaced that
the static bundle does not meet: a target user at a **government agency** appears to have **Vercel
blocked behind a firewall**, and may **not be able (or permitted) to run a server command** (`npx
serve`, `python -m http.server`). They need something they can **download once through the firewall
and double-click** — an installable, offline program.

This document **scopes** what it would take to turn the Vite/React static app into an offline
Windows program. It deliberately does **not** pick a single winner: it compares the three viable
routes — **Tauri**, **Electron**, and a **single-file HTML** build — and lays out the shared
prerequisite work, the per-route toolchain/CI, the trade-offs, and the risks specific to a
locked-down government environment. It is a decision aid, not a committed build plan.

This is **additive to** and does **not replace** `plan/release-v0.2.0.md`. The static bundle + CI
release remains the web-distribution path; the executable is a parallel artifact for firewalled,
no-server users.

## 1. Requirements & Constraints

- **REQ-001**: Output must run **fully offline** — no CDN, no network, no Vercel. The firewall blocks outbound.
- **REQ-002**: Primary user launches it by **double-clicking** — no terminal, no server command, no Node install.
- **REQ-003**: Target OS is **Windows only** (confirmed). macOS/Linux explicitly out of scope for now.
- **REQ-004**: Ship **both** a **portable** (no-admin, double-click) artifact **and** an **installer** (.msi/NSIS), per environment policy.
- **REQ-005**: Must preserve current functionality: CSV/XLSX upload (File API), Plotly WebGL plotting, filtering/coloring, classification bundles, config save/load.
- **REQ-006**: Distributable must be **downloadable as a single file** (or small set) through the firewall — size matters for the firewalled download.
- **CON-001**: **`fetch()` of bundled assets fails under raw `file://`.** The Examples feature does `fetch('/examples.json')` and pulls ~100 bundled CSVs from `public/` (`src/lib/sampleData.js`, `src/components/FileDropzone.jsx`). It needs an http-like origin (Tauri/Electron) or must be reworked (single-file).
- **CON-002**: **`index.html` loads Google Fonts from a CDN** (`fonts.googleapis.com`, `fonts.gstatic.com`). This is the only remaining external dependency and **fails offline** — must be self-hosted or dropped in **all** routes.
- **CON-003**: Government machines may **block software installs (no admin rights)** → portable artifact is the safer primary; installer may be unusable.
- **CON-004**: **Unsigned executables** trigger Windows SmartScreen / may be **quarantined by agency antivirus**. Code signing is likely needed for real-world adoption but requires a paid cert.
- **CON-005**: **Tauri uses the system WebView2 runtime.** Present by default on Windows 11 but may be **absent or blocked from auto-download** on locked-down machines → must bundle a fixed WebView2 runtime (larger output).
- **CON-006**: Maintainer is **solo, Python/JS-novice**; toolchain complexity (e.g. adding Rust) is a real cost.
- **GUD-001**: Reuse the existing v0.2.0 CI release pipeline pattern (tag `v*` → build → attach to GitHub Release) rather than inventing a new one.
- **GUD-002**: Reuse the **already-present but unused** inlined sample CSV in `src/lib/sampleData.js` (`getSampleFile()`) for any route that can't fetch bundled examples.
- **PAT-001**: App is a **single page, no client-side router** — no deep-link/base-path hazards beyond asset resolution.

## 2. Implementation Steps

### Implementation Phase 1 — Shared prerequisites (required by every route)

- GOAL-001: Make the built frontend fully offline and origin-agnostic so any of the three packaging routes can consume it.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Set `base: './'` in `vite.config.js` (relative asset paths) — same change as the v0.2.0 plan; prerequisite here too. | | |
| TASK-002 | Remove the Google Fonts CDN `<link>`s from `index.html` (`CON-002`). Either self-host the woff2 files under `public/fonts/` with local `@font-face` rules, or drop to a system font stack (`-apple-system, Segoe UI, Roboto, sans-serif`). Verify no other CDN refs remain. | | |
| TASK-003 | Decide & wire the **Examples handling per route** (`CON-001`): for Tauri/Electron the existing fetch-based Examples work unchanged (served from app origin); for single-file, wire "Load sample data" to the inlined `getSampleFile()` in `src/lib/sampleData.js` and hide the Examples dropdown via a build flag (e.g. `import.meta.env.VITE_SINGLEFILE`). | | |
| TASK-004 | Add a Windows app icon asset (`.ico`, 256×256 multi-res) under an `assets/` or `build/` dir for use by Tauri/Electron bundlers. Derive from existing `public/favicon.svg`. | | |
| TASK-005 | Confirm `npm run build` still produces a working `dist/` after TASK-001–003 (served via local server) before adding any wrapper. | | |

### Implementation Phase 2 — Route A: Tauri (smallest binary, system WebView2)

- GOAL-002: Scope a Tauri wrapper producing a Windows .msi + NSIS installer + portable exe, with WebView2 bundled for offline machines.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | New tools: install **Rust toolchain** (`rustup`), add dev deps `@tauri-apps/cli`, `@tauri-apps/api`. `npx tauri init` scaffolds `src-tauri/` (`Cargo.toml`, `tauri.conf.json`, `src/main.rs`, `build.rs`, `icons/`). | | |
| TASK-007 | Configure `src-tauri/tauri.conf.json`: `build.beforeBuildCommand = "npm run build"`, `build.frontendDist = "../dist"`, `productName`, `identifier`, window size. The Tauri asset protocol serves `frontendDist` from an http-like origin → existing `fetch('/examples.json')` and bundled `public/` data resolve with **no app-code change** (`CON-001` satisfied for free). | | |
| TASK-008 | Bundle targets: `bundle.targets = ["msi","nsis"]` (installer, `REQ-004`). Portable exe = the built `target/release/<app>.exe` with embedded resources. | | |
| TASK-009 | Offline WebView2 (`CON-005`): set Windows `webviewInstallMode` to `fixedRuntime` (or `offlineInstaller`) to embed the WebView2 binaries so the app launches on machines that lack it / can't auto-download. Accept the larger output (~120MB) for this build. | | |
| TASK-010 | (Optional) Code signing (`CON-004`): wire a signing cert via Tauri's Windows signing config. Document as a follow-up needing a purchased cert. | | |
| TASK-011 | Output profile to record: ~3–10MB (shared WebView2) or ~120MB (fixed runtime). Pros: tiny, native feel, fetch works free. Cons: Rust toolchain (`CON-006`), WebView2 dependency, signing. | | |

### Implementation Phase 3 — Route B: Electron (self-contained, no runtime dependency)

- GOAL-003: Scope an Electron wrapper producing a portable exe + NSIS installer, fully self-contained (Chromium bundled), staying in the Node toolchain.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | New tools (Node-only, no Rust): dev deps `electron`, `electron-builder`. Add `electron/main.js` (main process), `electron/preload.js`. | | |
| TASK-013 | In `electron/main.js`, resolve the absolute-path fetches (`CON-001`): register a privileged custom scheme (e.g. `app://`) via `protocol.handle` mapping the **dist root** so `/examples.json` and `/sample-data/*` resolve; load the window from `app://index.html`. (Alternative: spin a `127.0.0.1` static server on a random port and `loadURL` it — simpler conceptually, heavier.) | | |
| TASK-014 | Configure `electron-builder` (in `package.json` `build` key or `electron-builder.yml`): Windows targets `["portable","nsis"]` (`REQ-004`), `directories.output`, icon from TASK-004, `files` globbing `dist/` + `electron/`. | | |
| TASK-015 | Harden: `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false` (app needs no Node APIs — pure File API). Confirm CSP has no CDN allowances after TASK-002. | | |
| TASK-016 | (Optional) Code signing (`CON-004`) via electron-builder `win.certificateFile`. Document as follow-up needing a cert. | | |
| TASK-017 | Output profile to record: ~150–250MB per artifact. Pros: no runtime dependency (safest on unknown gov machines), Node-only toolchain. Cons: large download (`REQ-006` tension), custom protocol/server glue needed. | | |

### Implementation Phase 4 — Route C: Single-file HTML (lightest distribution, no install)

- GOAL-004: Scope a one-file `.html` build that runs from `file://` by double-click, emailable through the firewall, at the cost of the full Examples library.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | New tool: dev dep `vite-plugin-singlefile`. Add a separate Vite config / mode that enables it (inlines all JS/CSS/assets into one `index.html`, converts the module script to inline classic → runs under `file://`). | | |
| TASK-019 | Activate the single-file Examples fallback from TASK-003: build with `VITE_SINGLEFILE` so "Load sample data" uses inlined `getSampleFile()` and the fetch-based Examples dropdown is hidden (`CON-001` — cannot inline ~100 CSVs). | | |
| TASK-020 | Ensure fonts are inlined or system-stack (TASK-002) so the single file is truly self-contained — verify zero network requests in DevTools when opened from disk. | | |
| TASK-021 | Output profile to record: one ~5–8MB `.html` (Plotly dominates). Pros: zero install, no admin, no server, single emailable file — best firewall fit. Cons: NOT a portable/installer artifact (`REQ-004` N/A here), loses the bundled Examples library, no app icon/desktop presence. | | |

### Implementation Phase 5 — CI integration & distribution

- GOAL-005: Extend the v0.2.0 tag-triggered release pipeline to build and attach the chosen executable artifact(s) on a Windows runner.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-022 | Add a Windows job to `.github/workflows/release.yml` (runs on `windows-latest`) for the selected route(s). Tauri: use `tauri-apps/tauri-action`. Electron: `npm run build` + `electron-builder --win --publish never`. Single-file: `vite build` with the single-file mode, attach the `.html`. | | |
| TASK-023 | Attach the produced artifacts (.msi / NSIS .exe / portable .exe / .html) to the same GitHub Release via `softprops/action-gh-release@v2` (reuse v0.2.0 pattern, `GUD-001`). | | |
| TASK-024 | Add a README "Desktop / offline app" section: which artifact to download for which situation (portable vs installer vs single-file), the offline/firewall note, and the SmartScreen/AV caveat (`CON-004`). | | |

## 3. Alternatives

- **ALT-001**: **Progressive Web App (PWA) + service worker offline cache.** Rejected — still requires first-load over the network (blocked) and a server origin; doesn't solve the firewall/no-server problem.
- **ALT-002**: **Neutralino.js / Wails / Photino** (other lightweight native-webview shells). Viable but less mainstream/less documented than Tauri or Electron; higher maintenance risk for a solo maintainer. Tauri is the representative of this category.
- **ALT-003**: **PyInstaller-wrapped Python static server + browser launcher.** Familiar to the Python-background maintainer, but produces a console/process the user must keep running, and AV flags PyInstaller bundles heavily. Worse UX than a real webview app.
- **ALT-004**: **Pin the existing static bundle behind a one-click `.bat` that runs a bundled static server.** Cheapest, but a `.bat` spawning a server is exactly the "run a server command" friction `REQ-002` rules out, and gov AV may block scripts.
- **ALT-005**: **Tauri sidecar with embedded data instead of fetch.** Could refactor Examples to load via Tauri IPC commands; unnecessary because Tauri's asset origin already makes the existing fetch work.

## 4. Dependencies

- **DEP-001**: **Tauri route** — Rust toolchain (`rustup`, `cargo`), `@tauri-apps/cli`, `@tauri-apps/api`; WebView2 runtime (bundled). Windows CI runner.
- **DEP-002**: **Electron route** — `electron`, `electron-builder` (Node dev deps). Windows CI runner.
- **DEP-003**: **Single-file route** — `vite-plugin-singlefile` (Node dev dep). No runner beyond existing.
- **DEP-004**: **Shared** — `base: './'` from `plan/release-v0.2.0.md`; self-hosted font files (or system-font decision); a `.ico` app icon.
- **DEP-005**: **Code signing (all native routes, optional but recommended)** — a purchased Windows code-signing certificate (`CON-004`).
- **DEP-006**: The Vitest suite as the pre-build gate (reuse v0.2.0 `npm test` step).

## 5. Files

- **FILE-001**: `vite.config.js` — add `base: './'`; add a single-file build mode/flag (`vite-plugin-singlefile`).
- **FILE-002**: `index.html` — remove Google Fonts CDN links; reference self-hosted fonts or system stack.
- **FILE-003**: `src/lib/sampleData.js` — wire the existing unused `getSampleFile()` as the inlined demo for the single-file build.
- **FILE-004**: `src/components/FileDropzone.jsx` — gate the fetch-based Examples dropdown behind the single-file build flag.
- **FILE-005**: `src-tauri/` (Tauri route) — `tauri.conf.json`, `Cargo.toml`, `src/main.rs`, `build.rs`, `icons/`.
- **FILE-006**: `electron/main.js`, `electron/preload.js` (Electron route) — main process, custom protocol/server, window config.
- **FILE-007**: `package.json` — new dev deps per route; `electron-builder` `build` config; scripts (`tauri`, `electron:build`, `build:singlefile`).
- **FILE-008**: `.github/workflows/release.yml` — add a `windows-latest` job to build + attach the executable artifact(s).
- **FILE-009**: `assets/icon.ico` (or `build/`) — Windows app icon derived from `public/favicon.svg`.
- **FILE-010**: `README.md` — new "Desktop / offline app" section.
- **FILE-011**: `public/fonts/` (if self-hosting) — woff2 font files + `@font-face` CSS.

## 6. Testing

- **TEST-001**: **Offline smoke (all routes)** — disconnect network / block in firewall sim; launch the artifact; confirm zero failed network requests in DevTools and the app fully loads.
- **TEST-002**: **Functionality parity** — upload a wide CSV and an XLSX; confirm Plotly renders, filtering/coloring work, classification bundle attaches, config save/load round-trips.
- **TEST-003**: **Examples behavior** — Tauri/Electron: Examples dropdown populates and loads bundled data. Single-file: "Load sample data" loads the inlined demo and the dropdown is absent.
- **TEST-004**: **WebView2-absent machine (Tauri)** — test the fixed-runtime build on a Windows VM with WebView2 removed; confirm it still launches (`CON-005`).
- **TEST-005**: **No-admin portable launch** — run the portable exe as a standard (non-admin) user; confirm it runs without elevation (`CON-003`).
- **TEST-006**: **Installer round-trip** — run the .msi/NSIS installer, confirm Start Menu entry + clean uninstall.
- **TEST-007**: **Single-file double-click** — open the `.html` directly from disk (no server); confirm it runs and reads an uploaded file.
- **TEST-008**: **AV/SmartScreen observation** — note SmartScreen prompt behavior for the unsigned artifact to gauge the signing need (`CON-004`).
- **TEST-009**: **CI artifact** — download the artifact from a test pre-release tag (e.g. `v0.3.0-rc.1`) and run TEST-001/002 on it end-to-end.

## 7. Risks & Assumptions

- **RISK-001**: **WebView2 missing/blocked** on locked-down machines breaks Tauri unless the runtime is bundled — mitigated by TASK-009, at a size cost.
- **RISK-002**: **Unsigned exe quarantined by agency AV / SmartScreen** could block adoption regardless of route (`CON-004`). Signing needs a paid cert.
- **RISK-003**: **Electron size (~150–250MB)** may itself be painful to pull through a slow/restricted firewall (`REQ-006`).
- **RISK-004**: **Rust toolchain adds maintenance burden** for a solo Python/JS-novice maintainer (`CON-006`) — Tauri's long-term upkeep cost is higher than Electron/single-file.
- **RISK-005**: **Single-file loses the full Examples library** and produces a `.html`, not a true "program" — may not match the user's mental model of "installable."
- **RISK-006**: **Custom protocol glue (Electron)** is the most error-prone app-code change; getting absolute `/` fetch paths to resolve needs care.
- **ASSUMPTION-001**: WebView2 is present on the specific user's Windows 11 machine (true by default), but **not assumed** for the broader agency fleet.
- **ASSUMPTION-002**: The firewall blocks outbound network but does **not** block running locally-downloaded executables outright (only installs may need admin).
- **ASSUMPTION-003**: No native OS integration (file associations, auto-update) is required for v1 of the desktop app — would be added later.
- **ASSUMPTION-004**: This work is **sequenced after** the v0.2.0 static release, reusing its CI and `base: './'` change.

## 8. Related Specifications / Further Reading

- `plan/release-v0.2.0.md` — the static-bundle release this extends.
- Tauri v2 docs — https://v2.tauri.app/ (bundling, WebView2 fixed runtime, Windows installer).
- electron-builder — https://www.electron.build/ (Windows `portable` + `nsis` targets, signing).
- vite-plugin-singlefile — https://github.com/richardtallent/vite-plugin-singlefile.
- WebView2 distribution modes — https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution.
- `softprops/action-gh-release` — https://github.com/softprops/action-gh-release (reused for artifact attach).

---

### Recommendation note (for the firewalled gov user)

Given **no admin rights likely**, **firewall**, **non-technical launcher**, and a **solo maintainer**:

1. **Single-file HTML** is the **lowest-friction distribution** — one emailable file, no install, no server, no admin. Best first thing to put in their hands. Cost: loses the bundled Examples library (inlined demo still works).
2. **Tauri (fixed-WebView2) portable exe** is the best "real program" if they want a desktop app — tiny-to-mid size, fetch/Examples work unchanged. Cost: adds Rust to the toolchain.
3. **Electron portable** is the **safest-to-launch** on an unknown fleet (nothing to be missing), at a heavy download size and Node-only toolchain.

A reasonable path: **ship single-file first** (cheap, immediate), then add **one native route** (Tauri if size matters, Electron if guaranteed-launch matters) once the user confirms the single-file meets the real-world constraint.
