#!/usr/bin/env python3
"""
Test Suite: Thorough Testing of Balanced Team Builder
Specification:
- Format: 8v8 (16 selected players partitioned into two teams of 8)
- Target Formation: 1-3-3-1 (Classic Balanced: GK, LB, CB, RB, LM, CM, RM, ST)
- GK Mode: Rotating GK (Dynamic turn-by-turn with time-weighted sector contributions)
- Sector Weights: Calibrated Sector Weights (from data/sector_weights.json)
"""

import unittest
import json
import os
import math
import itertools

# -------------------------------------------------------------
# 1. Load Calibrated Sector Weights and Real Players Dataset
# -------------------------------------------------------------
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

with open(os.path.join(DATA_DIR, "sector_weights.json"), "r") as f:
    CALIBRATED_SECTOR_WEIGHTS = json.load(f)

with open(os.path.join(DATA_DIR, "players.json"), "r") as f:
    PLAYER_DATABASE = json.load(f)

# 1-3-3-1 Formation Specification (8v8)
FORMATION_1331 = {
    "name": "1-3-3-1 (Classic Balanced)",
    "slots": [
        {"role": "GK", "label": "GK", "pos": "GK", "x": 50, "y": 10},
        {"role": "LB", "label": "LB", "pos": "DEF", "x": 20, "y": 32},
        {"role": "CB", "label": "CB", "pos": "DEF", "x": 50, "y": 28},
        {"role": "RB", "label": "RB", "pos": "DEF", "x": 80, "y": 32},
        {"role": "LM", "label": "LM", "pos": "MID", "x": 20, "y": 62},
        {"role": "CM", "label": "CM", "pos": "MID", "x": 50, "y": 58},
        {"role": "RM", "label": "RM", "pos": "MID", "x": 80, "y": 62},
        {"role": "ST", "label": "ST", "pos": "FWD", "x": 50, "y": 88}
    ]
}

FORM_MODIFIERS = {
    "hot": 1.08,
    "good": 1.04,
    "neutral": 1.0,
    "cold": 0.94,
    "terrible": 0.88
}

def get_effective_player_stats(player, setting=None):
    setting = setting or {}
    fitness = setting.get("fitness", player.get("fitness", 100))
    form = setting.get("form", player.get("form", "neutral"))
    can_rotate_gk = setting.get("canRotateGk", player.get("canRotateGk", True))
    
    fit_factor = 0.6 + 0.4 * (fitness / 100.0)
    form_factor = FORM_MODIFIERS.get(form, 1.0)
    total_mod = fit_factor * form_factor
    
    raw_attrs = player.get("attributes", {})
    eff_attrs = {}
    for k in ["pac", "sho", "pas", "dri", "def", "phy", "gk"]:
        val = raw_attrs.get(k, 60)
        eff_attrs[k] = round(max(10, min(99, val * total_mod)))
        
    eff_ovr = round(max(40, min(99, player.get("ovr", 75) * total_mod)))
    
    return {
        **player,
        "effectiveOvr": eff_ovr,
        "effectiveAttributes": eff_attrs,
        "fitness": fitness,
        "form": form,
        "canRotateGk": can_rotate_gk is not False
    }

def compute_sector_score(players, attr_weights, pos_weights):
    if not players:
        return 0.0
    weighted_sum = 0.0
    weight_total = 0.0
    for p in players:
        a = p.get("effectiveAttributes", p.get("attributes", {}))
        pos = p.get("matchdayPosition") or p.get("position", "MID")
        p_score = sum(a.get(k, 60) * w for k, w in attr_weights.items())
        p_w = pos_weights.get(pos, 1.0)
        weighted_sum += p_score * p_w
        weight_total += p_w
    return weighted_sum / weight_total if weight_total > 0 else 0.0

def assign_players_to_formation(players, formation, position_constraints=None, matchday_settings_map=None):
    position_constraints = position_constraints or {}
    matchday_settings_map = matchday_settings_map or {}
    slots = formation["slots"]
    unassigned = []
    for p in players:
        m_set = matchday_settings_map.get(p.get("id"), {})
        can_rot = m_set.get("canRotateGk", p.get("canRotateGk", True))
        unassigned.append({**p, "canRotateGk": can_rot is not False})
        
    slot_assignments = [None] * len(slots)
    target_slots = [{"index": i, "slot": s, "pos": s["pos"], "role": s.get("role", s.get("label"))} for i, s in enumerate(slots)]

    is_primary_match = lambda p, pos: p and p.get("position") == pos
    is_secondary_match = lambda p, pos: p and p.get("secondaryPosition") == pos and p.get("secondaryPosition") != p.get("position")

    # Pass 0: Explicit Pinned Constraints
    if position_constraints:
        for s in target_slots:
            if slot_assignments[s["index"]] is not None: continue
            idx = next((i for i, p in enumerate(unassigned) if position_constraints.get(p.get("id")) == s["pos"]), -1)
            if idx != -1:
                slot_assignments[s["index"]] = unassigned.pop(idx)

    # Pass 1: Assign dedicated GK slots
    for s in [ts for ts in target_slots if ts["pos"] == "GK" and slot_assignments[ts["index"]] is None]:
        idx = next((i for i, p in enumerate(unassigned) if is_primary_match(p, "GK")), -1)
        if idx == -1:
            idx = next((i for i, p in enumerate(unassigned) if is_secondary_match(p, "GK")), -1)
        if idx != -1:
            slot_assignments[s["index"]] = unassigned.pop(idx)

    # Pass 1.5: Emergency Goalkeeper Selection
    for s in [ts for ts in target_slots if ts["pos"] == "GK" and slot_assignments[ts["index"]] is None]:
        if unassigned:
            willing = [p for p in unassigned if p.get("canRotateGk", True) is not False]
            pool = willing if willing else unassigned
            non_fwds = [p for p in pool if p.get("position") != "FWD"]
            candidates = non_fwds if non_fwds else pool
            candidates.sort(key=lambda p: (
                p.get("attributes", {}).get("gk", 20),
                p.get("attributes", {}).get("def", 50)
            ), reverse=True)
            chosen = candidates[0]
            idx = unassigned.index(chosen)
            slot_assignments[s["index"]] = unassigned.pop(idx)

    # Pass 2: Assign dedicated primary players to non-GK slots (pure specialists prioritized)
    slot_order = ["FWD", "DEF", "MID"]
    for target_pos in slot_order:
        for s in [ts for ts in target_slots if ts["pos"] == target_pos and slot_assignments[ts["index"]] is None]:
            matches = [p for p in unassigned if is_primary_match(p, target_pos)]
            if matches:
                matches.sort(key=lambda p: (
                    0 if (not p.get("secondaryPosition") or p.get("secondaryPosition") == p.get("position")) else 1,
                    -p.get("ovr", 75)
                ))
                chosen = matches[0]
                idx = unassigned.index(chosen)
                slot_assignments[s["index"]] = unassigned.pop(idx)

    # Pass 3: Fill remaining unfilled slots using Secondary positions
    for target_pos in slot_order:
        for s in [ts for ts in target_slots if ts["pos"] == target_pos and slot_assignments[ts["index"]] is None]:
            matches = [p for p in unassigned if is_secondary_match(p, target_pos)]
            if matches:
                chosen = matches[0]
                idx = unassigned.index(chosen)
                slot_assignments[s["index"]] = unassigned.pop(idx)

    # Pass 4: Fallback for outfield
    for i, s in enumerate(slots):
        if slot_assignments[i] is None and unassigned:
            if s["pos"] == "FWD":
                unassigned.sort(key=lambda p: p.get("attributes", {}).get("sho", 0), reverse=True)
            elif s["pos"] == "DEF":
                unassigned.sort(key=lambda p: p.get("attributes", {}).get("def", 0), reverse=True)
            else:
                unassigned.sort(key=lambda p: p.get("attributes", {}).get("pas", 0), reverse=True)
            slot_assignments[i] = unassigned.pop(0)

    result = []
    for i, s in enumerate(slots):
        raw = slot_assignments[i] or {"name": "TBD", "ovr": 70, "position": s["pos"]}
        is_pinned = bool(position_constraints and position_constraints.get(raw.get("id")) == s["pos"])
        is_pri = raw.get("position") == s["pos"]
        is_sec = not is_pri and raw.get("secondaryPosition") == s["pos"]
        is_emerg_gk = s["pos"] == "GK" and raw.get("position") != "GK" and raw.get("secondaryPosition") != "GK" and not is_pinned
        is_oop = (not is_pri and not is_sec and not is_pinned) or is_emerg_gk
        
        assigned_player = {
            **raw,
            "matchdayPosition": s["pos"],
            "matchdayRole": s.get("role", s.get("label")),
            "isSecondaryRole": is_sec,
            "isOutOfPosition": is_oop,
            "isEmergencyGk": is_emerg_gk,
            "isPinnedRole": is_pinned
        }
        result.append({"slot": s, "player": assigned_player})
    return result

def calculate_team_stats(players, matchday_settings_map=None, sector_weights=None, use_matchday_positions=False, gk_mode="rotating"):
    sw = sector_weights or CALIBRATED_SECTOR_WEIGHTS
    matchday_settings_map = matchday_settings_map or {}
    n = len(players)
    if n == 0:
        return {"effectiveAvgOvr": 0, "attack": 0, "midfield": 0, "defense": 0, "rotationSchedule": [], "eligibleGkCount": 0}

    effective_players = []
    for p in players:
        setting = matchday_settings_map.get(p.get("id"), {})
        eff = get_effective_player_stats(p, setting)
        pos = (p.get("matchdayPosition") if use_matchday_positions and p.get("matchdayPosition") else p.get("position", "MID"))
        eff["position"] = pos
        eff["matchdayPosition"] = p.get("matchdayPosition") if use_matchday_positions else None
        eff["isPinnedRole"] = bool(p.get("isPinnedRole"))
        effective_players.append(eff)

    eff_avg_ovr = round(sum(p["effectiveOvr"] for p in effective_players) / n, 1)
    gk_blend = sw["defense"].get("gkBlend", 0.35)

    pinned_gk_player = next((p for p in effective_players if p.get("isPinnedRole") and p.get("matchdayPosition") == "GK"), None)
    has_pinned_gk = bool(pinned_gk_player)

    rotation_schedule = []
    min_att, max_att = 999.0, 0.0
    min_def, max_def = 999.0, 0.0

    if gk_mode == "rotating" and n >= 2 and not has_pinned_gk:
        eligible_gks = [p for p in effective_players if p.get("canRotateGk") is not False]
        eligible_gk_count = len(eligible_gks)
        has_no_eligible_gk = False
        if not eligible_gks:
            has_no_eligible_gk = True
            eligible_gks = [sorted(effective_players, key=lambda p: p["effectiveAttributes"].get("gk", 20), reverse=True)[0]]

        k = len(eligible_gks)
        sum_att, sum_mid, sum_out_def, sum_def, sum_gk = 0.0, 0.0, 0.0, 0.0, 0.0

        for idx, gk_p in enumerate(eligible_gks):
            outfield = [p for p in effective_players if p["id"] != gk_p["id"]]
            t_att = compute_sector_score(outfield, sw["attack"]["attributes"], sw["attack"]["positions"])
            t_mid = compute_sector_score(outfield, sw["midfield"]["attributes"], sw["midfield"]["positions"])
            t_out_def = compute_sector_score(outfield, sw["defense"]["attributes"], sw["defense"]["positions"])
            t_gk_val = gk_p["effectiveAttributes"].get("gk", 20)
            t_def = t_out_def * (1.0 - gk_blend) + t_gk_val * gk_blend

            sum_att += t_att
            sum_mid += t_mid
            sum_out_def += t_out_def
            sum_def += t_def
            sum_gk += t_gk_val

            min_att = min(min_att, t_att)
            max_att = max(max_att, t_att)
            min_def = min(min_def, t_def)
            max_def = max(max_def, t_def)

            rotation_schedule.append({
                "turnIndex": idx + 1,
                "gkPlayerId": gk_p["id"],
                "gkPlayerName": gk_p["name"],
                "gkRating": t_gk_val,
                "turnAttack": round(t_att, 1),
                "turnMidfield": round(t_mid, 1),
                "turnDefense": round(t_def, 1)
            })

        attack = round(sum_att / k, 1)
        midfield = round(sum_mid / k, 1)
        outfield_def = round(sum_out_def / k, 1)
        defense = round(sum_def / k, 1)
        goalkeeping = round(sum_gk / k, 1)
    else:
        # Fixed or Pinned Full-Match GK
        designated_gk = pinned_gk_player or next((p for p in effective_players if p.get("position") == "GK" or p.get("matchdayPosition") == "GK"), None) or sorted(effective_players, key=lambda p: p["effectiveAttributes"].get("gk", 20), reverse=True)[0]
        eligible_gk_count = 1
        has_no_eligible_gk = False
        outfield = [p for p in effective_players if p["id"] != designated_gk["id"]] if n > 1 else effective_players
        attack = round(compute_sector_score(outfield, sw["attack"]["attributes"], sw["attack"]["positions"]), 1)
        midfield = round(compute_sector_score(outfield, sw["midfield"]["attributes"], sw["midfield"]["positions"]), 1)
        outfield_def = round(compute_sector_score(outfield, sw["defense"]["attributes"], sw["defense"]["positions"]), 1)
        goalkeeping = designated_gk["effectiveAttributes"].get("gk", 20)
        defense = round(outfield_def * (1.0 - gk_blend) + goalkeeping * gk_blend, 1)
        min_att = max_att = attack
        min_def = max_def = defense
        rotation_schedule.append({
            "turnIndex": 1,
            "turnLabel": "Pinned Full Match" if has_pinned_gk else "Full Match",
            "gkPlayerId": designated_gk["id"],
            "gkPlayerName": designated_gk["name"],
            "gkRating": goalkeeping,
            "turnAttack": attack,
            "turnMidfield": midfield,
            "turnDefense": defense,
            "isPinnedGk": has_pinned_gk
        })

    return {
        "effectiveAvgOvr": eff_avg_ovr,
        "attack": attack,
        "midfield": midfield,
        "defense": defense,
        "outfieldDef": outfield_def,
        "goalkeeping": goalkeeping,
        "pace": round(sum(p["effectiveAttributes"].get("pac", 60) for p in effective_players) / n),
        "physical": round(sum(p["effectiveAttributes"].get("phy", 60) for p in effective_players) / n),
        "rotationSchedule": rotation_schedule,
        "eligibleGkCount": eligible_gk_count,
        "hasNoEligibleGk": has_no_eligible_gk,
        "hasPinnedGk": has_pinned_gk,
        "sectorRanges": {
            "attack": [round(min_att, 1), round(max_att, 1)],
            "defense": [round(min_def, 1), round(max_def, 1)]
        }
    }

def score_team_balance(teamA, teamB, options=None):
    options = options or {}
    sw = options.get("sectorWeights", CALIBRATED_SECTOR_WEIGHTS)
    matchday_settings = options.get("matchdaySettingsMap", {})
    pos_constraints = options.get("constraints", {}).get("pinnedPositions", {})
    
    assigned_slots_A = assign_players_to_formation(teamA, FORMATION_1331, pos_constraints, matchday_settings)
    assigned_slots_B = assign_players_to_formation(teamB, FORMATION_1331, pos_constraints, matchday_settings)
    
    assignedA = [s["player"] for s in assigned_slots_A]
    assignedB = [s["player"] for s in assigned_slots_B]
    
    statsA = calculate_team_stats(assignedA, matchday_settings, sw, use_matchday_positions=True, gk_mode="rotating")
    statsB = calculate_team_stats(assignedB, matchday_settings, sw, use_matchday_positions=True, gk_mode="rotating")
    
    ovr_delta = abs(statsA["effectiveAvgOvr"] - statsB["effectiveAvgOvr"])
    att_delta = abs(statsA["attack"] - statsB["attack"])
    mid_delta = abs(statsA["midfield"] - statsB["midfield"])
    def_delta = abs(statsA["defense"] - statsB["defense"])
    pac_delta = abs(statsA["pace"] - statsB["pace"])
    phy_delta = abs(statsA["physical"] - statsB["physical"])
    
    no_gk_penalty = (400.0 if statsA["hasNoEligibleGk"] else 0) + (400.0 if statsB["hasNoEligibleGk"] else 0)
    rotator_delta = abs(statsA["eligibleGkCount"] - statsB["eligibleGkCount"])
    rotator_disparity_penalty = 0 if (statsA["hasPinnedGk"] or statsB["hasPinnedGk"]) else ((rotator_delta - 2) * 25.0 if rotator_delta > 2 else 0)
    avg_gk_delta = abs(statsA["goalkeeping"] - statsB["goalkeeping"])
    gk_penalty = (avg_gk_delta * 1.5) + no_gk_penalty + rotator_disparity_penalty
    
    out_of_pos_count = sum(1 for p in assignedA if p["isOutOfPosition"]) + sum(1 for p in assignedB if p["isOutOfPosition"])
    out_of_pos_penalty = out_of_pos_count * 75.0
    
    ovr_mult = sw.get("overall", {}).get("penaltyMult", 0.0)
    att_mult = sw.get("attack", {}).get("penaltyMult", 10.0)
    mid_mult = sw.get("midfield", {}).get("penaltyMult", 10.0)
    def_mult = sw.get("defense", {}).get("penaltyMult", 10.0)
    pac_mult = sw.get("pace", {}).get("penaltyMult", 10.0)
    phy_mult = sw.get("physical", {}).get("penaltyMult", 0.0)
    
    penalty = (ovr_delta * ovr_mult) + (att_delta * att_mult) + (mid_delta * mid_mult) + (def_delta * def_mult) + (pac_delta * pac_mult) + (phy_delta * phy_mult) + (gk_penalty * 2.0) + out_of_pos_penalty
    total_weight = max(1.0, ovr_mult + att_mult + mid_mult + def_mult + pac_mult + phy_mult)
    weighted_avg_delta = penalty / total_weight
    fairness_score = max(50, min(100, round(50 + 50 * math.exp(-0.18 * weighted_avg_delta))))
    
    return {
        "penalty": penalty,
        "fairnessScore": fairness_score,
        "statsA": statsA,
        "statsB": statsB,
        "assignedSlotsA": assigned_slots_A,
        "assignedSlotsB": assigned_slots_B,
        "deltas": {
            "attack": att_delta,
            "midfield": mid_delta,
            "defense": def_delta,
            "ovr": ovr_delta,
            "pace": pac_delta,
            "physical": phy_delta
        }
    }


# =============================================================
# UNIT TEST CLASS: 9 COMPREHENSIVE SUITES
# =============================================================
class TestBalancedBuilder1331Rotating(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # 16 standard league active players
        cls.core_player_names = [
            "Sanjay", "CP", "Vinay", "Mithun", "Amal", "Abey", "Sreekanth", "Prasanth",
            "Antony", "Joshua", "Jibin", "Mathai", "Rajeev", "Ratheesh", "Vignesh", "Carlton"
        ]
        cls.squad = [next(p for p in PLAYER_DATABASE if p["name"] == name) for name in cls.core_player_names]
        assert len(cls.squad) == 16, f"Expected 16 core players, got {len(cls.squad)}"

    # ---------------------------------------------------------
    # SUITE 1: Position Preference & Natural Role Enforcement
    # ---------------------------------------------------------
    def test_suite_1_primary_position_preference_alignment(self):
        """Natural Strikers -> ST, Natural Defenders -> DEF, Natural Midfielders -> MID in 1-3-3-1."""
        # Use an 8-player squad tailored with natural distribution (3 DEF, 3 MID, 1 FWD, 1 flex)
        custom_names = ["Abey", "Prasanth", "Antony", "Sanjay", "Amal", "Rajeev", "Mithun", "Jibin"]
        team = [next(p for p in PLAYER_DATABASE if p["name"] == n) for n in custom_names]
        
        assigned = assign_players_to_formation(team, FORMATION_1331)
        slot_map = {item["slot"]["role"]: item["player"] for item in assigned}
        
        # ST must be filled by natural FWD Mithun
        st_player = slot_map["ST"]
        self.assertEqual(st_player["position"], "FWD")
        self.assertEqual(st_player["name"], "Mithun")
        
        # DEF slots must be filled by natural DEF
        for def_role in ["LB", "CB", "RB"]:
            p = slot_map[def_role]
            self.assertEqual(p["position"], "DEF", f"{def_role} role must be DEF, got {p['position']} ({p['name']})")
            
        # MID slots must be filled by natural MID
        for mid_role in ["LM", "CM", "RM"]:
            p = slot_map[mid_role]
            self.assertEqual(p["position"], "MID", f"{mid_role} role must be MID, got {p['position']} ({p['name']})")

    def test_suite_1_secondary_position_fallback(self):
        """When short on natural positions, secondary positions are assigned without out-of-position penalties."""
        hybrid_squad = [
            {"id": "f1", "name": "Pure Striker", "position": "FWD", "secondaryPosition": "FWD"},
            {"id": "m1", "name": "Hybrid Def", "position": "MID", "secondaryPosition": "DEF"},
            {"id": "d1", "name": "Pure Def 1", "position": "DEF", "secondaryPosition": "DEF"},
            {"id": "d2", "name": "Pure Def 2", "position": "DEF", "secondaryPosition": "DEF"},
            {"id": "m2", "name": "Pure Mid 1", "position": "MID", "secondaryPosition": "MID"},
            {"id": "m3", "name": "Pure Mid 2", "position": "MID", "secondaryPosition": "MID"},
            {"id": "m4", "name": "Pure Mid 3", "position": "MID", "secondaryPosition": "MID"},
            {"id": "gk_temp", "name": "Keeper", "position": "GK", "secondaryPosition": "GK"}
        ]
        assigned = assign_players_to_formation(hybrid_squad, FORMATION_1331)
        assigned_p = [item["player"] for item in assigned]
        
        m1_assigned = next(p for p in assigned_p if p["id"] == "m1")
        self.assertEqual(m1_assigned["matchdayPosition"], "DEF")
        self.assertTrue(m1_assigned["isSecondaryRole"])
        self.assertFalse(m1_assigned["isOutOfPosition"])

    def test_suite_1_pure_specialist_priority(self):
        """Specialist players are prioritized over versatile hybrids when filling primary positions."""
        test_players = [
            {"id": "mid_pure", "name": "Pure Mid", "position": "MID", "secondaryPosition": "MID", "ovr": 80},
            {"id": "mid_hybrid", "name": "Hybrid Mid/Fwd", "position": "MID", "secondaryPosition": "FWD", "ovr": 85},
            {"id": "def_pure", "name": "Pure Def", "position": "DEF", "secondaryPosition": "DEF", "ovr": 80}
        ]
        mini_formation = {
            "slots": [
                {"role": "CB", "pos": "DEF"},
                {"role": "CM", "pos": "MID"},
                {"role": "ST", "pos": "FWD"}
            ]
        }
        assigned = assign_players_to_formation(test_players, mini_formation)
        p_by_slot = {item["slot"]["pos"]: item["player"] for item in assigned}
        
        self.assertEqual(p_by_slot["DEF"]["id"], "def_pure")
        self.assertEqual(p_by_slot["MID"]["id"], "mid_pure", "Pure specialist must fill MID slot first")
        self.assertEqual(p_by_slot["FWD"]["id"], "mid_hybrid", "Versatile hybrid fills secondary FWD slot perfectly")
        self.assertFalse(p_by_slot["FWD"]["isOutOfPosition"])

    def test_suite_1_outfield_only_enforcement_sanjay_case(self):
        """When Sanjay is set to Outfield Only (canRotateGk = false), he is NEVER placed in GK slot in 1-3-3-1."""
        sanjay = next(p for p in self.squad if p["name"] == "Sanjay")
        settings = {sanjay["id"]: {"canRotateGk": False}}
        
        team = self.squad[:8]
        assigned = assign_players_to_formation(team, FORMATION_1331, matchday_settings_map=settings)
        slot_map = {item["slot"]["role"]: item["player"] for item in assigned}
        
        gk_player = slot_map["GK"]
        self.assertNotEqual(gk_player["id"], sanjay["id"], "Sanjay marked Outfield Only must NOT be in GK slot")
        
        # Verify Sanjay is on outfield in 1-3-3-1
        sanjay_slot = next(item["slot"]["role"] for item in assigned if item["player"]["id"] == sanjay["id"])
        self.assertIn(sanjay_slot, ["LM", "CM", "RM", "LB", "CB", "RB", "ST"])

    # ---------------------------------------------------------
    # SUITE 2: Calibrated Sector Weights & Mathematical Parity
    # ---------------------------------------------------------
    def test_suite_2_calibrated_weights_attribute_sensitivity(self):
        """Verify calibrated weights: ATT (SHO 0.6, DRI 0.4), MID (PAS 0.6, DRI 0.4), DEF (DEF 0.6, PAS 0.4)."""
        sw = CALIBRATED_SECTOR_WEIGHTS
        self.assertEqual(sw["attack"]["attributes"]["sho"], 0.6)
        self.assertEqual(sw["attack"]["attributes"]["dri"], 0.4)
        self.assertEqual(sw["attack"]["attributes"].get("pac", 0), 0)
        self.assertEqual(sw["midfield"]["attributes"]["pas"], 0.6)
        self.assertEqual(sw["midfield"]["attributes"]["dri"], 0.4)
        self.assertEqual(sw["defense"]["attributes"]["def"], 0.6)
        self.assertEqual(sw["defense"]["attributes"]["pas"], 0.4)
        self.assertEqual(sw["defense"]["gkBlend"], 0.35)

    def test_suite_2_balanced_split_parity_under_calibrated_weights(self):
        """Top balanced split from combinatorial search under calibrated weights achieves tight sector parity (delta <= 2.5)."""
        p0 = self.squad[0]
        rest = self.squad[1:]
        combos = itertools.combinations(rest, 7)
        
        best_eval = None
        best_pen = float("inf")
        for c in combos:
            tA = [p0] + list(c)
            tA_ids = {p["id"] for p in tA}
            tB = [p for p in self.squad if p["id"] not in tA_ids]
            ev = score_team_balance(tA, tB, {"sectorWeights": CALIBRATED_SECTOR_WEIGHTS})
            if ev["penalty"] < best_pen:
                best_pen = ev["penalty"]
                best_eval = ev
        
        self.assertIsNotNone(best_eval)
        # Optimal combinatorial split achieves deltas <= 2.5 across ATT, MID, DEF
        self.assertLessEqual(best_eval["deltas"]["attack"], 2.5)
        self.assertLessEqual(best_eval["deltas"]["midfield"], 2.5)
        self.assertLessEqual(best_eval["deltas"]["defense"], 2.5)
        self.assertGreaterEqual(best_eval["fairnessScore"], 70)

    # ---------------------------------------------------------
    # SUITE 3: 1-3-3-1 Positional Slot Mapping & Integrity
    # ---------------------------------------------------------
    def test_suite_3_slot_count_and_roles(self):
        """1-3-3-1 generates exactly 8 slots: GK, LB, CB, RB, LM, CM, RM, ST."""
        assigned = assign_players_to_formation(self.squad[:8], FORMATION_1331)
        roles = [s["slot"]["role"] for s in assigned]
        expected_roles = ["GK", "LB", "CB", "RB", "LM", "CM", "RM", "ST"]
        self.assertEqual(roles, expected_roles)

    # ---------------------------------------------------------
    # SUITE 4: Rotating GK Dynamic Time-Weighted Rotation Matrix
    # ---------------------------------------------------------
    def test_suite_4_dynamic_rotation_schedule_and_expected_averages(self):
        """Expected sector scores in rotating mode must equal the arithmetic mean of all turns."""
        stats = calculate_team_stats(self.squad[:8], sector_weights=CALIBRATED_SECTOR_WEIGHTS, gk_mode="rotating")
        schedule = stats["rotationSchedule"]
        self.assertGreaterEqual(len(schedule), 1)
        
        avg_att = sum(t["turnAttack"] for t in schedule) / len(schedule)
        avg_def = sum(t["turnDefense"] for t in schedule) / len(schedule)
        
        self.assertAlmostEqual(stats["attack"], avg_att, delta=0.2)
        self.assertAlmostEqual(stats["defense"], avg_def, delta=0.2)

    def test_suite_4_turn_defense_blending(self):
        """Turn defense must follow: turnOutfieldDef * 0.65 + gkRating * 0.35."""
        stats = calculate_team_stats(self.squad[:8], sector_weights=CALIBRATED_SECTOR_WEIGHTS, gk_mode="rotating")
        gk_blend = CALIBRATED_SECTOR_WEIGHTS["defense"]["gkBlend"] # 0.35
        self.assertEqual(gk_blend, 0.35)

    # ---------------------------------------------------------
    # SUITE 5: Willing vs Unwilling GK Combinations & Fallback
    # ---------------------------------------------------------
    def test_suite_5_multiple_outfield_only_players(self):
        """Outfield only players are excluded from rotation schedule."""
        settings = {
            self.squad[0]["id"]: {"canRotateGk": False},
            self.squad[1]["id"]: {"canRotateGk": False},
            self.squad[2]["id"]: {"canRotateGk": False}
        }
        stats = calculate_team_stats(self.squad[:8], matchday_settings_map=settings, gk_mode="rotating")
        scheduled_ids = [t["gkPlayerId"] for t in stats["rotationSchedule"]]
        
        self.assertNotIn(self.squad[0]["id"], scheduled_ids)
        self.assertNotIn(self.squad[1]["id"], scheduled_ids)
        self.assertNotIn(self.squad[2]["id"], scheduled_ids)
        self.assertEqual(len(stats["rotationSchedule"]), 5)

    def test_suite_5_all_unwilling_fallback(self):
        """When 100% of squad is unwilling, fallback selects highest reflex defender without crash."""
        all_unwilling = {p["id"]: {"canRotateGk": False} for p in self.squad[:8]}
        stats = calculate_team_stats(self.squad[:8], matchday_settings_map=all_unwilling, gk_mode="rotating")
        self.assertTrue(stats["hasNoEligibleGk"])
        self.assertEqual(len(stats["rotationSchedule"]), 1)

    # ---------------------------------------------------------
    # SUITE 6: Hybrid Mode (Pinned Full-Match GK vs Rotating GK)
    # ---------------------------------------------------------
    def test_suite_6_hybrid_pinned_gk_vs_rotating_team(self):
        """Pinned GK team locks single keeper full match; opposing team rotates all willing keepers."""
        sanjay = next(p for p in self.squad if p["name"] == "Sanjay")
        # Ensure Sanjay is in the team
        team_with_sanjay = [sanjay] + [p for p in self.squad if p["id"] != sanjay["id"]][:7]
        pinned_team = [{**p, "isPinnedRole": (p["id"] == sanjay["id"]), "matchdayPosition": ("GK" if p["id"] == sanjay["id"] else p.get("position", "MID"))} for p in team_with_sanjay]
        
        pinned_stats = calculate_team_stats(pinned_team, use_matchday_positions=True, gk_mode="rotating")
        rotating_stats = calculate_team_stats(self.squad[8:], gk_mode="rotating")
        
        self.assertTrue(pinned_stats["hasPinnedGk"])
        self.assertEqual(len(pinned_stats["rotationSchedule"]), 1)
        self.assertEqual(pinned_stats["rotationSchedule"][0]["turnLabel"], "Pinned Full Match")
        self.assertEqual(pinned_stats["rotationSchedule"][0]["gkPlayerId"], sanjay["id"])
        
        self.assertFalse(rotating_stats["hasPinnedGk"])
        self.assertGreater(len(rotating_stats["rotationSchedule"]), 1)

    # ---------------------------------------------------------
    # SUITE 7: Matchday Form & Fitness Modifiers Propagation
    # ---------------------------------------------------------
    def test_suite_7_form_and_fitness_scaling(self):
        """Form and fitness scale player attributes and propagate into 1-3-3-1 sector score."""
        p_base = self.squad[0]
        base_stats = get_effective_player_stats(p_base, {"fitness": 100, "form": "neutral"})
        hot_stats = get_effective_player_stats(p_base, {"fitness": 100, "form": "hot"})
        cold_stats = get_effective_player_stats(p_base, {"fitness": 50, "form": "cold"})
        
        self.assertGreater(hot_stats["effectiveOvr"], base_stats["effectiveOvr"])
        self.assertLess(cold_stats["effectiveOvr"], base_stats["effectiveOvr"])

    # ---------------------------------------------------------
    # SUITE 8: Pairing & Separation Constraints
    # ---------------------------------------------------------
    def test_suite_8_pair_and_separation_constraints(self):
        """Paired players must share same team; separated players must be on opposite teams."""
        pA, pB, pC = self.squad[0], self.squad[1], self.squad[2]
        teamA = [pA, pB] + self.squad[3:9]
        teamB = [pC] + self.squad[9:]
        
        teamA_ids = {p["id"] for p in teamA}
        teamB_ids = {p["id"] for p in teamB}
        
        # pA and pB paired on Team A
        self.assertIn(pA["id"], teamA_ids)
        self.assertIn(pB["id"], teamA_ids)
        # pA and pC separated
        self.assertIn(pA["id"], teamA_ids)
        self.assertIn(pC["id"], teamB_ids)

    # ---------------------------------------------------------
    # SUITE 9: Monotonic Penalty Ranking & Solution Integrity
    # ---------------------------------------------------------
    def test_suite_9_monotonic_penalty_ranking(self):
        """Multiple evaluated options must be ranked monotonically by penalty score."""
        teamA1 = self.squad[:8]
        teamB1 = self.squad[8:]
        
        # Create a less balanced split
        teamA2 = sorted(self.squad, key=lambda p: p["ovr"], reverse=True)[:8]
        teamB2 = sorted(self.squad, key=lambda p: p["ovr"], reverse=True)[8:]
        
        sol1 = score_team_balance(teamA1, teamB1, {"sectorWeights": CALIBRATED_SECTOR_WEIGHTS})
        sol2 = score_team_balance(teamA2, teamB2, {"sectorWeights": CALIBRATED_SECTOR_WEIGHTS})
        
        self.assertLess(sol1["penalty"], sol2["penalty"])
        self.assertGreater(sol1["fairnessScore"], sol2["fairnessScore"])


if __name__ == "__main__":
    unittest.main()
