# Release plan — Ensemble Viewer v0.2.0

## Context

The app is deployed on Vercel but has **never been formally released**: no git tags,
no GitHub Releases, and the `0.1.0` entry in `CHANGELOG.md` (dated 2026-04-22) was never
tagged. Meaningful features have accumulated under `[Unreleased]` (filter/coloring
persistence, classification bundles, config save/load, density styling, tests).

Goal: cut a real **v0.2.0** release, ship a **downloadable static bundle** as the
release artifact, and stand up a **GitHub Actions pipeline** that builds + publishes
the bundle automatically whenever a version tag is pushed — so every future release is
`git tag … && git push --tags`.

### Key constraint: this is a static web app, not a native program
A Vite/React build is a folder of static files (`dist/`), not a `.exe`. Two facts shape
the artifact design:
- **`file://` won't run it.** Browsers refuse to load ES-module `<script type="module">`
  over `file://` (CORS). So a user can't just double-click `index.html`; the bundle must
  be served by a tiny static server.
- **Default `base: '/'` uses absolute paths**, which only work when served from a domain
  root. Switching to **`base: './'`** makes asset URLs relative, so the same build works
  on Vercel *and* from any local server / subfolder. This app is a single page with no
  client-side router, so relative base is safe everywhere.

The release `.zip` therefore contains the built site plus a one-page "how to run" note
pointing at `npx serve` / `python -m http.server` / VS Code Live Server.

## Changes

### 1. `vite.config.js` — relative base for portability
Add `base: './'` to the config so the built bundle works both on Vercel and when served
locally from the zip. Verify Vercel still serves correctly after this (it will —
relative paths resolve to the same files at the domain root).

### 2. `package.json` — bump version
`"version": "0.1.0"` → `"0.2.0"`. Keep it in lockstep with the git tag (`v0.2.0`).

### 3. `CHANGELOG.md` — promote Unreleased → 0.2.0
- Rename the `## [Unreleased]` heading content to `## [0.2.0] — 2026-06-02`.
- Add a fresh empty `## [Unreleased]` stub above it (Added/Fixed placeholders).
- Update the link refs at the bottom:
  - `[Unreleased]: …/compare/v0.2.0...HEAD`
  - `[0.2.0]: …/compare/v0.1.0...v0.2.0`
  - keep existing `[0.1.0]` line.
- Sanity-pass the entries so the 0.2.0 list reflects what actually shipped (the
  persistence/classification/config features, not just the doc/test items currently
  listed under Unreleased).

### 4. New file: `.github/workflows/release.yml` — CI release pipeline
Trigger: `push` of tags matching `v*`. Single Ubuntu job:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: 20`, `cache: npm`
3. `npm ci`
4. `npm test` *(gate the release on the existing Vitest suite — fail = no release)*
5. `npm run build` → produces `dist/`
6. Stage the bundle: copy a `RUNNING.txt` (see below) into `dist/`, then
   `zip -r ensemble-viewer-${GITHUB_REF_NAME}.zip dist`
7. Extract the matching section from `CHANGELOG.md` for the release body
   (awk/sed between `## [0.2.0]` and the next `## [`).
8. Publish with **`softprops/action-gh-release@v2`**: attach the `.zip`, set
   `body` to the extracted notes, `name` to the tag. Needs `permissions: contents: write`.

### 5. New file: `RUNNING.txt` (shipped inside the zip) — bundle usage note
Short text: "This is a static web app. Serve this folder with any static server, e.g.
`npx serve` or `python -m http.server 8000`, then open the printed localhost URL. Opening
index.html directly from disk will not work." Either commit it at repo root and have CI
copy it into `dist/`, or `printf` it inline in the workflow step. (Committing it is
cleaner and testable.)

### 6. `README.md` — add a "Releases" section
Brief: where to find releases (GitHub Releases page), what the `.zip` contains, how to
run the bundle locally, and the maintainer cut-a-release steps (bump version, update
CHANGELOG, commit, `git tag vX.Y.Z`, `git push --tags`).

## Execution order (one-time, this release)
1. Edit `vite.config.js`, `package.json`, `CHANGELOG.md`, add `RUNNING.txt`,
   `.github/workflows/release.yml`, README section. Commit on the current branch / PR.
2. Merge to `main`.
3. `npm test && npm run build` locally to confirm green + bundle builds.
4. `git tag v0.2.0 && git push origin v0.2.0`.
5. Watch the Actions run; confirm the Release appears with the `.zip` attached.

After this, future releases are just steps 1–4 of the *maintainer* flow + `git push --tags`.

## Verification
- **Local build sanity:** `npm test` passes; `npm run build` succeeds; inspect `dist/`
  has relative asset paths (`./assets/...`) in `index.html`.
- **Bundle runs:** from `dist/`, run `npx serve` (or `python -m http.server`), open the
  URL, confirm the app loads, demo data works, plotting/filtering work — i.e. relative
  base didn't break asset loading.
- **Vercel unaffected:** confirm the Vercel deployment still loads after the `base: './'`
  change (preview deploy on the PR).
- **CI dry-run option:** can validate the workflow on a throwaway pre-release tag
  (e.g. `v0.2.0-rc.1`) before the real `v0.2.0`, to confirm the zip + release notes
  extraction work end-to-end without committing to the final tag.
- **Release artifact:** download the published `.zip` from the GitHub Release, unzip,
  serve locally, confirm it runs and `RUNNING.txt` is present.

## Notes / decisions
- Artifact = static bundle zip (chosen). A real `.exe` would require a Tauri/Electron
  wrapper (new toolchain) — explicitly out of scope.
- Pipeline = full automation on tag push (chosen) via `softprops/action-gh-release@v2`.
- Version = `0.2.0`, staying pre-1.0 (UX may still change).
- The Python `scripts/rdf.py` CLI is separate and not part of this web-app release.
