import unittest
import importlib.util
from pathlib import Path


def load_desk_visits():
    path = Path(__file__).resolve().parents[2] / "scripts" / "desk_visits.py"
    spec = importlib.util.spec_from_file_location("desk_visits", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DeskVisitsTests(unittest.TestCase):
    def test_counts_flatten_views_then_people(self):
        desk_visits = load_desk_visits()
        self.assertEqual(
            desk_visits.counts({
                "today": {"views": 12, "people": 3},
                "week": {"views": 40, "people": 8},
                "year": {"views": 200, "people": 50},
                "all": {"views": 500, "people": 80},
            }),
            [12, 3, 40, 8, 200, 50, 500, 80],
        )

    def test_counts_treat_junk_as_zero(self):
        desk_visits = load_desk_visits()
        self.assertEqual(desk_visits.counts(None), [0, 0, 0, 0, 0, 0, 0, 0])
        self.assertEqual(
            desk_visits.counts({"today": {"views": "nope", "people": -2}}),
            [0, 0, 0, 0, 0, 0, 0, 0],
        )


if __name__ == "__main__":
    unittest.main()
