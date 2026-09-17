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

    def test_parse_trade_builds_two_packages_with_provenance(self):
        trade = self.mod.parse_trade_observation(
            {
                "transaction_id": "tx-1",
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
            league_id="league-1",
        )
        self.assertIsNotNone(trade)
        self.assertEqual(trade.side_a, ("player:9487",))
        self.assertEqual(trade.side_b, ("pick:2026:r1:any", "player:4866"))
        self.assertTrue(trade.superflex)
        self.assertEqual(trade.transaction_id, "tx-1")
        self.assertEqual(trade.league_id, "league-1")

    def test_faab_trade_is_excluded_instead_of_dropping_part_of_package(self):
        trade = self.mod.parse_trade_observation(
            {
                "type": "trade",
                "status": "complete",
                "roster_ids": [1, 2],
                "adds": {"a": 1, "b": 2},
                "waiver_budget": [{"sender": 1, "receiver": 2, "amount": 10}],
            },
            superflex=True,
        )
        self.assertIsNone(trade)

    def test_fit_moves_values_toward_even_trade_price(self):
        prior = {"player:a": 4000, "player:b": 7000}
        now = 1_700_000_000_000
        trades = [
            self.mod.TradeObs(
                side_a=("player:a",),
                side_b=("player:b",),
                created_ms=now + index,
                superflex=True,
                transaction_id=f"tx-{index}",
                league_id="league",
            )
            for index in range(24)
        ]
        values, counts = self.mod.fit_trade_values(prior, trades, now_ms=now + 24)
        self.assertGreater(values["player:a"], 4000)
        self.assertLess(values["player:b"], 7000)
        self.assertGreater(counts["player:a"], 10)
        self.assertGreater(values["player:a"], values["player:b"] * 0.55)

    def test_fit_is_deterministic_regardless_of_fetch_completion_order(self):
        prior = {"player:a": 5000, "player:b": 6000, "player:c": 7000}
        now = 1_700_000_000_000
        trades = [
            self.mod.TradeObs(("player:a",), ("player:b",), now - 3000, True, "tx-3", "l2"),
            self.mod.TradeObs(("player:b",), ("player:c",), now - 1000, True, "tx-1", "l1"),
            self.mod.TradeObs(("player:a", "player:b"), ("player:c",), now - 2000, True, "tx-2", "l1"),
        ]
        forward = self.mod.fit_trade_values(prior, trades, now_ms=now)
        reverse = self.mod.fit_trade_values(prior, list(reversed(trades)), now_ms=now)
        self.assertEqual(forward, reverse)

    def test_counts_only_include_usable_trade_evidence(self):
        prior = {"player:a": 100, "player:b": 100, "player:c": 5000, "player:d": 5000}
        now = 1_700_000_000_000
        trades = [
            self.mod.TradeObs(("player:a",), ("player:b",), now, True, "bad", "league"),
            self.mod.TradeObs(("player:c",), ("player:d",), now, True, "good", "league"),
        ]
        _, counts = self.mod.fit_trade_values(prior, trades, now_ms=now)
        self.assertNotIn("player:a", counts)
        self.assertNotIn("player:b", counts)
        self.assertGreater(counts["player:c"], 0)

    def test_future_pick_prior_is_time_adjusted_and_round_order_is_enforced(self):
        prior = {
            "pick:2027:r1:any": 5000,
            "pick:2027:r2:any": 2800,
        }
        first = self.mod.starting_value("pick:2029:r1:any", prior)
        second = self.mod.starting_value("pick:2029:r2:any", prior)
        self.assertGreater(first, second)
        self.assertLess(first, 5000)

        fixed = self.mod.enforce_pick_hierarchy({
            "pick:2029:r1:any": 1803,
            "pick:2029:r2:any": 2269,
        })
        self.assertGreater(fixed["pick:2029:r1:any"], fixed["pick:2029:r2:any"])

    def test_superflex_slot_detection(self):
        self.assertTrue(self.mod.league_is_superflex({"roster_positions": ["QB", "RB", "SUPER_FLEX"]}))
        self.assertFalse(self.mod.league_is_superflex({"roster_positions": ["QB", "RB", "WR", "TE", "FLEX"]}))
        self.assertTrue(self.mod.league_is_dynasty({"settings": {"type": 2}}))
        self.assertFalse(self.mod.league_is_dynasty({"settings": {"type": 0}}))


if __name__ == "__main__":
    unittest.main()
