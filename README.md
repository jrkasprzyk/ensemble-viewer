# Ensemble Viewer

A browser-based tool for visualising large ensemble timeseries datasets. Drop in a wide CSV or Excel file, explore hundreds of runs at once, filter by label, and overlay percentile bands — all without installing any software beyond a modern web browser.

## Features

- **Drag-and-drop upload** — CSV and XLSX files
- **Flexible labelling** — stacked header rows, delimiter-separated column names, or a sidecar label CSV
- **High-performance rendering** — Plotly WebGL (`scattergl`) handles 500+ columns × thousands of timesteps smoothly
- **Interactive filtering** — category-based trace filtering and colour grouping
- **Summary statistics** — 10th/90th percentile band with mean/median per group
- **Colourblind-safe** — Okabe-Ito palette used throughout
- **Built-in demo** — load sample data with one click, no file needed

## Quick start

You need [Node.js](https://nodejs.org/) (v18 or later). If you are coming from Python, think of Node as your Python interpreter and `npm` as `pip`.

```bash
# clone the repo
git clone https://github.com/your-org/ensemble-viewer.git
cd ensemble-viewer

# install dependencies (like `pip install -r requirements.txt`)
npm install

# start the development server — opens http://localhost:5173 automatically
npm run dev
```

The page hot-reloads on every file save, so there is no need to restart the server while you are working.

## Data format

Ensemble Viewer expects a **wide** timeseries table:

- **First column** — a time or index column (numeric or date-like values)
- **Remaining columns** — one column per ensemble member / run

The app supports three ways to attach labels (scenario, model, run ID, etc.) to columns:

| Strategy | How it works |
|---|---|
| **Stacked header rows** | Extra rows above the data, one per label category (e.g. `RCP`, `Model`, `Run`) |
| **Column name delimiters** | Labels encoded in the column name, e.g. `RCP85_CanESM5_run1` |
| **Sidecar CSV** | A separate file mapping column names to labels |

A **sample dataset** is included — click *Load sample data* on the drop-zone to see the app in action.

## Available commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server (port 5173) |
| `npm run build` | Build optimised static files into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode (re-runs on file save) |

## Tech stack

| Layer | Technology |
|---|---|
| UI framework | React 18 |
| Plotting | Plotly.js (WebGL) |
| Styling | Tailwind CSS |
| CSV parsing | PapaParse |
| Excel parsing | SheetJS (XLSX) |
| Build tool | Vite |
| Tests | Vitest |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code structure, and how to run tests — including notes for contributors coming from R or Python backgrounds.

## Licence

[MIT](LICENSE)
