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

### Stacked header row auto-detection

When a CSV or Excel file is uploaded, the app automatically detects how many stacked label rows appear above the data. No manual configuration is needed.

**Detection logic:** the app scans the first column from the top. The first row whose first cell is a number or date is treated as the first data row. The row immediately above it is the column header; all rows before that are label rows.

Example — two label rows detected automatically:

```
scenario, RCP45,   RCP45,   RCP85,   RCP85      ← label row 1 (auto-detected)
gcm,      CanESM5, MIROC6,  CanESM5, MIROC6     ← label row 2 (auto-detected)
year,     run1,    run2,    run3,    run4        ← column header row
2020,     101.2,   99.8,    110.1,   108.4      ← data
```

Label values in non-first cells may be numeric (e.g. historical years) without confusing the detector — only the first cell of each row is inspected.

If auto-detection produces the wrong result, use the **Label strategy** picker in the UI to set the number of label rows explicitly.

## RiverWare RDF conversion (Python scripts)

The `scripts/` directory contains a Python 3.12+ CLI to read RiverWare `.rdf` ensemble files and convert them to CSV files ready to load into Ensemble Viewer. No third-party packages are required.

### Quick workflow

```bash
# 1. Inspect the file — list available slots and metadata
python scripts/rdf.py info path/to/model.rdf

# 2. Export a slot to wide CSV (ready to drop into the viewer)
python scripts/rdf.py convert path/to/model.rdf \
    --slot "Example Reservoir.Pool Elevation" \
    --output output.csv
```

On **Windows (PowerShell)** use a backtick for line continuation:

```powershell
python scripts/rdf.py convert path/to/model.rdf `
    --slot "Example Reservoir.Pool Elevation" `
    --output output.csv
```

### Output formats

| Format | Flag | Description | Viewer-compatible |
|---|---|---|---|
| **Wide** | *(default)* | Rows = timesteps, columns = traces. Sidecar `_labels.csv` written automatically if scalar slots exist. | Yes |
| **Stacked** | `--format stacked` | Wide format with scalar slot values as label header rows on top. Load directly — stacked rows auto-detected. | Yes |
| **Long** | `--format long` | One row per timestep per trace (`date`, `trace`, `value`). | No (analysis use) |
| **Enriched** | `--format enriched` | Long format with scalar label columns appended. | No (analysis use) |

For loading into Ensemble Viewer, use **wide** (default) or **stacked**. The stacked format embeds per-trace metadata (e.g. historical year, percent of average) as label rows that the viewer will auto-detect and expose as filter categories.

### Sidecar labels

When the default wide format is used and the RDF file contains scalar slots (one value per trace, not per timestep), a sidecar file `<stem>_labels.csv` is written automatically:

```
column,   Trace Historical Year, Historical Year Percent of Average
trace_1,  1988.0,               95.0
trace_2,  1995.0,               102.0
```

Load `output.csv` into the viewer, then attach `output_labels.csv` via the sidecar option to enable label-based filtering.

### `info` command

```bash
python scripts/rdf.py info path/to/model.rdf
```

Prints package metadata (name, owner, run count), run date ranges, and a table of all slots with type, units, and whether the slot is scalar.

### `slots` command

```bash
# All slots (one per line — useful for scripting)
python scripts/rdf.py slots path/to/model.rdf

# Series slots only (exclude scalars)
python scripts/rdf.py slots path/to/model.rdf --series-only
```

### Built-in help

```bash
python scripts/rdf.py --help
python scripts/rdf.py convert --help
```

### Known limitations

- **Scalar slots as data:** exporting a scalar slot produces one data row.
- **Table/periodic slots:** not supported — parser warns and skips them.
- **Monthly/annual timesteps:** `24:00` normalisation assumes daily steps; other timestep units may need manual date interpretation.
- **Mismatched timesteps across traces:** a warning is printed; run 1 timesteps are used for the `date` column.

See [`scripts/README.md`](scripts/README.md) for the full reference.

> Inspired by [RWDataPlyr](https://github.com/BoulderCodeHub/RWDataPlyr), an R package for working with RiverWare RDF files.

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
