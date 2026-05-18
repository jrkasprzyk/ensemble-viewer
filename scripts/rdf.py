#!/usr/bin/env python3
"""
CLI for RiverWare RDF files.

Usage:
    python scripts/rdf.py info <file.rdf>
    python scripts/rdf.py convert <file.rdf> --slot "ObjectName.SlotName" --output out.csv
    python scripts/rdf.py convert <file.rdf> --slot "ObjectName.SlotName" --output out.csv --format wide
    python scripts/rdf.py convert <file.rdf> --slot "ObjectName.SlotName" --output out.csv --format stacked
    python scripts/rdf.py convert <file.rdf> --slot "ObjectName.SlotName" --output out.csv --format long
    python scripts/rdf.py convert <file.rdf> --slot "ObjectName.SlotName" --output out.csv --format enriched
"""

from __future__ import annotations

import argparse
import csv
import sys
import warnings
from pathlib import Path

# Allow running as a script directly without install
sys.path.insert(0, str(Path(__file__).parent))
from rdf_parser import list_slots, parse_rdf


def _scalar_keys(runs: list[dict]) -> list[str]:
    first_slots = runs[0]["slots"]
    return [k for k, v in first_slots.items() if v.get("scalar")]


def _stacked_date_col_name(ref_times: list[str]) -> str:
    # Annual data in sample files is represented by Jan 1 timestamps.
    if ref_times and all(t.endswith("-01-01") for t in ref_times):
        return "year"
    return "date"


def cmd_info(args: argparse.Namespace) -> None:
    rdf = parse_rdf(args.file)
    meta = rdf["meta"]
    runs = rdf["runs"]

    print("=== Package metadata ===")
    for k, v in meta.items():
        print(f"  {k}: {v}")

    if runs:
        first = runs[0]["preamble"]
        last = runs[-1]["preamble"]
        print(f"\n=== Runs ===")
        print(f"  count         : {len(runs)}")
        print(f"  time_step_unit: {first.get('time_step_unit', 'unknown')}")
        print(f"  first run     : trace={first.get('trace')}  "
              f"start={first.get('start')}  end={first.get('end')}  "
              f"time_steps={first.get('time_steps')}")
        print(f"  last run      : trace={last.get('trace')}  "
              f"start={last.get('start')}  end={last.get('end')}")

    slots = list_slots(rdf)
    if slots:
        print(f"\n=== Slots ({len(slots)}) ===")
        col_w = max(len(s["key"]) for s in slots) + 2
        header = f"  {'slot':<{col_w}}  {'type':<18}  {'units':<12}  scalar"
        print(header)
        print("  " + "-" * (len(header) - 2))
        for s in slots:
            print(
                f"  {s['key']:<{col_w}}  {s['slot_type']:<18}  "
                f"{s['units']:<12}  {s['scalar']}"
            )
    else:
        print("No slots found.")


def cmd_convert(args: argparse.Namespace) -> None:
    rdf = parse_rdf(args.file)
    runs = rdf["runs"]

    if not runs:
        print("No runs found in file.", file=sys.stderr)
        sys.exit(1)

    slot_key = args.slot

    # Validate slot exists
    available = list(runs[0]["slots"].keys())
    if slot_key not in available:
        print(f"Slot '{slot_key}' not found.", file=sys.stderr)
        print("Available slots:", file=sys.stderr)
        for k in available:
            print(f"  {k}", file=sys.stderr)
        sys.exit(1)

    # Warn if timesteps differ across runs
    ref_times = runs[0]["times"]
    for i, run in enumerate(runs[1:], start=2):
        if run["times"] != ref_times:
            warnings.warn(
                f"Run {i} (trace={run['preamble'].get('trace')}) has different "
                f"timesteps from run 1. Using run 1 timesteps for date column."
            )

    slot_info = runs[0]["slots"][slot_key]
    if slot_info.get("scalar"):
        print(
            f"Warning: '{slot_key}' is a scalar slot (1 value per run, not per timestep). "
            "Output will have 1 data row.",
            file=sys.stderr,
        )

    out_path = Path(args.output)

    fmt = args.format if args.format is not None else "wide"
    scalar_keys = _scalar_keys(runs)

    if fmt == "wide":
        _write_wide(runs, slot_key, ref_times, out_path)
        sidecar_path = _write_sidecar(runs, out_path)
        print(f"Wrote {out_path}")
        if sidecar_path:
            print(f"Wrote {sidecar_path}")
    elif fmt == "stacked":
        if not scalar_keys:
            print(
                "Format 'stacked' requires scalar slots for label header rows. "
                "No scalar slots were found.",
                file=sys.stderr,
            )
            sys.exit(1)
        _write_stacked_header(runs, slot_key, ref_times, out_path, scalar_keys)
        print(f"Wrote {out_path}")
    elif fmt == "long":
        _write_long(runs, slot_key, ref_times, out_path)
        print(f"Wrote {out_path}")
    else:  # enriched
        _write_enriched(runs, slot_key, ref_times, out_path)
        print(f"Wrote {out_path}")


def _trace_id(run: dict) -> str:
    return f"trace_{run['preamble'].get('trace', '?')}"


def _write_wide(
    runs: list[dict], slot_key: str, ref_times: list[str], out_path: Path
) -> None:
    headers = ["date"] + [_trace_id(r) for r in runs]

    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        # Determine row count from first run's slot
        first_values = runs[0]["slots"][slot_key]["values"]
        n_rows = len(first_values)

        for row_i in range(n_rows):
            date = ref_times[row_i] if row_i < len(ref_times) else ""
            row = [date]
            for run in runs:
                vals = run["slots"][slot_key]["values"]
                row.append(vals[row_i] if row_i < len(vals) else "")
            writer.writerow(row)


def _write_long(
    runs: list[dict], slot_key: str, ref_times: list[str], out_path: Path
) -> None:
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "trace", "value"])
        for run in runs:
            trace = _trace_id(run)
            vals = run["slots"][slot_key]["values"]
            for i, val in enumerate(vals):
                date = ref_times[i] if i < len(ref_times) else ""
                writer.writerow([date, trace, val])


def _write_stacked_header(
    runs: list[dict],
    slot_key: str,
    ref_times: list[str],
    out_path: Path,
    scalar_keys: list[str],
) -> None:
    trace_ids = [_trace_id(r) for r in runs]
    date_col = _stacked_date_col_name(ref_times)

    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        for sk in scalar_keys:
            label_name = sk.split(".", 1)[1] if "." in sk else sk
            label_vals = []
            for run in runs:
                vals = run["slots"][sk]["values"]
                label_vals.append(vals[0] if vals else "")
            writer.writerow([label_name] + label_vals)

        writer.writerow([date_col] + trace_ids)

        first_values = runs[0]["slots"][slot_key]["values"]
        n_rows = len(first_values)
        for row_i in range(n_rows):
            date = ref_times[row_i] if row_i < len(ref_times) else ""
            row = [date]
            for run in runs:
                vals = run["slots"][slot_key]["values"]
                row.append(vals[row_i] if row_i < len(vals) else "")
            writer.writerow(row)


def _write_enriched(
    runs: list[dict], slot_key: str, ref_times: list[str], out_path: Path
) -> None:
    """Stacked format with scalar slot values appended as label columns."""
    scalar_keys = _scalar_keys(runs)
    category_names = [k.split(".", 1)[1] if "." in k else k for k in scalar_keys]

    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "trace", "value"] + category_names)
        for run in runs:
            trace = _trace_id(run)
            vals = run["slots"][slot_key]["values"]
            scalar_vals = [run["slots"][sk]["values"][0] if run["slots"][sk]["values"] else ""
                           for sk in scalar_keys]
            for i, val in enumerate(vals):
                date = ref_times[i] if i < len(ref_times) else ""
                writer.writerow([date, trace, val] + scalar_vals)


def _write_sidecar(runs: list[dict], out_path: Path) -> Path | None:
    """Write <stem>_labels.csv with one row per trace and one column per scalar slot.

    Returns the sidecar path, or None if no scalar slots exist.
    """
    scalar_keys = _scalar_keys(runs)
    if not scalar_keys:
        return None

    sidecar_path = out_path.with_name(out_path.stem + "_labels.csv")
    # Use just the slot_name portion (after the dot) as the category header.
    category_names = [k.split(".", 1)[1] if "." in k else k for k in scalar_keys]

    with sidecar_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["column"] + category_names)
        for run in runs:
            row = [_trace_id(run)]
            for sk in scalar_keys:
                vals = run["slots"][sk]["values"]
                row.append(vals[0] if vals else "")
            writer.writerow(row)

    return sidecar_path


def cmd_slots(args: argparse.Namespace) -> None:
    """Print one slot key per line — useful for scripting."""
    rdf = parse_rdf(args.file)
    for s in list_slots(rdf):
        if args.series_only and s["scalar"]:
            continue
        print(s["key"])


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="rdf",
        description="Read and convert RiverWare RDF files.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # info
    p_info = sub.add_parser("info", help="Print metadata and slot list.")
    p_info.add_argument("file", help="Path to .rdf file.")

    # slots
    p_slots = sub.add_parser("slots", help="Print slot names one per line (for scripting).")
    p_slots.add_argument("file", help="Path to .rdf file.")
    p_slots.add_argument("--series-only", action="store_true",
                         help="Exclude scalar slots; print series slots only.")

    # convert
    p_conv = sub.add_parser("convert", help="Export a slot to CSV.")
    p_conv.add_argument("file", help="Path to .rdf file.")
    p_conv.add_argument(
        "--slot",
        required=True,
        metavar="OBJECT.SLOT",
        help='Slot to export, e.g. "Example Reservoir.Pool Elevation".',
    )
    p_conv.add_argument("--output", required=True, metavar="PATH", help="Output CSV path.")
    p_conv.add_argument(
        "--format",
        choices=["wide", "stacked", "long", "enriched"],
        default=None,
        help=(
            "Output format. Default: wide. "
            "Options: wide (wide + optional sidecar), stacked (wide with scalar "
            "label header rows), long (date/trace/value), enriched (long + labels)."
        ),
    )

    args = parser.parse_args()

    if args.command == "info":
        cmd_info(args)
    elif args.command == "slots":
        cmd_slots(args)
    elif args.command == "convert":
        cmd_convert(args)


if __name__ == "__main__":
    main()
