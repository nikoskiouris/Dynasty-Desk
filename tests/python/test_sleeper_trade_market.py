import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "update_sleeper_trade_market.py"


def load_module():
    spec = importlib.util.spec_from_file_location("update_sleeper_trade_market", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["update_sleeper_trade_market"] = module
    spec.loader.exec_module(module)
    return module


class SleeperTradeMarketTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_parse_trade_builds_two_packages(self):
        trade = self.mod.parse_trade_observation(
            {
                "type": "trade",
                "status": "complete",
                "roster_ids": [3, 7],
                "adds": {"9487": 3, "4866": 7},
                "draft_picks": [
                    {
                        "season": "2026",
                        "round": 1,
                        "owner_id": 7,
                        "previous_owner_id": 3,
                    }
                ],
                "created": 1700000000000,
            },
            superflex=True,
        )
        self.assertIsNotNone(trade)
        self.assertEqual(trade.side_a, ("player:9487",))
        self.assertEqual(trade.side_b, ("player:4866", "pick:2026:r1:any"))
        self.assertTrue(trade.superflex)

    def test_fit_moves_values_toward_even_trade_price(self):
        prior = {"player:a": 4000, "player:b": 7000}
        now = 1_700_000_000_000
        trades = [
            self.mod.TradeObs(side_a=("player:a",), side_b=("player:b",), created_ms=now, superflex=True)
            for _ in range(24)
        ]
        values, counts = self.mod.fit_trade_values(prior, trades, now_ms=now)
        self.assertGreater(values["player:a"], 4000)
        self.assertLess(values["player:b"], 7000)
        self.assertGreater(counts["player:a"], 10)
        self.assertGreater(values["player:a"], values["player:b"] * 0.55)

    def test_superflex_slot_detection(self):
        self.assertTrue(self.mod.league_is_superflex({"roster_positions": ["QB", "RB", "SUPER_FLEX"]}))
        self.assertFalse(self.mod.league_is_superflex({"roster_positions": ["QB", "RB", "WR", "TE", "FLEX"]}))
        self.assertTrue(self.mod.league_is_dynasty({"settings": {"type": 2}}))
        self.assertFalse(self.mod.league_is_dynasty({"settings": {"type": 0}}))


if __name__ == "__main__":
    unittest.main()
