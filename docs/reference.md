# Reference

Technical descriptions of the data formats, commands, and stack. For task-oriented instructions, see the [how-to guides](how-to.md).

## Data format

Ensemble Viewer expects a **wide** timeseries table:

- **First column** — a time or index column (numeric or date-like values). Used as the x-axis.
- **Remaining columns** — one column per ensemble member / trace. Each is plotted as a line.

Accepted file types:

| Type | Extensions | Behaviour on load |
|---|---|---|
| Tabular | `.csv`, `.tsv`, `.xlsx`, `.xls` | The file *is* the wide table; plotted immediately |
| RiverWare RDF | `.rdf` | A container of slots; you select a series slot, which the viewer converts into a wide table (see [RDF support](#riverware-rdf-support)) |

### Labelling strategies

Labels (scenario, model, run ID, classification, etc.) attach to columns one of three ways:

| Strategy | How it works |
|---|---|
| **Stacked header rows** | Extra rows above the data, one per label category (e.g. `RCP`, `Model`, `Run`) |
| **Column name delimiters** | Labels encoded in the column name, e.g. `RCP85_CanESM5_run1`, split on a delimiter |
| **Sidecar CSV** | A separate file mapping column names to labels |

### Stacked header row auto-detection

When a CSV or Excel file is uploaded, the app detects how many stacked label rows sit above the data automatically.

**Rule:** the app scans the first column from the top. The first row whose first cell is a number or date is treated as the first data row. The row immediately above it is the column header; every row before that is a label row.

Example — two label rows detected automatically:

```
scenario, RCP45,   RCP45,   RCP85,   RCP85      ← label row 1 (auto-detected)
gcm,      CanESM5, MIROC6,  CanESM5, MIROC6     ← label row 2 (auto-detected)
year,     run1,    run2,    run3,    run4        ← column header row
2020,     101.2,   99.8,    110.1,   108.4      ← data
```

Only the first cell of each row is inspected, so numeric label values in other cells (e.g. historical years) do not confuse the detector. If detection is wrong, set the label row count explicitly in the **label strategy** picker.

### Sidecar labels

A sidecar CSV maps each data column name to one or more label categories. The first column holds the data column names; each remaining column is a label category:

```
column,   Trace Historical Year, Historical Year Percent of Average
trace_1,  1988.0,                95.0
trace_2,  1995.0,                102.0
```

### Classification bundle

A classification bundle is a set of plain-text (`.txt`) files. Each file is one classification scheme and assigns a class to traces by trace number. Each file has exactly two CSV-style columns:

| Column | Description |
|---|---|
| `TraceNumber` | Integer trace number, matched against the numeric suffix of each data column |
| `Class` | Class value for that trace under this scheme |

Scheme names are derived from the filenames by stripping the longest common prefix and suffix across all selected files. The resulting schemes appear in the label controls like any other label strategy, and selected schemes can be combined with AND/OR logic into a single pass/fail filter.

## RiverWare RDF support

RiverWare `.rdf` ensemble files can be opened directly in the browser:

- Only **series slots** (one value per timestep per trace) are selectable for plotting. **Scalar slots** (one value per trace) are surfaced as labels, not as plottable data.
- After selecting a slot, the dataset can be downloaded as **wide** or **stacked** CSV from the drop zone.

For offline, scriptable, or batch conversion, the `scripts/` directory contains a Python 3.12+ CLI (stdlib only). See **[scripts/README.md](../scripts/README.md)** for the full command reference (`info`, `slots`, `convert`, and the wide/stacked/long/enriched output formats).

## npm commands

These commands apply only when running the viewer from source. The deployed app at <https://ensemble-viewer.vercel.app/> requires none of them.

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server (port 5173) |
| `npm run build` | Build optimised static files into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode (re-runs on file save) |

## Configuration presets

The control panel can be exported to and restored from a versioned XML file (`ensemble-viewer-config.xml`). Loading restores controls only — it never re-parses data. The format is documented in **[config-schema.md](config-schema.md)**.

## Tech stack

| Layer | Technology |
|---|---|
| UI framework | React 18 |
| Plotting | Plotly.js (WebGL) via `react-plotly.js` |
| Colour | chroma-js |
| Styling | Tailwind CSS |
| CSV parsing | PapaParse |
| Excel parsing | SheetJS (XLSX) |
| Build tool | Vite |
| Tests | Vitest |
