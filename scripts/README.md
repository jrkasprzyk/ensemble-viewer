# RiverWare RDF scripts

Python utilities to read RiverWare `.rdf` ensemble files and convert them to CSV for use with ensemble-viewer.

## Requirements

Python 3.12+. No third-party packages required — stdlib only.

Check your version:

```bash
python --version
# or
python3 --version
```

## Typical workflow

1. **Inspect** the file to see what slots are available.
2. **Convert** the slot you want to a CSV.
3. Load the CSV into ensemble-viewer.

```bash
# Step 1 — list slots and metadata
python scripts/rdf.py info path/to/model.rdf

# Step 2 — export a slot
python scripts/rdf.py convert path/to/model.rdf \
    --slot "Example Reservoir.Pool Elevation" \
    --output output.csv
```

On **Windows (PowerShell)**, use a backtick for line continuation or write the command on one line:

```powershell
python scripts/rdf.py convert path/to/model.rdf `
    --slot "Example Reservoir.Pool Elevation" `
    --output output.csv
```

## Commands

### `info` — inspect an RDF file

```bash
python scripts/rdf.py info path/to/model.rdf
```

Prints:
- Package metadata (name, owner, create_date, number_of_runs)
- Run count, time step unit, and date range of first and last run
- Table of all slots: `ObjectName.SlotName`, type, units, and whether the slot is scalar

Example output:

```
=== Package metadata ===
  name: Example Ensemble Runs
  owner: example_user
  number_of_runs: 3

=== Runs ===
  count         : 3
  time_step_unit: day
  first run     : trace=1  start=2024-1-1 24:00  end=2024-1-5 24:00  time_steps=5
  last run      : trace=3  start=2024-1-1 24:00  end=2024-1-5 24:00

=== Slots (5) ===
  slot                                            type                units         scalar
  -----------------------------------------------------------------------
  Example Reservoir.Pool Elevation                SeriesSlot          feet          False
  Example Reservoir.Outflow                       SeriesSlot          cfs           False
  Example Reservoir.Turbine Release               SeriesSlot          cfs           False
  Run Management.Trace Historical Year            ScalarSlot          NONE          True
  Run Management.Historical Year Percent ...      ScalarSlot          percent       True
```

### `convert` — export a slot to CSV

Copy the slot name exactly as shown by `info`.

**Wide format** (default) — rows = timesteps, columns = one per trace:

```bash
python scripts/rdf.py convert path/to/model.rdf \
    --slot "Example Reservoir.Pool Elevation" \
    --output output.csv
```

Output CSV:
```
date,trace_1,trace_2,trace_3
2024-01-01,1100.0,1101.0,1099.0
2024-01-02,1099.5,1100.5,1098.5
```

If scalar slots exist, a sidecar file is also written at `<stem>_labels.csv`.

Example sidecar:
```
column,Trace Historical Year,Historical Year Percent of Average
trace_1,1988.0,95.0
trace_2,1995.0,102.0
trace_3,2003.0,88.5
```

This is the format expected by ensemble-viewer. Load `output.csv` directly.

**Stacked-header wide format** — wide data with scalar label rows on top:

```bash
python scripts/rdf.py convert path/to/model.rdf \
    --slot "Example Reservoir.Pool Elevation" \
  --output output_stacked_header.csv \
    --format stacked
```

Output CSV:
```
Trace Historical Year,1988.0,1995.0,2003.0
Historical Year Percent of Average,95.0,102.0,88.5
date,trace_1,trace_2,trace_3
2024-01-01,1100.0,1101.0,1098.0
2024-01-02,1099.5,1100.5,1097.5
```

`--format stacked` requires scalar slots. If no scalar slots exist, the command exits with an error.

**Long format** — one row per timestep per trace:

```bash
python scripts/rdf.py convert path/to/model.rdf \
  --slot "Example Reservoir.Pool Elevation" \
  --output output_long.csv \
  --format long
```

Output CSV:
```
date,trace,value
2024-01-01,trace_1,1100.0
2024-01-01,trace_2,1101.0
2024-01-01,trace_3,1099.0
2024-01-02,trace_1,1099.5
```

Long format is available for downstream analysis, but it is not directly compatible with ensemble-viewer input. Use wide or stacked-header wide for viewer loading.

**Enriched long format** — long format with scalar label columns appended:

```bash
python scripts/rdf.py convert path/to/model.rdf \
  --slot "Example Reservoir.Pool Elevation" \
  --output output_enriched.csv \
  --format enriched
```

### Built-in help

Every command has a `--help` flag:

```bash
python scripts/rdf.py --help
python scripts/rdf.py info --help
python scripts/rdf.py convert --help
```

## Slot names

Slot names follow the pattern `ObjectName.SlotName`. Use `info` to find the exact name — spacing and capitalization must match exactly.

If the slot name is not found, `convert` exits with a non-zero code and prints the available slots to stderr.

## Known limitations

- **Scalar slots** (1 value per run, not per timestep): exporting a scalar slot as the data slot produces one data row.
- **Time notation**: RiverWare uses `YYYY-M-D 24:00` (end-of-day). Normalized to `YYYY-MM-DD` ISO 8601 in all output.
- **Table/periodic slots**: not supported. Parser will warn and skip unsupported slot types.
- **Monthly/annual timesteps**: `24:00` normalization assumes daily steps. Other timestep units may require manual date interpretation.
- **Mismatched timesteps across traces**: a warning is printed; run 1 timesteps are used for the `date` column.

## Running tests

```bash
python scripts/test_rdf_parser.py
```

Runs the unittest suite covering the parser, timestamp normalization, and CLI commands. Sample RDF files used by tests are in `public/rw-sample-data/`.
