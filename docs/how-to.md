# How-to guides

Each section below is a self-contained recipe for one task. They assume the app is already open in your browser — either the deployed app at <https://ensemble-viewer.vercel.app/> or a local development server (`npm run dev`, then <http://localhost:5173>). For a guided introduction, start with the [tutorial](tutorial.md); for exact format specifications, see the [reference](reference.md).

The viewer accepts two kinds of data file, and they behave differently on load:

- **Tabular files** (`.csv`, `.tsv`, `.xlsx`, `.xls`) are a single wide table and are plotted immediately.
- **RiverWare `.rdf` files** are containers that can hold several datasets ("slots"), so the viewer asks you to pick a slot before it plots anything.

## Load a wide CSV or Excel file

1. Drag the file onto the page, or click **Browse** in the drop zone and select it.
2. The viewer parses the file and plots the first column as the x-axis (index) and every remaining column as a trace.

Stacked label rows above the data are detected automatically. If the detection is wrong, use the **label strategy** picker to set the number of label rows explicitly, then re-parse. See [Reference → Data format](reference.md#data-format) for what counts as a valid file.

## Load a RiverWare RDF file in the browser

The viewer reads [RiverWare `.rdf` files](https://riverware.org/HelpSystem/CurrentVersion/index.html#page/OutputVisual/Output_RDF.11.1.html) directly. Unlike a CSV or Excel file, an `.rdf` file is not one table — it can contain many **slots**, each its own ensemble — so loading it takes one extra step: choosing which slot to plot.

1. Drag an `.rdf` file onto the page (or **Browse** to it). The viewer parses it and reports how many **series slots** it found.
2. An **RDF series slot** dropdown appears. Pick the slot you want to view. The viewer converts that slot to a dataset and plots it.
3. Switch slots at any time from the same dropdown. Your filters and colour grouping are preserved across slots of the same file, because every slot shares the same set of traces.
4. To save the current slot as a file, use the **Download CSV** buttons:
   - **Wide** — rows are timesteps, columns are traces.
   - **Stacked** — the same data with any scalar slot values written as label header rows on top, which the viewer auto-detects on re-load.

The downloaded CSV is named after the slot. 

For batch or scripted conversion outside the browser, use the [Python scripts](../scripts/README.md) instead.

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

When you **Color** by a classification (Bundled or an Individual scheme), the panel shows a color swatch next to each value — green for `Success`, orange for `Failure` — so the figure's colors map back to their meaning. Schemes that aren't the active color show neutral gray swatches.

The figure itself also carries a color legend whenever a color grouping is active, so the meaning survives in exported SVG/PNG. Toggle it under **Display → "Show color legend on the figure"** — useful to hide it on dense plots or when a category has many values.

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

The output in `dist/` is a static site — host it on any [static file server](https://medium.com/swlh/need-a-local-static-server-here-are-several-options-bbbe77e59a11). The deployed app at <https://ensemble-viewer.vercel.app/> is exactly this build, served by Vercel.

## Run the tests

```bash
npm run test         # run the suite once
npm run test:watch   # re-run on every file save
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contributor workflow.
