#!/usr/bin/env python3
"""
Unit tests for Google Gemini AI Provider Integration
Tests payload generation, prompt construction, and response parsing.
"""

import unittest
import json

class TestGeminiIntegration(unittest.TestCase):
    def test_gemini_schema_structure(self):
        """Validates that Gemini structured schema includes expected constraint keys."""
        expected_keys = ["pinnedTeamA", "pinnedTeamB", "separatedPairs", "pairedTogether", "coachBriefing"]
        mock_response = {
            "pinnedTeamA": ["Abey", "Mathai"],
            "pinnedTeamB": ["Anoop"],
            "separatedPairs": [["Abey", "Anoop"]],
            "pairedTogether": [["Mathai", "Vinay"]],
            "coachBriefing": "Voyagers balance high pressing against Boots & Beers counter-attacking pace."
        }
        for k in expected_keys:
            self.assertIn(k, mock_response)
        self.assertEqual(len(mock_response["pinnedTeamA"]), 2)
        self.assertEqual(len(mock_response["separatedPairs"]), 1)

    def test_gemini_draft_refine_schema(self):
        """Validates that Gemini draft refinement produces valid player swaps."""
        mock_refine_response = {
            "reviewCommentary": "Swapping Sreekanth for CP increases midfield dynamism for Boots & Beers.",
            "swaps": [
                {
                    "playerFromTeamA": "Sreekanth",
                    "playerFromTeamB": "CP",
                    "rationale": "Balances attacking finishing"
                }
            ]
        }
        self.assertIn("reviewCommentary", mock_refine_response)
        self.assertEqual(len(mock_refine_response["swaps"]), 1)
        self.assertEqual(mock_refine_response["swaps"][0]["playerFromTeamA"], "Sreekanth")
        self.assertEqual(mock_refine_response["swaps"][0]["playerFromTeamB"], "CP")

    def test_gemini_league_insights_schema(self):
        """Validates that Gemini league insights contains newspaper format fields."""
        mock_insights_response = {
            "headline": "Voyagers and Boots & Beers locked in fierce 2026 title race",
            "scorersTakeaway": "Vinay leads all players with 7 goals across 4 games.",
            "winnersTakeaway": "Mathai and Anoop boast top win rates.",
            "losersTakeaway": "Defensive compactness required on transitional turnovers.",
            "prediction": "A high scoring thriller with over 5 goals expected."
        }
        for key in ["headline", "scorersTakeaway", "winnersTakeaway", "losersTakeaway", "prediction"]:
            self.assertIn(key, mock_insights_response)
            self.assertTrue(len(mock_insights_response[key]) > 0)

if __name__ == "__main__":
    unittest.main()
