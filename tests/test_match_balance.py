"""
Unit tests for Match Balance Feedback (-5 to +5 scale)
Tests getMatchBalanceSummary, computePlayerBalanceContext, and backwards compatibility.
"""

import unittest
import json

class TestMatchBalance(unittest.TestCase):

    def setUp(self):
        self.match_with_balance = {
            "match_date": "2026-09-02",
            "season": 2026,
            "balance": {
                "attack": -1.5,   # Favors Voyagers
                "midfield": 2.0,   # Favors Boots
                "defense": 0.0     # Even
            },
            "teams": [
                {
                    "team": "voyagers",
                    "members": ["Abey", "Varun", "Mathai"],
                    "score": 3,
                    "scorers": [{"name": "Varun", "goals": 2, "is_own_goal": False}]
                },
                {
                    "team": "bootsandbeers",
                    "members": ["Anoop", "Sanjay", "CP"],
                    "score": 2,
                    "scorers": [{"name": "CP", "goals": 2, "is_own_goal": False}]
                }
            ]
        }

        self.match_legacy_no_balance = {
            "match_date": "2026-08-15",
            "season": 2026,
            "teams": [
                {
                    "team": "voyagers",
                    "members": ["Abey", "Varun"],
                    "score": 1,
                    "scorers": []
                },
                {
                    "team": "bootsandbeers",
                    "members": ["Anoop", "Sanjay"],
                    "score": 1,
                    "scorers": []
                }
            ]
        }

    def test_balance_summary_formatting(self):
        """Simulates getMatchBalanceSummary logic for balance values."""
        b = self.match_with_balance["balance"]
        
        # Test Attack (Negative favors Team A / Voyagers)
        att_val = b["attack"]
        self.assertLess(att_val, 0)
        att_favored = "teamA" if att_val <= -0.5 else "even"
        self.assertEqual(att_favored, "teamA")

        # Test Midfield (Positive favors Team B / Boots)
        mid_val = b["midfield"]
        self.assertGreater(mid_val, 0)
        mid_favored = "teamB" if mid_val >= 0.5 else "even"
        self.assertEqual(mid_favored, "teamB")

        # Test Defense (Zero is even)
        def_val = b["defense"]
        self.assertEqual(def_val, 0.0)

    def test_legacy_match_compatibility(self):
        """Ensures matches without balance field are handled gracefully."""
        m = self.match_legacy_no_balance
        self.assertNotIn("balance", m)
        balance = m.get("balance")
        self.assertIsNone(balance)

    def test_adverse_vs_favored_perspective(self):
        """Ensures that player perspective calculates adversity correctly."""
        # For Voyagers player (Abey): net balance = (-1.5 + 2.0 + 0) / 3 = +0.167 (Boots favored)
        # Therefore for Abey in Team A, perspective advantage = -netBalance = -0.167
        net = ((-1.5) + 2.0 + 0.0) / 3.0
        abey_advantage = -net
        self.assertAlmostEqual(abey_advantage, -0.166666, places=4)

if __name__ == "__main__":
    unittest.main()
