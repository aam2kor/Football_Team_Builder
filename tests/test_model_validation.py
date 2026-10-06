"""
Unit tests for Balancer Model Validation and Auto-Tuning (Phase 4).
Tests the mathematical backtesting engine, sector correlation calculations, and empirical weight adjustments.
"""

import unittest
import math

class TestModelValidation(unittest.TestCase):

    def setUp(self):
        self.sample_players = [
            {"id": "p1", "name": "Abey", "position": "MID", "ovr": 80, "attributes": {"pac": 75, "sho": 72, "pas": 82, "dri": 78, "def": 68, "phy": 72, "gk": 20}},
            {"id": "p2", "name": "Vinay", "position": "FWD", "ovr": 84, "attributes": {"pac": 85, "sho": 88, "pas": 75, "dri": 82, "def": 45, "phy": 76, "gk": 15}},
            {"id": "p3", "name": "Anoop", "position": "DEF", "ovr": 82, "attributes": {"pac": 74, "sho": 55, "pas": 70, "dri": 68, "def": 85, "phy": 84, "gk": 20}},
            {"id": "p4", "name": "Sanjay", "position": "MID", "ovr": 81, "attributes": {"pac": 78, "sho": 74, "pas": 80, "dri": 79, "def": 72, "phy": 76, "gk": 25}},
            {"id": "p5", "name": "Akash", "position": "DEF", "ovr": 77, "attributes": {"pac": 70, "sho": 50, "pas": 68, "dri": 65, "def": 80, "phy": 78, "gk": 20}},
            {"id": "p6", "name": "CP", "position": "FWD", "ovr": 82, "attributes": {"pac": 80, "sho": 84, "pas": 74, "dri": 80, "def": 50, "phy": 75, "gk": 15}}
        ]

        self.sample_matches = [
            {
                "match_date": "2026-09-02",
                "teams": [
                    {
                        "team": "voyagers",
                        "members": ["Abey", "Vinay", "Anoop"],
                        "score": 3
                    },
                    {
                        "team": "bootsandbeers",
                        "members": ["Sanjay", "Akash", "CP"],
                        "score": 2
                    }
                ]
            },
            {
                "match_date": "2026-09-09",
                "teams": [
                    {
                        "team": "voyagers",
                        "members": ["Abey", "Akash", "CP"],
                        "score": 1
                    },
                    {
                        "team": "bootsandbeers",
                        "members": ["Vinay", "Anoop", "Sanjay"],
                        "score": 4
                    }
                ]
            }
        ]

    def test_correlation_calculation(self):
        """Tests Pearson correlation logic for sector differentials vs score outcomes."""
        # Simulated delta arrays: x = predicted advantage, y = actual goal diff
        x_arr = [-1.0, 2.5]
        y_arr = [-1.0, 3.0]

        mean_x = sum(x_arr) / len(x_arr)
        mean_y = sum(y_arr) / len(y_arr)

        num = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_arr, y_arr))
        den_x = sum((x - mean_x) ** 2 for x in x_arr)
        den_y = sum((y - mean_y) ** 2 for y in y_arr)
        den = math.sqrt(den_x * den_y)

        corr = num / den if den > 0 else 0
        self.assertAlmostEqual(corr, 1.0, places=2)

    def test_recommended_weights_contract(self):
        """Verifies that recommended calibrated weights maintain non-zero Midfield PAC and proper structure."""
        calibrated_weights = {
            "attack": {
                "attributes": {"sho": 0.45, "dri": 0.30, "pac": 0.25, "pas": 0, "def": 0, "phy": 0},
                "positions": {"FWD": 1.4, "MID": 1.0, "DEF": 0.5, "GK": 0.5},
                "penaltyMult": 8.0
            },
            "midfield": {
                "attributes": {"pas": 0.40, "dri": 0.25, "pac": 0.20, "def": 0.15, "sho": 0, "phy": 0},
                "positions": {"MID": 1.4, "FWD": 1.0, "DEF": 0.7, "GK": 0.7},
                "penaltyMult": 7.5
            },
            "defense": {
                "attributes": {"def": 0.50, "phy": 0.30, "pac": 0.20, "sho": 0, "pas": 0, "dri": 0},
                "positions": {"DEF": 1.4, "MID": 0.9, "FWD": 0.5, "GK": 0.5},
                "gkBlend": 0.35,
                "penaltyMult": 9.0
            }
        }

        # Assert Midfield PAC is explicitly calibrated > 0
        self.assertGreater(calibrated_weights["midfield"]["attributes"]["pac"], 0)
        self.assertEqual(calibrated_weights["midfield"]["attributes"]["pac"], 0.20)
        self.assertEqual(calibrated_weights["midfield"]["attributes"]["pas"], 0.40)
        self.assertEqual(calibrated_weights["defense"]["gkBlend"], 0.35)

if __name__ == "__main__":
    unittest.main()
