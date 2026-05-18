"""
Tests for rdf_parser.py.

Uses synthetic sample files in public/rw-sample-data/ (safe to commit).

Run with:  python scripts/test_rdf_parser.py
"""

from __future__ import annotations

import csv
import os
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).parent.parent
SAMPLES = REPO / "public" / "rw-sample-data"

TRACES = SAMPLES / "sample_traces.rdf"   # 3 runs, 5 timesteps, 5 slots (3 series + 2 scalar)
SUBSET = SAMPLES / "sample_subset.rdf"   # 2 runs, 4 timesteps, 5 slots

sys.path.insert(0, str(Path(__file__).parent))
from rdf_parser import parse_rdf, list_slots


class TestSampleTraces(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rdf = parse_rdf(TRACES)

    def test_meta_run_count(self):
        self.assertEqual(self.rdf["meta"]["number_of_runs"], "3")

    def test_actual_run_count(self):
        self.assertEqual(len(self.rdf["runs"]), 3)

    def test_slot_count_per_run(self):
        for run in self.rdf["runs"]:
            self.assertEqual(len(run["slots"]), 5)

    def test_slot_names(self):
        expected = {
            "Example Reservoir.Pool Elevation",
            "Example Reservoir.Outflow",
            "Example Reservoir.Turbine Release",
            "Run Management.Trace Historical Year",
            "Run Management.Historical Year Percent of Average",
        }
        self.assertEqual(set(self.rdf["runs"][0]["slots"].keys()), expected)

    def test_series_slot_value_count(self):
        for run in self.rdf["runs"]:
            slot = run["slots"]["Example Reservoir.Pool Elevation"]
            self.assertFalse(slot["scalar"])
            self.assertEqual(len(slot["values"]), 5)

    def test_series_slot_values(self):
        vals = self.rdf["runs"][0]["slots"]["Example Reservoir.Pool Elevation"]["values"]
        self.assertAlmostEqual(vals[0], 1100.0)
        self.assertAlmostEqual(vals[-1], 1098.0)

    def test_scalar_slot(self):
        slot = self.rdf["runs"][0]["slots"]["Run Management.Trace Historical Year"]
        self.assertTrue(slot["scalar"])
        self.assertEqual(len(slot["values"]), 1)
        self.assertAlmostEqual(slot["values"][0], 1988.0)

    def test_units(self):
        slot = self.rdf["runs"][0]["slots"]["Example Reservoir.Pool Elevation"]
        self.assertEqual(slot["units"], "feet")

    def test_timestamp_normalization(self):
        times = self.rdf["runs"][0]["times"]
        self.assertEqual(times[0], "2024-01-01")
        self.assertEqual(times[-1], "2024-01-05")
        self.assertEqual(len(times), 5)

    def test_trace_ids(self):
        traces = [r["preamble"]["trace"] for r in self.rdf["runs"]]
        self.assertEqual(traces, ["1", "2", "3"])

    def test_list_slots_returns_metadata(self):
        slots = list_slots(self.rdf)
        self.assertEqual(len(slots), 5)
        keys = [s["key"] for s in slots]
        self.assertIn("Example Reservoir.Pool Elevation", keys)


class TestSampleSubset(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rdf = parse_rdf(SUBSET)

    def test_meta_run_count(self):
        self.assertEqual(self.rdf["meta"]["number_of_runs"], "2")

    def test_actual_run_count(self):
        self.assertEqual(len(self.rdf["runs"]), 2)

    def test_timestep_count(self):
        for run in self.rdf["runs"]:
            self.assertEqual(len(run["times"]), 4)

    def test_series_value_count(self):
        for run in self.rdf["runs"]:
            for key, slot in run["slots"].items():
                if not slot["scalar"]:
                    self.assertEqual(len(slot["values"]), 4, msg=f"slot {key}")


class TestTimestampNormalization(unittest.TestCase):
    def test_single_digit_month_day(self):
        from rdf_parser import _normalize_ts
        self.assertEqual(_normalize_ts("2025-10-2 24:00"), "2025-10-02")
        self.assertEqual(_normalize_ts("2026-1-15 24:00"), "2026-01-15")
        self.assertEqual(_normalize_ts("2026-10-1 24:00"), "2026-10-01")


class TestParserErrors(unittest.TestCase):
    def test_wrong_extension_raises(self):
        with self.assertRaises(ValueError):
            parse_rdf("model.csv")

    def test_missing_file_raises(self):
        with self.assertRaises(FileNotFoundError):
            parse_rdf("nonexistent.rdf")


class TestCLIConvert(unittest.TestCase):
    def _run_cli(self, *extra_args):
        import subprocess
        return subprocess.run(
            [sys.executable, str(REPO / "scripts" / "rdf.py"), *extra_args],
            capture_output=True, text=True,
        )

    def test_info_command(self):
        result = self._run_cli("info", str(TRACES))
        self.assertEqual(result.returncode, 0)
        self.assertIn("Example Reservoir.Pool Elevation", result.stdout)
        self.assertIn("feet", result.stdout)
        self.assertIn("count         : 3", result.stdout)

    def test_default_format_is_wide(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            out = f.name
        try:
            result = self._run_cli(
                "convert", str(TRACES),
                "--slot", "Example Reservoir.Pool Elevation",
                "--output", out,
            )
            self.assertEqual(result.returncode, 0, msg=result.stderr)
            with open(out, newline="") as f:
                rows = list(csv.reader(f))
            self.assertEqual(len(rows), 6)        # 1 header + 5 data rows (wide, not stacked)
            self.assertEqual(len(rows[0]), 4)     # date + 3 trace cols
        finally:
            os.unlink(out)

    def test_wide_csv_dimensions(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            out = f.name
        try:
            result = self._run_cli(
                "convert", str(TRACES),
                "--slot", "Example Reservoir.Pool Elevation",
                "--output", out,
                "--format", "wide",
            )
            self.assertEqual(result.returncode, 0, msg=result.stderr)
            with open(out, newline="") as f:
                rows = list(csv.reader(f))
            self.assertEqual(len(rows), 6)        # 1 header + 5 data rows
            self.assertEqual(len(rows[0]), 4)     # date + 3 trace cols
            self.assertEqual(rows[0][0], "date")
            self.assertEqual(rows[1][0], "2024-01-01")
            self.assertEqual(rows[0][1], "trace_1")
        finally:
            os.unlink(out)

    def test_stacked_csv_dimensions(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            out = f.name
        try:
            result = self._run_cli(
                "convert", str(TRACES),
                "--slot", "Example Reservoir.Pool Elevation",
                "--output", out,
                "--format", "stacked",
            )
            self.assertEqual(result.returncode, 0, msg=result.stderr)
            with open(out, newline="") as f:
                rows = list(csv.reader(f))
            self.assertEqual(len(rows), 1 + 3 * 5)   # 1 header + 3 traces * 5 timesteps
            self.assertEqual(rows[0], ["date", "trace", "value"])
        finally:
            os.unlink(out)

    def test_enriched_csv_dimensions(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            out = f.name
        try:
            result = self._run_cli(
                "convert", str(TRACES),
                "--slot", "Example Reservoir.Pool Elevation",
                "--output", out,
                "--format", "enriched",
            )
            self.assertEqual(result.returncode, 0, msg=result.stderr)
            with open(out, newline="") as f:
                rows = list(csv.reader(f))
            self.assertEqual(len(rows), 1 + 3 * 5)   # 1 header + 3 traces * 5 timesteps
            # date, trace, value + 2 scalar label columns
            self.assertEqual(rows[0], ["date", "trace", "value",
                                        "Trace Historical Year",
                                        "Historical Year Percent of Average"])
            self.assertEqual(rows[1][3], "1988.0")   # trace_1 scalar value
        finally:
            os.unlink(out)

    def test_invalid_slot_exits_nonzero(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            out = f.name
        try:
            result = self._run_cli(
                "convert", str(TRACES),
                "--slot", "Does Not.Exist",
                "--output", out,
            )
            self.assertNotEqual(result.returncode, 0)
        finally:
            if os.path.exists(out):
                os.unlink(out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
