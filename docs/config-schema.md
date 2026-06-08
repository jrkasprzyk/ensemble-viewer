# Ensemble Viewer configuration schema

Ensemble Viewer can **save** the full left-panel configuration to an XML file
and **load** it back later, so you can prepare and redistribute presets (for
example, preferred settings for plotting RiverWare Pool Elevation slots).

The format is plain, versioned XML with a public schema documented here.
Loading a config restores the controls only — it never re-reads or re-parses
your data file. Any setting omitted from a file resets to the application
default when loaded.

- **File name (on save):** `ensemble-viewer-config.xml`
- **Root element:** `<ensembleViewerConfig version="1">`
- **MIME type:** `application/xml`

## Versioning

The root element carries a required `version` attribute. The current schema is
version `1`. When loading:

- A file with `version="1"` is accepted.
- A file with any other version (or no version) is **rejected** with a
  descriptive error. There is no migration layer yet.

## Security

Config files are treated as untrusted input:

- Parsed with the browser-native `DOMParser` as `text/xml`. External entities
  are **not** resolved and no network resources are fetched.
- Malformed XML is rejected with a user-visible error (it does not crash the
  app).
- Numeric fields are validated and clamped before reaching the plot — no
  `NaN`, `Infinity`, or negative line widths can be applied. Out-of-range
  values are clamped to their allowed range; non-numeric values fall back to
  the default.
- Unknown elements are ignored (forward compatible).

## Elements

All elements below are children of the root and are **optional**. A missing
element resets that setting to the application default on load.

| Element | Type | Allowed values / notes |
|---|---|---|
| `labelStrategy` | string | `names`, `headers`, `sidecar`, `classifications` |
| `delimiter` | string | Column-name delimiter (e.g. `_`) |
| `categoriesText` | string | Comma-separated category names for the delimiter strategy |
| `activeByCategory` | element | Per-category active value sets (see below) |
| `colorBy` | string | Category name currently colored by; omit for none |
| `showBands` | boolean | `true` / `false` |
| `showPlotLegend` | boolean | `true` / `false` |
| `xAxisLabel` | string | Manual x-axis label override |
| `yAxisLabel` | string | Manual y-axis label override |
| `lineStyleControls` | element | Line width/opacity settings (see below) |
| `tickFormat` | element | Per-axis tick precision (see below) |
| `axisRanges` | element | Manual plot bounds (see below) |
| `splitBy` | string | Category used to facet into multiple plots; omit for single plot |
| `tieCategoryA` | string | First category to tie together |
| `tieCategoryB` | string | Second category to tie together |
| `sortCategory` | string | Numeric category used for sort/range filtering |
| `sortRange` | element | Numeric `min`/`max` range filter (see below) |
| `selectedHorizons` | element | Selected classification time-horizon schemes (see below) |
| `horizonLogic` | string | `AND` or `OR` |
| `bundledFilter` | element | Active values for the bundled classification (see below) |
| `classificationFilter` | element | Active values for the individual classification (see below) |

### `activeByCategory`

Maps each label category to the set of currently active (checked) values. A
column is visible only if, for every category, its value is in the active set.

```xml
<activeByCategory>
  <category name="RCP">
    <value>RCP45</value>
    <value>RCP85</value>
  </category>
  <category name="Model">
    <value>CanESM5</value>
  </category>
</activeByCategory>
```

On load, categories not present in the current dataset are ignored, and values
not present in the dataset are dropped.

### `lineStyleControls`

```xml
<lineStyleControls>
  <thickness>1.5</thickness>
  <opacity>2</opacity>
  <widthOverride>3</widthOverride>
  <opacityOverride>0.4</opacityOverride>
</lineStyleControls>
```

| Child | Type | Notes |
|---|---|---|
| `thickness` | number | Slider multiplier, clamped to `[0.5, 4]` |
| `opacity` | number | Slider multiplier, clamped to `[0.5, 4]` |
| `widthOverride` | number | Absolute line width (px), clamped to `[1.5, 5]`; omit/empty for auto |
| `opacityOverride` | number | Absolute opacity, clamped to `[0.1, 1]`; omit/empty for auto |

When an override is present it takes precedence over the auto `sqrt(N)`
scaling for that dimension; an absent or invalid override means that dimension
stays on auto.

### `tickFormat`

```xml
<tickFormat>
  <x>int</x>
  <y>2</y>
</tickFormat>
```

Each of `x` and `y` is one of: `auto`, `int`, `1`, `2` (integer, 1 decimal,
2 decimals). The x setting has no effect on datetime axes.

### `axisRanges`

Manual plot bounds. Each child is a string (datetime axes use text such as
`YYYY-MM-DD`); an empty or omitted child means auto-range for that bound.

```xml
<axisRanges>
  <xMin>2020</xMin>
  <xMax>2050</xMax>
  <yMin></yMin>
  <yMax>1200</yMax>
</axisRanges>
```

### `sortRange`

Numeric range filter for the `sortCategory`. Both bounds must be finite numbers;
otherwise the range is ignored on load.

```xml
<sortRange>
  <min>1</min>
  <max>10</max>
</sortRange>
```

### `selectedHorizons`

```xml
<selectedHorizons>
  <horizon>nearTerm</horizon>
  <horizon>midTerm</horizon>
</selectedHorizons>
```

### `bundledFilter` / `classificationFilter`

Active values for the bundled and individual classification filters.

```xml
<bundledFilter>
  <value>Failure</value>
</bundledFilter>
<classificationFilter>
  <value>Success</value>
  <value>Failure</value>
</classificationFilter>
```

## Complete example

```xml
<ensembleViewerConfig version="1">
  <labelStrategy>headers</labelStrategy>
  <delimiter>_</delimiter>
  <categoriesText>RCP,Model,Run</categoriesText>
  <activeByCategory>
    <category name="RCP">
      <value>RCP45</value>
      <value>RCP85</value>
    </category>
    <category name="Model">
      <value>CanESM5</value>
    </category>
  </activeByCategory>
  <colorBy>RCP</colorBy>
  <showBands>true</showBands>
  <showPlotLegend>true</showPlotLegend>
  <xAxisLabel>year</xAxisLabel>
  <yAxisLabel>Pool Elevation (ft)</yAxisLabel>
  <lineStyleControls>
    <thickness>1.5</thickness>
    <opacity>2</opacity>
    <widthOverride>3</widthOverride>
    <opacityOverride>0.4</opacityOverride>
  </lineStyleControls>
  <tickFormat>
    <x>int</x>
    <y>2</y>
  </tickFormat>
  <axisRanges>
    <xMin>2020</xMin>
    <xMax>2050</xMax>
    <yMin></yMin>
    <yMax>1200</yMax>
  </axisRanges>
  <splitBy>Model</splitBy>
  <tieCategoryA>RCP</tieCategoryA>
  <tieCategoryB>Model</tieCategoryB>
  <sortCategory>Run</sortCategory>
  <sortRange>
    <min>1</min>
    <max>10</max>
  </sortRange>
  <selectedHorizons>
    <horizon>nearTerm</horizon>
    <horizon>midTerm</horizon>
  </selectedHorizons>
  <horizonLogic>AND</horizonLogic>
  <bundledFilter>
    <value>Failure</value>
  </bundledFilter>
  <classificationFilter>
    <value>Success</value>
    <value>Failure</value>
  </classificationFilter>
</ensembleViewerConfig>
```
