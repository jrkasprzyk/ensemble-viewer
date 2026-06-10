# Tutorial: Explore your first ensemble

This tutorial walks you through Ensemble Viewer from a cold start to reading a percentile band on a real dataset. You will not need any data of your own — the app ships with curated examples. By the end you will have loaded an ensemble, filtered it by a label, coloured the traces by category, and overlaid a summary band.

Allow about ten minutes.

## Before you start (for using locally)

To run locally, you need [Node.js](https://nodejs.org/) v18 or later. Confirm it is installed:

```bash
node --version
```

If that prints a version of `v18` or higher, you are ready.

## Step 1 — Start the app (locally)

From the project folder, install dependencies once and start the development server:

```bash
npm install
npm run dev
```

The terminal prints a local URL. Open <http://localhost:5173> in your browser. You will see the **Ensemble Viewer** header, an empty plot area that says *Drop a file to begin*, and a control panel on the left with a **Data file** drop zone.

## Step 1 -- Load the app in a browser (for online users)

Visit [https://ensemble-viewer.vercel.app/](https://ensemble-viewer.vercel.app/) in your browser. All subsequent steps are the same.

## Step 2 — Load an example dataset

In the drop zone, find the **Examples…** dropdown and choose **CRMMS: Lake Powell Pool Elevation**.

The app fetches the dataset, its sidecar metadata, and a bundle of classification files, then draws the plot. You will now see:

- A tangle of timeseries traces in the plot area — one line per ensemble trace.
- New panels appear on the left: a **label strategy** picker and a **label controls** panel listing the categories found in the data.
- A status readout at the bottom: *showing N / N columns*.

This dataset is an ensemble of projected Lake Powell pool elevations, with each trace classified by several drought-related schemes.

## Step 3 — Filter the traces

In the label controls panel, each category lists its values as toggles. Every value starts selected, so all traces are visible.

Click a value to hide the traces that carry it; click it again to bring them back. Use a category's **toggle-all** control to clear or restore a whole category at once. Watch the *showing N / N columns* readout update as you go.

Filtering is how you narrow hundreds of traces down to the subset you care about.

## Step 4 — Colour the traces by category

So far every trace is the same neutral colour. To group them visually, find the **Color by** control and choose one of the classification schemes.

The traces recolour by their value in that scheme, using a colourblind-safe palette. A legend tells you which colour means what.

## Step 5 — Overlay a percentile band

With a colour grouping active, enable **Show bands**.

For each colour group that has at least two visible traces, the app draws a shaded 10th–90th percentile band. The individual traces dim so the band stands out. This summarises the spread of each group without hiding the raw ensemble.

If you turn colouring off, the band disappears — bands are computed per colour group, so a grouping must be active for them to draw.

## What you have learned

You started the app, loaded a real ensemble from the Examples dropdown, filtered traces by label, coloured them by a classification scheme, and read a percentile band. That is the core loop of Ensemble Viewer.

## Where to go next

- **[How-to guides](how-to.md)** — load your own CSV, Excel, or RiverWare RDF data; attach labels; save your setup as a preset.
- **[Reference](reference.md)** — the exact data format the viewer expects.
- **[Explanation](explanation.md)** — why the viewer works the way it does.
