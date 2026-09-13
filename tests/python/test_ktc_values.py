import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "update_ktc_values.py"


def load_ktc_module():
    spec = importlib.util.spec_from_file_location("update_ktc_values", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["update_ktc_values"] = module
    spec.loader.exec_module(module)
    return module


class KtcScraperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ktc = load_ktc_module()

    def test_parse_rankings_reads_player_and_pick_rows(self):
        lines = [
            "RANK",
            "PLAYER NAME",
            "POS",
            "AGE",
            "TIER",
            "VALUE",
            "1",
            "Jahmyr Gibbs DET",
            "RB",
            "24.2",
            "Tier 1",
            "0",
            "9998",
            "2",
            "2026 Early 1st",
            "PICK",
            "0",
            "Tier 1",
            "12",
            "6120",
            "3",
            "Not seeing a player you're looking for?",
        ]
        rows = self.ktc.parse_rankings(lines)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].label, "Jahmyr Gibbs")
        self.assertEqual(rows[0].position, "RB")
        self.assertEqual(rows[0].team, "DET")
        self.assertEqual(rows[0].value, 9998)
        self.assertEqual(rows[1].position, "PICK")
        self.assertEqual(rows[1].value, 6120)

    def test_parse_pick_asset_keeps_bucket_and_round(self):
        asset_id, bucket = self.ktc.parse_pick_asset("2026 Early 1st")
        self.assertEqual(asset_id, "pick:2026:r1:any")
        self.assertEqual(bucket, "early")
        self.assertEqual(self.ktc.parse_pick_asset("not a pick"), (None, None))

    def test_build_urls_include_1qb_format_and_filters(self):
        sf_url = self.ktc.build_ktc_url(0, {"filters": self.ktc.KTC_FILTERS})
        one_qb_url = self.ktc.build_ktc_url(2, {"filters": self.ktc.KTC_FILTERS, "format": 1})
        self.assertIn("filters=", sf_url)
        self.assertIn("format=1", one_qb_url)
        self.assertIn("page=2", one_qb_url)
        self.assertNotIn("page=", self.ktc.build_ktc_url(0, {"filters": self.ktc.KTC_FILTERS}))


if __name__ == "__main__":
    unittest.main()
