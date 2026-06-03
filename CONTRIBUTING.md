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
git clone https://github.com/jrkasprzyk/ensemble-viewer.git
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
  config.js
  config.test.js
  csvExport.js
  csvExport.test.js
  plotStyle.js
  plotStyle.test.js
  rdfParser.js
  rdfParser.test.js
  slotLabels.js
  slotLabels.test.js
src/components/
  EnsemblePlot.jsx
  EnsemblePlot.test.js
  EnsemblePlot.download.test.jsx
  FileDropzone.jsx
  FileDropzone.test.jsx
```

The test runner is [Vitest](https://vitest.dev/), which uses the same syntax as Jest. The default environment is Node — the `src/lib/` tests are pure functions with no DOM, so they run fast. Component tests under `src/components/` opt into a browser-like DOM (jsdom) per file with a `// @vitest-environment jsdom` pragma on the first line, and use [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/).

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
│   │   ├── LabelStrategyPicker.jsx label strategy selector
│   │   └── ConfigControls.jsx      save/load XML config UI
│   └── lib/                        pure functions — no React, easy to test
│       ├── parseCsv.js             CSV parsing (PapaParse wrapper)
│       ├── parseXlsx.js            Excel parsing (SheetJS wrapper)
│       ├── rdfParser.js            RiverWare RDF parsing (in-browser)
│       ├── labels.js               label parsing (three strategies)
│       ├── slotLabels.js           RDF scalar-slot → label derivation
│       ├── stats.js                percentile/mean/median computation
│       ├── plotStyle.js            density-aware line width/opacity
│       ├── palette.js              Okabe-Ito colour mapping
│       ├── csvExport.js            export current data back to CSV
│       ├── config.js               XML config save/load (versioned)
│       └── sampleData.js           demo dataset loader
├── scripts/                        Python 3.12+ CLI for RiverWare RDF → CSV
│   ├── rdf.py                      CLI entry point (info/slots/convert)
│   ├── rdf_parser.py               RDF parser (no third-party deps)
│   ├── test_rdf_parser.py          parser tests
│   └── README.md                   full CLI reference
├── docs/
│   └── config-schema.md            XML config format reference
├── public/                         static assets and sample datasets
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
3. Some components have tests (e.g. `FileDropzone.test.jsx`, `EnsemblePlot.test.js`) using @testing-library/react under jsdom. Add or update them where practical; the browser is still the primary check for visual/interaction changes.

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

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
