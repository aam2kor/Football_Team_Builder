import os
import unittest


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestBalanceFeedbackInReports(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(REPO_ROOT, "src", "services", "leagueService.js"), "r", encoding="utf-8") as f:
            self.league_js = f.read()
        with open(os.path.join(REPO_ROOT, "src", "ai", "geminiClient.js"), "r", encoding="utf-8") as f:
            self.gemini_js = f.read()

    def test_format_league_summary_includes_balance_feedback_and_upset_record(self):
        self.assertIn("Team Balance Feedback: ATT", self.league_js)
        self.assertIn("Team Balance Feedback Record: Favorites", self.league_js)

    def test_validate_balancer_model_tracks_recorded_balance_feedback(self):
        for token in (
            "balanceFeedbackMatches",
            "feedbackAlignmentRate",
            "feedbackMeanError",
            "recordedBalance",
            "Compared against recorded team balance feedback",
        ):
            self.assertIn(token, self.league_js)

    def test_moneyball_and_form_trajectory_include_balance_context(self):
        self.assertIn("balanceTiltAdjustment", self.league_js)
        self.assertIn("balanceContext: bc", self.league_js)
        self.assertIn("balanceLabel", self.league_js)

    def test_gemini_prompts_include_balance_feedback(self):
        self.assertIn("Team Balance Feedback", self.gemini_js)
        self.assertIn("recentMatchesWithBalance", self.gemini_js)
        self.assertIn("RECENT MATCH TEAM BALANCE FEEDBACK:", self.gemini_js)


if __name__ == "__main__":
    unittest.main()
