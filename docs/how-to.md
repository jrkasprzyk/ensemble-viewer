# How-to guides

Each section below is a self-contained recipe for one task. They assume the app is already running (`npm run dev`, then <http://localhost:5173>). For a guided introduction, start with the [tutorial](tutorial.md); for exact format specifications, see the [reference](reference.md).

## Load a wide CSV or Excel file

1. Drag the file onto the page, or click **Browse** in the drop zone and select it.
2. The viewer parses the file and plots the first column as the x-axis (index) and every remaining column as a trace.

Stacked label rows above the data are detected automatically. If the detection is wrong, use the **label strategy** picker to set the number of label rows explicitly, then re-parse. See [Reference → Data format](reference.md#data-format) for what counts as a valid file.

## Load a RiverWare RDF file in the browser

You do not need the Python scripts for this — the viewer reads `.rdf` files directly.

1. Drag an `.rdf` file onto the page (or **Browse** to it). The viewer parses it and reports how many **series slots** it found.
2. A **RDF series slot** dropdown appears. Pick the slot you want to view. The viewer converts that slot to a dataset and plots it.
3. Switch slots at any time from the same dropdown. Your filters and colour grouping are preserved across slots of the same file, because every slot shares the same set of traces.
4. To save the current slot as a file, use the **Download CSV** buttons:
   - **Wide** — rows are timesteps, columns are traces.
   - **Stacked** — the same data with any scalar slot values written as label header rows on top, which the viewer auto-detects on re-load.

The downloaded CSV is named after the slot. For batch or scripted conversion outside the browser, use the [Python scripts](../scripts/README.md) instead.

## Attach a sidecar label file

A sidecar maps column names to label categories when the labels are not already in the data file.

1. Load your data file first.
2. In the drop zone, find **Sidecar labels (optional)** and click **Attach CSV**.
3. Select the sidecar CSV. Its categories appear in the label controls and the strategy switches to **sidecar**.

See [Reference → Sidecar labels](reference.md#sidecar-labels) for the file layout.

## Load a classification bundle

A classification bundle tags traces by trace number — useful when the same traces carry several independent classifications (for example, different drought-year definitions).

1. Load your data file first.
2. In the drop zone, find **Classification files (optional)** and click **Browse**.
3. Select one or more `.txt` files. Each file is one classification scheme. Scheme names are derived automatically from the filenames by stripping the common prefix and suffix.
4. The schemes appear as categories in the label controls, where you can filter and colour by them like any other label.

When you select multiple schemes as **horizons**, you can combine them with AND/OR logic into a single pass/fail filter. See [Reference → Classification bundle](reference.md#classification-bundle) for the file spec.

## Save and load a configuration preset

The **Configuration** panel saves and restores the entire left-hand control setup — label strategy, filters, colouring, axis labels, line styling, splits, sorts, and classification selections.

- **Save config** downloads the current controls as `ensemble-viewer-config.xml`.
- **Load config** restores them from a file.

Loading a config restores **controls only** — it never re-reads or re-parses your data file. Load your data first, then apply the preset. Categories in the preset that are absent from the current dataset are ignored. The XML format is versioned and documented in [config-schema.md](config-schema.md).

## Build and preview a production bundle

To produce optimised static files (for hosting the viewer):

```bash
npm run build      # writes dist/
npm run preview    # serves the production build locally to check it
```

The output in `dist/` is a static site — host it on any static file server.

## Run the tests

```bash
npm run test         # run the suite once
npm run test:watch   # re-run on every file save
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contributor workflow.
