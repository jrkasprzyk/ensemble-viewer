# Explanation

Ensemble Viewer is a tool to view and filter any ensemble of timeseries data. Its main specific use case is processing output data from [RiverWare Multiple Run Management](https://riverware.org/HelpSystem/CurrentVersion/index.html#page/SolutionApproaches/Solutions_MRM.4.01.html) applications. 

This document discusses the design choices behind Ensemble Viewer. For instructions, see the [how-to guides](how-to.md); for specifications, see the [reference](reference.md).

## Why it runs entirely in the browser

Ensemble Viewer has no server-side processing. Files you open are parsed and rendered locally in your browser; nothing is uploaded. This has three consequences worth understanding:

- **Privacy and simplicity.** Your data never leaves your machine, and there is no backend to deploy, scale, or secure. The production build is a static site that can be hosted anywhere.
- **RDF parsing happens in JavaScript.** RiverWare `.rdf` files are read by an in-browser parser. The repo contains standalone Python scripts for offline and batch use, but the viewer does not depend on them.
- **Browser memory is the ceiling.** Because everything is in memory, very large ensembles are bounded by what the tab can hold rather than by server resources.

## Why Plotly WebGL for rendering

Plotly offers different ways of rendering traces, including SVG and WebGL.

Ensemble Viewer is designed for large datasets, that may have hundreds of traces and thousands of timesteps. SVG plotting of these types of data would overwhelm the browser. Instead, the tool uses Plotly's [WebGL trace type](https://plotly.com/r/webgl-vs-svg-time-series/#webgl-for-time-series-data-24381-points) (`scattergl`), which pushes the lines onto the GPU. This keeps pan, zoom, and toggling responsive even at 500+ columns. The trade-off is that the tool provides slightly different rendering fidelity from SVG, but this was deemed a worthwhile exchange for interactivity at ensemble scale.

## Why line styling adapts to density

When only a handful of traces are visible, thin faint lines are hard to read; when hundreds overlap, thick opaque lines become an unreadable block of ink. Ensemble Viewer therefore scales line width and opacity automatically with the number of *visible* traces — sparser views get bolder lines, denser views get thinner, more transparent ones. Manual width and opacity overrides are available for when you want full control, but the automatic default keeps most views legible without fiddling.

When a percentile band is active, the underlying traces dim further so the summary band reads clearly on top of them. Note that the percentile bands are only available for certain situations (see below).

## Why percentile bands are computed per colour group

Bands are computed per colour group, and only for groups with at least two visible traces. This ties the summary statistics directly to the grouping you have chosen with **Color by**: change the grouping and the bands re-summarise to match. It also explains why bands require an active colour grouping — without groups, there is nothing to summarise separately.

## Why the Okabe-Ito palette

Ensembles are often coloured by category, and a palette that some readers cannot distinguish defeats the purpose. Ensemble Viewer uses the [Okabe-Ito qualitative palette](https://easystats.github.io/see/reference/scale_color_okabeito.html), which is designed to remain distinguishable across the common forms of colour vision deficiency. Numeric categories instead use a sequential colour map, so ordered values read as a gradient rather than arbitrary hues.

## Why three labelling strategies

Real-world ensemble files encode their metadata inconsistently: some stack label rows above the data, some pack everything into the column name, and some keep labels in a separate file. Rather than force one convention, the viewer supports all three and auto-detects stacked rows. Classification bundles add a fourth path for metadata that arrives as separate per-trace lookup files. The aim is to let you load data as it already exists, instead of reshaping it first.

## Why configuration is saved separately from data

Presets save the control panel — filters, colouring, axis labels, styling — but never the data itself. This keeps presets small, shareable, and reusable across datasets that share the same label categories (for example, the same plotting setup applied to different RiverWare slots). The cost is that a preset only takes effect once compatible data is loaded; categories that do not exist in the current dataset are quietly ignored.

## Related projects

RiverWare RDF support was inspired by [RWDataPlyr](https://github.com/BoulderCodeHub/RWDataPlyr), an R package for working with RiverWare RDF files.

The python package [parasolpy](https://pypi.org/project/parasolpy/) is also developed by the author and contains similar plotting functionality in Python.
