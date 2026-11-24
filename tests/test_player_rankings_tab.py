import json
import os
import unittest


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestPlayerRankingsTab(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(REPO_ROOT, "index.html"), "r", encoding="utf-8") as f:
            self.index_html = f.read()
        with open(os.path.join(REPO_ROOT, "src", "services", "leagueService.js"), "r", encoding="utf-8") as f:
            self.league_js = f.read()
        with open(os.path.join(REPO_ROOT, "src", "app.js"), "r", encoding="utf-8") as f:
            self.app_js = f.read()

    def test_index_html_has_rankings_tab_and_containers(self):
        for token in (
            'id="btn-roster-view-rankings"',
            'id="roster-rankings-container"',
            'id="roster-rankings-podiums"',
            'id="roster-rankings-table-body"',
            'id="btn-ranking-window-all"',
            'id="btn-ranking-window-last8"',
            'data-ranking-min="3"',
            'data-ranking-min="5"',
        ):
            self.assertIn(token, self.index_html)

    def test_league_service_exports_position_player_rankings(self):
        for token in (
            "export function computePositionPlayerRankings(",
            "topAttackers:",
            "topMidfielders:",
            "topDefenders:",
            "leagueAvgGF",
            "leagueAvgGA",
            "rankDeltaVsOvr",
        ):
            self.assertIn(token, self.league_js)

    def test_app_js_wires_rankings_tab_and_renderer(self):
        for token in (
            "computePositionPlayerRankings",
            'btn-roster-view-rankings',
            "function renderPlayerRankingsView(",
            "Top Attackers (FWD)",
            "Top Midfielders (MID)",
            "Top Defenders (DEF)",
        ):
            self.assertIn(token, self.app_js)

    def test_real_dataset_produces_top3_per_sector(self):
        with open(os.path.join(REPO_ROOT, "data", "players.json"), "r", encoding="utf-8") as f:
            players = json.load(f)
        with open(os.path.join(REPO_ROOT, "data", "league_matches_cache.json"), "r", encoding="utf-8") as f:
            matches = json.load(f).get("matches", [])

        appeared = set()
        for m in matches:
            for t in m.get("teams", []):
                for mem in t.get("members", []):
                    appeared.add(mem.strip().lower())

        for pos in ("FWD", "MID", "DEF"):
            active_in_pos = [p for p in players if p.get("position") == pos and p["name"].strip().lower() in appeared]
            self.assertGreaterEqual(len(active_in_pos), 3, f"Expected >= 3 active {pos} players in match history")


if __name__ == "__main__":
    unittest.main(verbosity=2)
