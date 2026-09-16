import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "update_nfl_draft_picks.py"


def load_module():
    spec = importlib.util.spec_from_file_location("update_nfl_draft_picks", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["update_nfl_draft_picks"] = module
    spec.loader.exec_module(module)
    return module


class NflDraftPickMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_matches_rookie_by_name_college_and_year(self):
        players = {
            "13287": {
                "player_id": "13287",
                "full_name": "Jeremiyah Love",
                "first_name": "Jeremiyah",
                "last_name": "Love",
                "team": "ARI",
                "college": "Notre Dame",
                "position": "RB",
                "metadata": {"rookie_year": "2026"},
            },
            "999": {
                "player_id": "999",
                "full_name": "Jeremiyah Love",
                "team": "CHI",
                "college": "Alabama",
                "position": "WR",
                "metadata": {"rookie_year": "2024"},
            },
        }
        rows = [
            {
                "season": "2026",
                "round": 1,
                "pick": 3,
                "team": "ARI",
                "college": "Notre Dame",
                "position": "RB",
                "pfr_player_name": "Jeremiyah Love",
                "gsis_id": "",
            }
        ]
        picks = self.mod.build_draft_pick_map(players, rows)
        self.assertEqual(picks["13287"]["round"], 1)
        self.assertEqual(picks["13287"]["pick"], 3)

    def test_gsis_id_wins_when_present(self):
        players = {
            "12527": {
                "player_id": "12527",
                "full_name": "Ashton Jeanty",
                "gsis_id": "00-0039999",
                "metadata": {"rookie_year": "2025"},
            }
        }
        rows = [
            {
                "season": "2025",
                "round": 1,
                "pick": 6,
                "team": "LVR",
                "college": "Boise St.",
                "position": "RB",
                "pfr_player_name": "Wrong Name",
                "gsis_id": "00-0039999",
            }
        ]
        picks = self.mod.build_draft_pick_map(players, rows)
        self.assertEqual(picks["12527"]["pick"], 6)

    def test_shipped_json_keeps_love_as_first_round_pick_three(self):
        payload = (ROOT / "docs/data/nfl_draft_picks.json").read_text(encoding="utf-8")
        self.assertIn('"13287":{"year":2026,"round":1,"pick":3', payload)


if __name__ == "__main__":
    unittest.main()
