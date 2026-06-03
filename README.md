# Ensemble Viewer

A browser-based tool for visualising large ensemble timeseries datasets. Drop in a wide CSV, Excel, or RiverWare `.rdf` file, explore hundreds of runs at once, filter and colour by label, and overlay percentile bands — all without installing any software beyond a modern web browser.

## Features

- **Drag-and-drop upload** — CSV, XLSX, and RiverWare `.rdf` files
- **In-browser RDF** — open a RiverWare `.rdf`, pick a series slot, and download it as a viewer-ready CSV, with no separate conversion step
- **Flexible labelling** — stacked header rows, delimiter-separated column names, or a sidecar label CSV
- **Classification bundles** — attach plain-text files that tag traces by trace number, then filter and colour by the resulting schemes
- **Interactive filtering** — category-based trace filtering, colour grouping, sorting, and multi-panel split views
- **Summary statistics** — 10th–90th percentile band per colour group
- **High-performance rendering** — Plotly WebGL (`scattergl`) handles 500+ columns × thousands of timesteps smoothly
- **Density-aware styling** — line width and opacity scale with the visible trace count; manual overrides available
- **Colourblind-safe** — Okabe-Ito palette throughout
- **Curated examples** — load bundled demo datasets (including CRMMS reservoir data) from a dropdown, no file needed
- **Save / load configuration** — export the full control-panel setup to a documented XML preset and reload it later

## Quick start

### Use the version deployed on the web

Visit [Ensemble Viewer, hosted on Vercel](https://ensemble-viewer.vercel.app/). To try it without your own data, pick an item from the **Examples** dropdown in the drop zone.

### Run locally

You need [Node.js](https://nodejs.org/) v18 or later. Then, run the following commands to clone the repo, install the dependencies, and run the dev server:

```bash
git clone https://github.com/jrkasprzyk/ensemble-viewer.git
cd ensemble-viewer
npm install
npm run dev
```

`npm run dev` starts the Vite development server and opens <http://localhost:5173>. The page hot-reloads on every edit to the code within the repo. To try it without your own data, pick an item from the **Examples** dropdown in the drop zone.

## Documentation

Documentation follows the [Diátaxis](https://diataxis.fr/) framework.

| Document | Read it when you want to… |
|---|---|
| **[Tutorial](docs/tutorial.md)** | Learn the tool by loading an example and reading a plot, step by step |
| **[How-to guides](docs/how-to.md)** | Accomplish a specific task: load RDF, attach labels, save a preset |
| **[Reference](docs/reference.md)** | Look up the data format, commands, file specs, and tech stack |
| **[Explanation](docs/explanation.md)** | Understand the design choices behind the viewer |

Additional reference material:

- **[Configuration XML schema](docs/config-schema.md)** — the versioned save/load preset format
- **[RiverWare RDF Python scripts](scripts/README.md)** — offline command-line RDF-to-CSV conversion

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, project structure, and how to run the test suite.

## Licence

[MIT](LICENSE)
