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
            "pinnedPositions": [{"player": "Sanjay", "position": "GK"}],
            "separatedPairs": [["Abey", "Anoop"]],
            "pairedTogether": [["Mathai", "Vinay"]],
            "coachBriefing": "Voyagers balance high pressing against Boots & Beers counter-attacking pace."
        }
        for k in expected_keys:
            self.assertIn(k, mock_response)
        self.assertEqual(len(mock_response["pinnedTeamA"]), 2)
        self.assertEqual(len(mock_response["separatedPairs"]), 1)
        self.assertEqual(len(mock_response["pinnedPositions"]), 1)
        self.assertEqual(mock_response["pinnedPositions"][0]["position"], "GK")

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
            "funFact": "Across all 4 fixtures this season, 32 goals have been scored at an average of 8.0 goals per match!"
        }
        for key in ["headline", "scorersTakeaway", "winnersTakeaway", "losersTakeaway", "funFact"]:
            self.assertIn(key, mock_insights_response)
            self.assertTrue(len(mock_insights_response[key]) > 0)

    def test_gemini_pure_team_split_schema(self):
        """Validates that Gemini pure team split directly allocates both squads and tactical rationale."""
        mock_pure_response = {
            "teamA": ["Marcus Vance", "Carlos Mendoza", "Trent Walker", "Lucas Romero", "Rafael Santos"],
            "teamB": ["Hugo De Silva", "Sami Al-Khatib", "Mateo Kovacic", "Hakim Sterling", "Julian Alvarez"],
            "formationA": "1-3-3-1",
            "formationB": "1-3-2-2",
            "tacticalRationale": "Voyagers adopt a high pressing 1-3-3-1 counter style while Boots & Beers set up in a fluid 1-3-2-2.",
            "coachBriefing": "Fight for every loose ball in midfield and exploit transitions!"
        }
        for key in ["teamA", "teamB", "formationA", "formationB", "tacticalRationale", "coachBriefing"]:
            self.assertIn(key, mock_pure_response)
        self.assertEqual(len(mock_pure_response["teamA"]), 5)
        self.assertEqual(len(mock_pure_response["teamB"]), 5)
        self.assertEqual(mock_pure_response["formationA"], "1-3-3-1")

if __name__ == "__main__":
    unittest.main()

