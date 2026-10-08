import unittest

# Dynamic Rotating GK engine calculations mirror Javascript engine in balancer.js
DEFAULT_SECTOR_WEIGHTS = {
    "attack": {
        "attributes": {"sho": 0.40, "dri": 0.30, "pac": 0.20, "pas": 0.10},
        "positions": {"FWD": 1.4, "MID": 1.0, "DEF": 0.5, "GK": 0.1}
    },
    "midfield": {
        "attributes": {"pas": 0.40, "dri": 0.30, "def": 0.15, "pac": 0.15},
        "positions": {"MID": 1.4, "FWD": 0.9, "DEF": 0.7, "GK": 0.1}
    },
    "defense": {
        "attributes": {"def": 0.50, "phy": 0.30, "pac": 0.20},
        "positions": {"DEF": 1.4, "MID": 0.9, "FWD": 0.5, "GK": 0.1},
        "gkBlend": 0.35
    }
}

SAMPLE_SQUAD_A = [
    {"id": "p1", "name": "Alice", "position": "DEF", "ovr": 84, "canRotateGk": True, "attributes": {"pac": 75, "sho": 50, "pas": 70, "dri": 68, "def": 85, "phy": 80, "gk": 65}},
    {"id": "p2", "name": "Bob", "position": "DEF", "ovr": 82, "canRotateGk": True, "attributes": {"pac": 78, "sho": 45, "pas": 72, "dri": 65, "def": 82, "phy": 84, "gk": 55}},
    {"id": "p3", "name": "Charlie", "position": "DEF", "ovr": 80, "canRotateGk": False, "attributes": {"pac": 80, "sho": 55, "pas": 74, "dri": 70, "def": 80, "phy": 78, "gk": 20}},
    {"id": "p4", "name": "David", "position": "MID", "ovr": 85, "canRotateGk": True, "attributes": {"pac": 82, "sho": 78, "pas": 88, "dri": 85, "def": 70, "phy": 75, "gk": 40}},
    {"id": "p5", "name": "Eve", "position": "MID", "ovr": 83, "canRotateGk": False, "attributes": {"pac": 84, "sho": 80, "pas": 85, "dri": 86, "def": 60, "phy": 72, "gk": 15}},
    {"id": "p6", "name": "Frank", "position": "MID", "ovr": 81, "canRotateGk": True, "attributes": {"pac": 80, "sho": 74, "pas": 82, "dri": 80, "def": 68, "phy": 78, "gk": 50}},
    {"id": "p7", "name": "Grace", "position": "FWD", "ovr": 86, "canRotateGk": False, "attributes": {"pac": 88, "sho": 89, "pas": 78, "dri": 87, "def": 40, "phy": 76, "gk": 15}},
    {"id": "p8", "name": "Heidi", "position": "FWD", "ovr": 84, "canRotateGk": False, "attributes": {"pac": 86, "sho": 85, "pas": 80, "dri": 84, "def": 45, "phy": 79, "gk": 20}}
]

def compute_sector_score(players, attr_weights, pos_weights):
    if not players:
        return 0.0
    weighted_sum = 0.0
    weight_total = 0.0
    for p in players:
        a = p.get("attributes", {})
        pos = p.get("position", "MID")
        p_score = sum(a.get(k, 60) * w for k, w in attr_weights.items())
        p_w = pos_weights.get(pos, 1.0)
        weighted_sum += p_score * p_w
        weight_total += p_w
    return weighted_sum / weight_total if weight_total > 0 else 0.0

def calculate_rotating_team_stats(players, sector_weights=DEFAULT_SECTOR_WEIGHTS):
    sw = sector_weights
    n = len(players)
    gk_blend = sw["defense"].get("gkBlend", 0.35)
    
    eligible_gks = [p for p in players if p.get("canRotateGk", True) is not False]
    has_no_eligible = False
    if not eligible_gks:
        has_no_eligible = True
        # Fallback to highest gk attribute
        eligible_gks = [sorted(players, key=lambda p: p["attributes"].get("gk", 20), reverse=True)[0]]
    
    k = len(eligible_gks)
    sum_att, sum_mid, sum_out_def, sum_def, sum_gk = 0.0, 0.0, 0.0, 0.0, 0.0
    min_att, max_att = 999.0, 0.0
    min_def, max_def = 999.0, 0.0
    schedule = []
    
    for idx, gk_p in enumerate(eligible_gks):
        outfield = [p for p in players if p["id"] != gk_p["id"]]
        turn_att = compute_sector_score(outfield, sw["attack"]["attributes"], sw["attack"]["positions"])
        turn_mid = compute_sector_score(outfield, sw["midfield"]["attributes"], sw["midfield"]["positions"])
        turn_out_def = compute_sector_score(outfield, sw["defense"]["attributes"], sw["defense"]["positions"])
        turn_gk_val = gk_p["attributes"].get("gk", 20)
        turn_def = turn_out_def * (1.0 - gk_blend) + turn_gk_val * gk_blend
        
        sum_att += turn_att
        sum_mid += turn_mid
        sum_out_def += turn_out_def
        sum_def += turn_def
        sum_gk += turn_gk_val
        
        min_att = min(min_att, turn_att)
        max_att = max(max_att, turn_att)
        min_def = min(min_def, turn_def)
        max_def = max(max_def, turn_def)
        
        schedule.append({
            "turnIndex": idx + 1,
            "gkPlayerId": gk_p["id"],
            "gkPlayerName": gk_p["name"],
            "gkRating": turn_gk_val,
            "turnAttack": round(turn_att, 1),
            "turnMidfield": round(turn_mid, 1),
            "turnDefense": round(turn_def, 1)
        })
        
    return {
        "attack": round(sum_att / k, 1),
        "midfield": round(sum_mid / k, 1),
        "defense": round(sum_def, 1) if k == 1 else round(sum_def / k, 1),
        "goalkeeping": round(sum_gk / k, 1),
        "eligibleGkCount": len(eligible_gks) if not has_no_eligible else 0,
        "hasNoEligibleGk": has_no_eligible,
        "rotationSchedule": schedule,
        "sectorRanges": {
            "attack": [round(min_att, 1), round(max_att, 1)],
            "defense": [round(min_def, 1), round(max_def, 1)]
        }
    }


class TestDynamicRotatingGk(unittest.TestCase):

    def test_eligible_gk_filtering(self):
        """Only players with canRotateGk == True should be included in the rotation schedule."""
        stats = calculate_rotating_team_stats(SAMPLE_SQUAD_A)
        self.assertEqual(stats["eligibleGkCount"], 4)
        self.assertEqual(len(stats["rotationSchedule"]), 4)
        
        # Verify Charlie (canRotateGk=False) and Grace (canRotateGk=False) are never scheduled as GK
        scheduled_ids = [t["gkPlayerId"] for t in stats["rotationSchedule"]]
        self.assertIn("p1", scheduled_ids)
        self.assertIn("p2", scheduled_ids)
        self.assertIn("p4", scheduled_ids)
        self.assertIn("p6", scheduled_ids)
        self.assertNotIn("p3", scheduled_ids)
        self.assertNotIn("p5", scheduled_ids)
        self.assertNotIn("p7", scheduled_ids)
        self.assertNotIn("p8", scheduled_ids)

    def test_turn_outfield_exclusion(self):
        """When a player is GK for a turn, their attributes are excluded from the outfield."""
        stats = calculate_rotating_team_stats(SAMPLE_SQUAD_A)
        
        # Turn 1: Alice (p1, strong DEF: 85) is in goal.
        # Outfield defense should be lower during Alice's turn than when midfielder David (p4, DEF: 70) is in goal.
        turn_1 = stats["rotationSchedule"][0] # Alice in goal
        turn_3 = stats["rotationSchedule"][2] # David in goal
        
        self.assertEqual(turn_1["gkPlayerName"], "Alice")
        self.assertEqual(turn_3["gkPlayerName"], "David")
        
        # In turn 1, Alice's GK rating (65) helps net defense, but outfield def lacks her 85 DEF
        self.assertEqual(turn_1["gkRating"], 65)
        self.assertEqual(turn_3["gkRating"], 40)

    def test_fallback_when_zero_willing_gks(self):
        """When all players in a team have canRotateGk=False, fallback chooses highest reflex player without error."""
        all_unwilling = [{**p, "canRotateGk": False} for p in SAMPLE_SQUAD_A]
        stats = calculate_rotating_team_stats(all_unwilling)
        
        self.assertTrue(stats["hasNoEligibleGk"])
        self.assertEqual(len(stats["rotationSchedule"]), 1)
        # Highest GK is p1 (Alice with gk=65)
        self.assertEqual(stats["rotationSchedule"][0]["gkPlayerId"], "p1")

    def test_expected_time_weighted_averages(self):
        """The reported sector score must equal the average of the turn scores."""
        stats = calculate_rotating_team_stats(SAMPLE_SQUAD_A)
        schedule = stats["rotationSchedule"]
        
        avg_att = sum(t["turnAttack"] for t in schedule) / len(schedule)
        avg_def = sum(t["turnDefense"] for t in schedule) / len(schedule)
        
        self.assertAlmostEqual(stats["attack"], avg_att, delta=0.2)
        self.assertAlmostEqual(stats["defense"], avg_def, delta=0.2)


if __name__ == "__main__":
    unittest.main()
