# Contributing to Ensemble Viewer

Thank you for contributing. This guide covers local setup, code structure, testing, and workflow. It includes notes for contributors coming from **R** or **Python** backgrounds, since the JavaScript toolchain has a few quirks worth flagging up front.

---

## Prerequisites

Install [Node.js](https://nodejs.org/) v18 or later. This brings `npm` with it.

**If you are coming from Python or R:**

| Concept | Python equivalent | R equivalent |
|---|---|---|
| Node.js runtime | CPython interpreter | R interpreter |
| `npm` (package manager) | `pip` / `conda` | `install.packages` / `renv` |
| `package.json` | `requirements.txt` / `pyproject.toml` | `renv.lock` / `DESCRIPTION` |
| `node_modules/` | `.venv/` / `site-packages/` | `renv/library/` |
| `npm run dev` | `flask run` / `uvicorn main:app` | `shiny::runApp()` |

---

## Local setup

```bash
git clone https://github.com/your-org/ensemble-viewer.git
cd ensemble-viewer
npm install        # downloads dependencies into node_modules/
npm run dev        # starts the dev server at http://localhost:5173
```

`node_modules/` is local to your machine and is git-ignored — similar to a Python virtual environment. Never commit it.

---

## Running tests

```bash
npm run test          # run all tests once and exit
npm run test:watch    # re-run tests automatically when you save a file
```

Tests live alongside the source files they cover:

```
src/lib/
  parseCsv.js         ← implementation
  parseCsv.test.js    ← tests for that file
  labels.js
  labels.test.js
  stats.js
  stats.test.js
  palette.js
  palette.test.js
```

The test runner is [Vitest](https://vitest.dev/), which uses the same syntax as Jest. Tests are plain functions — no DOM required — so they run in a Node environment and are fast.

**Python analogy:** Vitest is roughly equivalent to `pytest`. Each `test('description', () => { ... })` block is like a `def test_...` function.

**R analogy:** Vitest is similar to `testthat`. Each `expect(actual).toBe(expected)` is like `expect_equal(actual, expected)`.

---

## Project structure

```
ensemble-viewer/
├── src/
│   ├── App.jsx                     top-level state and layout
│   ├── main.jsx                    React entry point
│   ├── index.css                   Tailwind directives
│   ├── components/
│   │   ├── EnsemblePlot.jsx        Plotly chart component
│   │   ├── FileDropzone.jsx        file upload and sample loader
│   │   ├── LabelControls.jsx       filter/colour/band UI
│   │   └── LabelStrategyPicker.jsx label strategy selector
│   └── lib/                        pure functions — no React, easy to test
│       ├── parseCsv.js             CSV parsing (PapaParse wrapper)
│       ├── parseXlsx.js            Excel parsing (SheetJS wrapper)
│       ├── labels.js               label parsing (three strategies)
│       ├── stats.js                percentile/mean/median computation
│       ├── palette.js              Okabe-Ito colour mapping
│       └── sampleData.js          demo dataset loader
├── public/                         static assets (copied as-is to dist/)
├── index.html                      HTML entry point
├── package.json                    dependencies and scripts
├── vite.config.js                  build and test configuration
└── tailwind.config.js              custom design tokens
```

**Key distinction:** `src/lib/` contains pure data-processing functions with no React dependency. If you want to add a statistical transform, a new parsing strategy, or a colour utility, this is the right place — and it is straightforward to test in isolation.

---

## Making changes

### Adding a new library function

1. Create or edit a file in `src/lib/`.
2. Write a matching `*.test.js` file with at least a happy-path and one edge-case test.
3. Run `npm run test` to confirm everything passes.

### Modifying a React component

1. Edit the file in `src/components/` or `src/App.jsx`.
2. The dev server (`npm run dev`) hot-reloads on save — check the browser.
3. There are no component-level tests yet; manual verification in the browser is the current approach.

### Styling

The project uses [Tailwind CSS](https://tailwindcss.com/) utility classes directly in JSX. Custom colours and fonts are defined in `tailwind.config.js`. Avoid writing raw CSS in `index.css` unless you have a good reason.

---

## Submitting a pull request

1. Fork the repository and create a branch from `main`.
2. Make your changes — keep commits focused and descriptive.
3. Run `npm run test` and ensure all tests pass.
4. Open a pull request with a clear description of what changed and why.

There is no formal review process yet — open a PR and tag the relevant team member.

---

## A note on JavaScript for Python/R contributors

JavaScript has a few behaviours that surprise people coming from scientific computing languages:

- **`[].every(fn)` returns `true`** — an empty array vacuously satisfies any predicate. The parsers in `src/lib/` have explicit length guards to avoid this trap.
- **`NaN !== NaN`** — the only value in JS not equal to itself. Use `Number.isNaN(x)` rather than `x === NaN`.
- **`null` and `undefined` are different** — `null` means "intentionally absent"; `undefined` means "not set". Both are falsy.
- **Array indexing is 0-based** — same as Python, unlike R's 1-based indexing.
- **`const` does not mean immutable** — `const arr = []` lets you push to the array; it only prevents reassigning the variable.

The library files (`src/lib/*.js`) have inline comments calling out JS-specific gotchas for non-JavaScript maintainers.
