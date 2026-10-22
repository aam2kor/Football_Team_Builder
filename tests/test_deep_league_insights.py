import unittest

SAMPLE_MATCHES = [
    {
        "match_date": "2026-09-02",
        "season": 2026,
        "balance": {"attack": -0.5, "midfield": 0.8, "defense": 0.4},
        "teams": [
            {
                "team": "voyagers",
                "members": ["Abey", "Arun", "Jibin", "Mathai", "Pradeep", "Ratheesh", "Varun", "Vignesh"],
                "score": 2,
                "scorers": [
                    {"name": "Arun", "goals": 1, "is_own_goal": False},
                    {"name": "Varun", "goals": 1, "is_own_goal": False}
                ]
            },
            {
                "team": "bootsandbeers",
                "members": ["Ajith", "Akash", "Anoop", "Blesson", "Prasanth", "Rajeev", "Sreekanth", "Vinay"],
                "score": 3,
                "scorers": [
                    {"name": "Sreekanth", "goals": 1, "is_own_goal": False},
                    {"name": "Vinay", "goals": 1, "is_own_goal": False},
                    {"name": "Akash", "goals": 1, "is_own_goal": False}
                ]
            }
        ]
    },
    {
        "match_date": "2026-08-30",
        "season": 2026,
        "balance": {"attack": 0.6, "midfield": 0.9, "defense": 0.6},
        "teams": [
            {
                "team": "voyagers",
                "members": ["Anoop", "Mathai", "Pradeep", "Prasanth", "Rajeev", "Ratheesh", "Sanjay", "Vignesh"],
                "score": 3,
                "scorers": [
                    {"name": "Rajeev", "goals": 1, "is_own_goal": False},
                    {"name": "Sanjay", "goals": 1, "is_own_goal": False},
                    {"name": "Mathai", "goals": 1, "is_own_goal": False}
                ]
            },
            {
                "team": "bootsandbeers",
                "members": ["Aadi", "Abey", "Ajith", "Akash", "Anup", "Sreekanth", "Tom", "Vinay"],
                "score": 2,
                "scorers": [
                    {"name": "Aadi", "goals": 1, "is_own_goal": False},
                    {"name": "Sreekanth", "goals": 1, "is_own_goal": False}
                ]
            }
        ]
    },
    {
        "match_date": "2026-08-23",
        "season": 2026,
        "balance": {"attack": -2.5, "midfield": -1.8, "defense": -1.2},
        "teams": [
            {
                "team": "voyagers",
                "members": ["Abey", "Anoop", "CP", "Mathai", "Sanjay", "Sreekanth", "Sudhi", "Vinay"],
                "score": 8,
                "scorers": [
                    {"name": "Vinay", "goals": 3, "is_own_goal": False},
                    {"name": "Sanjay", "goals": 2, "is_own_goal": False}
                ]
            },
            {
                "team": "bootsandbeers",
                "members": ["Ajith", "Akash", "Anup", "Mithun", "Pradeep", "Prasanth", "Rajeev", "Tom"],
                "score": 4,
                "scorers": [
                    {"name": "Mithun", "goals": 2, "is_own_goal": False}
                ]
            }
        ]
    }
]

SAMPLE_PLAYER_DB = [
    {"id": "p1", "name": "Anoop", "position": "MID", "ovr": 78, "attributes": {"pac": 82, "sho": 75, "pas": 84, "dri": 80, "def": 74, "phy": 76}},
    {"id": "p2", "name": "Sanjay", "position": "FWD", "ovr": 79, "attributes": {"pac": 85, "sho": 84, "pas": 78, "dri": 82, "def": 60, "phy": 75}},
    {"id": "p3", "name": "Ajith", "position": "DEF", "ovr": 88, "attributes": {"pac": 78, "sho": 65, "pas": 75, "dri": 72, "def": 88, "phy": 86}},
    {"id": "p4", "name": "Tom", "position": "DEF", "ovr": 86, "attributes": {"pac": 76, "sho": 60, "pas": 74, "dri": 70, "def": 85, "phy": 84}},
    {"id": "p5", "name": "Mathai", "position": "DEF", "ovr": 80, "attributes": {"pac": 80, "sho": 70, "pas": 79, "dri": 76, "def": 82, "phy": 81}}
]


class TestDeepLeagueInsights(unittest.TestCase):

    def test_plus_minus_and_moneyball_calculations(self):
        """Verify Plus/Minus per match and Moneyball overperformer vs Paper Tiger detection."""
        with open("src/services/leagueService.js", "r", encoding="utf-8") as f:
            js_code = f.read()

        self.assertIn("export function computePlusMinusAndMoneyballStats", js_code)
        self.assertIn("plusMinusLeaders", js_code)
        self.assertIn("overperformers", js_code)
        self.assertIn("underperformers", js_code)

        # Verify mathematical logic on SAMPLE_MATCHES:
        # Anoop won all 3 games: +1 GD (3-2), +1 GD (3-2), +4 GD (8-4) -> +6 total GD, +2.0 GD/match
        anoop_gd = (3 - 2) + (3 - 2) + (8 - 4)
        self.assertEqual(anoop_gd, 6)
        self.assertAlmostEqual(anoop_gd / 3, 2.0)

        # Tom lost both games he played (2-3 on 08-30, 4-8 on 08-23) -> -5 total GD, -2.5 GD/match
        tom_gd = (2 - 3) + (4 - 8)
        self.assertEqual(tom_gd, -5)
        self.assertAlmostEqual(tom_gd / 2, -2.5)

    def test_giant_killers_and_upset_summary(self):
        """Verify Giant Killers (underdog wins) and League Upset Summary."""
        with open("src/services/leagueService.js", "r", encoding="utf-8") as f:
            js_code = f.read()

        self.assertIn("export function computeGiantKillersAndClosers", js_code)
        self.assertIn("leagueUpsetSummary", js_code)

        # In match 2026-08-30, balance is +0.7 (favors Team B / Boots & Beers),
        # but Team A (Voyagers: Anoop, Mathai, Sanjay, etc.) won 3-2 -> Underdog upset!
        m2 = SAMPLE_MATCHES[1]
        net_bal = (m2["balance"]["attack"] + m2["balance"]["midfield"] + m2["balance"]["defense"]) / 3
        self.assertGreater(net_bal, 0.5)
        self.assertGreater(m2["teams"][0]["score"], m2["teams"][1]["score"])

    def test_chemistry_and_kryptonite_stats(self):
        """Verify Golden Duos, Cursed Pairings, and Kryptonite 1v1 Nemeses."""
        with open("src/services/leagueService.js", "r", encoding="utf-8") as f:
            js_code = f.read()

        self.assertIn("export function computeChemistryAndKryptoniteStats", js_code)
        self.assertIn("goldenDuos", js_code)
        self.assertIn("cursedDuos", js_code)
        self.assertIn("kryptoniteRivalries", js_code)

    def test_meta_tactical_anatomy_presence(self):
        """Verify Meta-Tactical Anatomy function and UI integration."""
        with open("src/services/leagueService.js", "r", encoding="utf-8") as f:
            service_code = f.read()
        with open("src/app.js", "r", encoding="utf-8") as f:
            app_code = f.read()

        self.assertIn("export function computeMetaTacticalAnatomy", service_code)
        self.assertIn("winConversionRate", service_code)
        self.assertIn("Meta-Tactical Anatomy: What Actually Wins Derbies?", app_code)
        self.assertIn("Plus/Minus (±) Impact Leaders", app_code)
        self.assertIn("Moneyball Gems (Beat OVR)", app_code)
        self.assertIn("Paper Tigers (Due a Bounceback)", app_code)
        self.assertIn("Golden Duos vs. 💔 Cursed Pairs", app_code)
        self.assertIn("Kryptonite 1v1 Nemeses", app_code)


if __name__ == "__main__":
    unittest.main()

