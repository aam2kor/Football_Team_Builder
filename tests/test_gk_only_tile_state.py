import os
import unittest

from tests.test_8v8_1331_rotating_plan import (
    PLAYER_BY_NAME,
    Test8v81331RotatingPlan,
    build_balanced_teams,
)


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestGkOnlyTileState(unittest.TestCase):
    def test_ui_and_engine_support_three_state_gk_role(self):
        with open(os.path.join(REPO_ROOT, "src", "app.js"), "r", encoding="utf-8") as f:
            app_js = f.read()
        with open(os.path.join(REPO_ROOT, "src", "engine", "formations.js"), "r", encoding="utf-8") as f:
            formations_js = f.read()
        with open(os.path.join(REPO_ROOT, "src", "engine", "balancer.js"), "r", encoding="utf-8") as f:
            balancer_js = f.read()

        self.assertIn("📌 GK Only", app_js)
        self.assertIn("otherGkOnlyCount >= 2", app_js)
        self.assertIn('gkRole === "gk_only"', formations_js)
        self.assertIn("sameTeamGkOnlyPenalty", balancer_js)
        self.assertIn("gkOnlyPlayers.length === 2", balancer_js)

    def test_two_gk_only_players_are_split_one_per_team(self):
        sanjay_id = PLAYER_BY_NAME["Sanjay"]["id"]
        anup_id = PLAYER_BY_NAME["Anup"]["id"]
        res = build_balanced_teams(
            Test8v81331RotatingPlan.STANDARD_16,
            {
                "mode": "balanced",
                "gkMode": "rotating",
                "constraints": {"pinnedPositions": {sanjay_id: "GK", anup_id: "GK"}},
                "topK": 1,
            },
        )
        best = res[0]
        team_a_ids = {p["id"] for p in best["assignedTeamA"]}
        team_b_ids = {p["id"] for p in best["assignedTeamB"]}
        self.assertNotEqual(sanjay_id in team_a_ids, anup_id in team_a_ids)
        self.assertTrue((sanjay_id in team_a_ids and anup_id in team_b_ids) or (anup_id in team_a_ids and sanjay_id in team_b_ids))
        self.assertTrue(best["statsA"]["hasPinnedGk"])
        self.assertTrue(best["statsB"]["hasPinnedGk"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
