#!/usr/bin/env python3
"""
Test Suite for Approved Plan:
8v8 • Rotating GKs • Multisector Balanced • 1-3-3-1
Loads current data/sector_weights.json and data/players.json directly.
Covers:
- Good Cases: TC-G1 .. TC-G6
- Negative Cases: TC-N1 .. TC-N5
- Edge Cases: TC-E1 .. TC-E5
"""

import itertools
import json
import math
import os
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")

with open(os.path.join(DATA_DIR, "sector_weights.json"), "r", encoding="utf-8") as f:
    CURRENT_SECTOR_WEIGHTS = json.load(f)

with open(os.path.join(DATA_DIR, "players.json"), "r", encoding="utf-8") as f:
    PLAYER_DATABASE = json.load(f)

PLAYER_BY_NAME = {p["name"]: p for p in PLAYER_DATABASE}

FORMATION_1331 = {
    "key": "1-3-3-1",
    "name": "1-3-3-1 (Classic Balanced)",
    "slots": [
        {"role": "GK", "label": "GK", "pos": "GK"},
        {"role": "LB", "label": "LB", "pos": "DEF"},
        {"role": "CB", "label": "CB", "pos": "DEF"},
        {"role": "RB", "label": "RB", "pos": "DEF"},
        {"role": "LM", "label": "LM", "pos": "MID"},
        {"role": "CM", "label": "CM", "pos": "MID"},
        {"role": "RM", "label": "RM", "pos": "MID"},
        {"role": "ST", "label": "ST", "pos": "FWD"},
    ],
}

FORM_MODIFIERS = {
    "hot": 1.08,
    "good": 1.04,
    "neutral": 1.0,
    "cold": 0.94,
    "terrible": 0.88,
}


def pick_players(*names):
    return [dict(PLAYER_BY_NAME[name]) for name in names]


def assign_players_to_1331(players, position_constraints=None, matchday_settings_map=None):
    """Python mirror of assignPlayersToFormation() in src/engine/formations.js."""
    position_constraints = position_constraints or {}
    matchday_settings_map = matchday_settings_map or {}
    slots = FORMATION_1331["slots"]

    unassigned = []
    for p in players:
        setting = matchday_settings_map.get(p["id"], {})
        can_rotate_gk = setting.get("canRotateGk", p.get("canRotateGk", True))
        cp = dict(p)
        cp["canRotateGk"] = can_rotate_gk
        unassigned.append(cp)

    slot_assignments = [None] * len(slots)

    def is_primary(p, pos):
        return p is not None and p.get("position") == pos

    def is_secondary(p, pos):
        return p is not None and p.get("secondaryPosition") == pos and p.get("secondaryPosition") != p.get("position")

    # Pass 0: Explicit Pinned Position Constraints
    if position_constraints:
        for idx, slot in enumerate(slots):
            if slot_assignments[idx] is not None:
                continue
            match_i = next((i for i, p in enumerate(unassigned) if position_constraints.get(p["id"]) == slot["pos"]), None)
            if match_i is not None:
                slot_assignments[idx] = unassigned.pop(match_i)

    # Pass 1: Dedicated GK slots (respecting Outfield-Only)
    for idx, slot in enumerate(slots):
        if slot["pos"] != "GK" or slot_assignments[idx] is not None:
            continue
        match_i = next((i for i, p in enumerate(unassigned) if is_primary(p, "GK") and p.get("canRotateGk", True) is not False), None)
        if match_i is None:
            match_i = next((i for i, p in enumerate(unassigned) if is_secondary(p, "GK") and p.get("canRotateGk", True) is not False), None)
        if match_i is not None:
            slot_assignments[idx] = unassigned.pop(match_i)

    # Pass 1.5: Emergency GK selection (respects canRotateGk !== false)
    for idx, slot in enumerate(slots):
        if slot["pos"] != "GK" or slot_assignments[idx] is not None:
            continue
        if unassigned:
            willing = [p for p in unassigned if p.get("canRotateGk", True) is not False]
            eligible = willing if willing else unassigned
            non_fwds = [p for p in eligible if p.get("position") != "FWD"]
            candidates = non_fwds if non_fwds else eligible
            candidates.sort(
                key=lambda p: (-(p.get("attributes", {}).get("gk", 20)), -(p.get("attributes", {}).get("def", 50)))
            )
            chosen = candidates[0]
            unassigned.remove(chosen)
            slot_assignments[idx] = chosen

    # Pass 2: Primary matches for outfield slots (reserving players critically needed for scarce secondary slots)
    slot_priority_order = ("FWD", "DEF", "MID")
    for target_pos in slot_priority_order:
        for idx, slot in enumerate(slots):
            if slot["pos"] != target_pos or slot_assignments[idx] is not None:
                continue

            def is_critically_needed_elsewhere(player):
                sec_pos = player.get("secondaryPosition")
                if not sec_pos or sec_pos == player.get("position") or sec_pos == target_pos:
                    return False
                unfilled_other = sum(1 for i2, s2 in enumerate(slots) if s2["pos"] == sec_pos and slot_assignments[i2] is None)
                if unfilled_other == 0:
                    return False
                prim_other = sum(1 for u in unassigned if is_primary(u, sec_pos))
                deficit = unfilled_other - prim_other
                if deficit <= 0:
                    return False
                sec_candidates = sum(1 for u in unassigned if is_secondary(u, sec_pos))
                return sec_candidates <= deficit

            matches = [
                (i, p) for i, p in enumerate(unassigned)
                if is_primary(p, target_pos) and not is_critically_needed_elsewhere(p)
            ]
            if matches:
                matches.sort(
                    key=lambda item: (
                        0 if (not item[1].get("secondaryPosition") or item[1].get("secondaryPosition") == item[1].get("position")) else 1,
                        -(item[1].get("ovr", 75)),
                    )
                )
                chosen_i = matches[0][0]
                slot_assignments[idx] = unassigned.pop(chosen_i)

    # Pass 3: Secondary matches for outfield slots
    for target_pos in slot_priority_order:
        for idx, slot in enumerate(slots):
            if slot["pos"] != target_pos or slot_assignments[idx] is not None:
                continue
            match_i = next((i for i, p in enumerate(unassigned) if is_secondary(p, target_pos)), None)
            if match_i is not None:
                slot_assignments[idx] = unassigned.pop(match_i)

    # Pass 4: Fallback for remaining outfield slots
    for idx, slot in enumerate(slots):
        if slot_assignments[idx] is not None:
            continue
        if unassigned:
            slot_assignments[idx] = unassigned.pop(0)

    assigned_players = []
    out_of_pos_count = 0
    emergency_gk_count = 0
    assigned_slots = []

    for idx, slot in enumerate(slots):
        p = slot_assignments[idx]
        if not p:
            continue
        is_pinned = position_constraints.get(p["id"]) == slot["pos"]
        is_prim = p.get("position") == slot["pos"]
        is_sec = p.get("secondaryPosition") == slot["pos"]
        is_out_of_pos = (not is_pinned) and (not is_prim) and (not is_sec)
        is_emerg_gk = (slot["pos"] == "GK") and (not is_pinned) and (not is_prim) and (not is_sec)
        if is_out_of_pos:
            out_of_pos_count += 1
        if is_emerg_gk:
            emergency_gk_count += 1

        ap = dict(p)
        ap["matchdayPosition"] = slot["pos"]
        ap["matchdayRole"] = slot["role"]
        ap["isPinnedRole"] = is_pinned
        ap["isSecondaryRole"] = (not is_prim) and is_sec
        ap["isOutOfPosition"] = is_out_of_pos
        ap["isEmergencyGk"] = is_emerg_gk
        assigned_players.append(ap)
        assigned_slots.append({"slot": slot, "player": ap})

    return {
        "formationKey": "1-3-3-1",
        "assignedPlayers": assigned_players,
        "assignedSlots": assigned_slots,
        "outOfPositionCount": out_of_pos_count,
        "emergencyGkCount": emergency_gk_count,
    }


def compute_sector_score(players, attr_weights, pos_weights):
    if not players:
        return 0.0
    total = 0.0
    for p in players:
        a = p["effectiveAttributes"]
        pos = p.get("matchdayPosition") or p.get("position") or "MID"
        role_weight = pos_weights.get(pos, 1.0)
        outfield = (
            a.get("pac", 0) * attr_weights.get("pac", 0)
            + a.get("sho", 0) * attr_weights.get("sho", 0)
            + a.get("pas", 0) * attr_weights.get("pas", 0)
            + a.get("dri", 0) * attr_weights.get("dri", 0)
            + a.get("def", 0) * attr_weights.get("def", 0)
            + a.get("phy", 0) * attr_weights.get("phy", 0)
        )
        total += outfield * role_weight
    return total / len(players)


def calculate_team_stats(players, matchday_settings_map=None, sector_weights=None, use_matchday_pos=True, gk_mode="rotating"):
    """Python mirror of calculateTeamStats() in src/engine/balancer.js."""
    matchday_settings_map = matchday_settings_map or {}
    sw = sector_weights or CURRENT_SECTOR_WEIGHTS
    n = len(players)

    effective_players = []
    for p in players:
        setting = matchday_settings_map.get(p["id"], {})
        fitness = setting.get("fitness", p.get("fitness", 100))
        form = setting.get("form", p.get("form", "neutral"))
        can_rotate_gk = setting.get("canRotateGk", p.get("canRotateGk", True)) is not False
        mult = (fitness / 100.0) * FORM_MODIFIERS.get(form, 1.0)

        attrs = p.get("attributes", {})
        eff_attrs = {k: round(v * mult) for k, v in attrs.items()}
        eff_ovr = round(p.get("ovr", 75) * mult)

        ep = dict(p)
        ep["effectiveAttributes"] = eff_attrs
        ep["effectiveOvr"] = eff_ovr
        ep["canRotateGk"] = can_rotate_gk
        ep["matchdayPosition"] = p.get("matchdayPosition", p.get("position")) if use_matchday_pos else p.get("position")
        ep["isPinnedRole"] = bool(p.get("isPinnedRole", False))
        effective_players.append(ep)

    gk_blend = sw.get("defense", {}).get("gkBlend", 0.35)
    pinned_gk = next((p for p in effective_players if p["isPinnedRole"] and p["matchdayPosition"] == "GK"), None)
    has_pinned_gk = pinned_gk is not None

    gk_schedule = []
    has_no_eligible_gk = False
    eligible_gk_count = 0

    if gk_mode == "rotating" and n >= 2 and not has_pinned_gk:
        eligible_gks = [p for p in effective_players if p["canRotateGk"] is not False]
        eligible_gk_count = len(eligible_gks)
        gks_to_rotate = eligible_gks
        if not gks_to_rotate:
            has_no_eligible_gk = True
            gks_to_rotate = [max(effective_players, key=lambda p: p["effectiveAttributes"].get("gk", 20))]

        k = len(gks_to_rotate)
        sum_att = sum_mid = sum_out_def = sum_def = sum_gk = 0.0
        for idx, gk_p in enumerate(gks_to_rotate):
            outfield_on_pitch = [p for p in effective_players if p["id"] != gk_p["id"]]
            t_att = compute_sector_score(outfield_on_pitch, sw["attack"]["attributes"], sw["attack"]["positions"])
            t_mid = compute_sector_score(outfield_on_pitch, sw["midfield"]["attributes"], sw["midfield"]["positions"])
            t_out_def = compute_sector_score(outfield_on_pitch, sw["defense"]["attributes"], sw["defense"]["positions"])
            t_gk = gk_p["effectiveAttributes"].get("gk", 20)
            t_def = t_out_def * (1 - gk_blend) + t_gk * gk_blend

            sum_att += t_att
            sum_mid += t_mid
            sum_out_def += t_out_def
            sum_def += t_def
            sum_gk += t_gk
            gk_schedule.append({
                "player": gk_p,
                "turnLabel": f"Turn {idx + 1}/{k}",
                "isPinnedGk": False,
            })

        att_raw = sum_att / k
        mid_raw = sum_mid / k
        out_def_raw = sum_out_def / k
        def_raw = sum_def / k
        gk_raw = sum_gk / k
    else:
        designated_gk = pinned_gk or next((p for p in effective_players if p["matchdayPosition"] == "GK"), None) or effective_players[0]
        outfield_on_pitch = [p for p in effective_players if p["id"] != designated_gk["id"]] if n > 1 else effective_players
        att_raw = compute_sector_score(outfield_on_pitch, sw["attack"]["attributes"], sw["attack"]["positions"])
        mid_raw = compute_sector_score(outfield_on_pitch, sw["midfield"]["attributes"], sw["midfield"]["positions"])
        out_def_raw = compute_sector_score(outfield_on_pitch, sw["defense"]["attributes"], sw["defense"]["positions"])
        gk_raw = designated_gk["effectiveAttributes"].get("gk", 20)
        def_raw = out_def_raw * (1 - gk_blend) + gk_raw * gk_blend
        gk_schedule.append({
            "player": designated_gk,
            "turnLabel": "Pinned Full Match" if has_pinned_gk else "Full Match",
            "isPinnedGk": has_pinned_gk,
        })

    avg_ovr = sum(p["effectiveOvr"] for p in effective_players) / n
    avg_pac = sum(p["effectiveAttributes"].get("pac", 0) for p in effective_players) / n
    avg_phy = sum(p["effectiveAttributes"].get("phy", 0) for p in effective_players) / n

    return {
        "effectiveAvgOvr": round(avg_ovr, 1),
        "attack": round(att_raw, 1),
        "midfield": round(mid_raw, 1),
        "defense": round(def_raw, 1),
        "outfieldDef": round(out_def_raw, 1),
        "goalkeeping": round(gk_raw, 1),
        "pace": round(avg_pac, 1),
        "physical": round(avg_phy, 1),
        "gkSchedule": gk_schedule,
        "eligibleGkCount": eligible_gk_count,
        "hasNoEligibleGk": has_no_eligible_gk,
        "hasPinnedGk": has_pinned_gk,
    }


def score_team_balance(team_a, team_b, options=None):
    options = options or {}
    gk_mode = options.get("gkMode", "rotating")
    matchday_settings_map = options.get("matchdaySettingsMap", {})
    sw = options.get("sectorWeights", CURRENT_SECTOR_WEIGHTS)
    constraints = options.get("constraints") or {}
    pos_constraints = constraints.get("pinnedPositions", {})

    best_a = assign_players_to_1331(team_a, pos_constraints, matchday_settings_map)
    best_b = assign_players_to_1331(team_b, pos_constraints, matchday_settings_map)

    assigned_a = best_a["assignedPlayers"]
    assigned_b = best_b["assignedPlayers"]

    stats_a = calculate_team_stats(assigned_a, matchday_settings_map, sw, True, gk_mode)
    stats_b = calculate_team_stats(assigned_b, matchday_settings_map, sw, True, gk_mode)

    ovr_delta = abs(stats_a["effectiveAvgOvr"] - stats_b["effectiveAvgOvr"])
    att_delta = abs(stats_a["attack"] - stats_b["attack"])
    mid_delta = abs(stats_a["midfield"] - stats_b["midfield"])
    def_delta = abs(stats_a["defense"] - stats_b["defense"])
    pac_delta = abs(stats_a["pace"] - stats_b["pace"])
    phy_delta = abs(stats_a["physical"] - stats_b["physical"])

    def count_roster_pos(team):
        c = {"GK": 0, "DEF": 0, "MID": 0, "FWD": 0}
        for p in team:
            pos = p.get("position", "MID")
            c[pos] = c.get(pos, 0) + 1
        return c

    roster_a = count_roster_pos(team_a)
    roster_b = count_roster_pos(team_b)

    if gk_mode == "rotating":
        no_gk_penalty = (400.0 if stats_a["hasNoEligibleGk"] else 0.0) + (400.0 if stats_b["hasNoEligibleGk"] else 0.0)
        rotator_delta = abs(stats_a["eligibleGkCount"] - stats_b["eligibleGkCount"])
        rotator_disparity_penalty = 0.0 if (stats_a["hasPinnedGk"] or stats_b["hasPinnedGk"]) else (max(0, rotator_delta - 2) * 25.0)
        avg_gk_delta = abs(stats_a["goalkeeping"] - stats_b["goalkeeping"])
        gk_penalty = (avg_gk_delta * 1.5) + no_gk_penalty + rotator_disparity_penalty
    else:
        gk_penalty = abs(roster_a["GK"] - roster_b["GK"]) * 250.0

    pos_penalty = (
        abs(roster_a["DEF"] - roster_b["DEF"])
        + abs(roster_a["MID"] - roster_b["MID"])
        + abs(roster_a["FWD"] - roster_b["FWD"])
    ) * 10.0

    pool_dedicated_gk = roster_a["GK"] + roster_b["GK"]
    emerg_gk_count = best_a["emergencyGkCount"] + best_b["emergencyGkCount"]
    emerg_gk_penalty = (emerg_gk_count * 1000.0) if (gk_mode == "fixed" and pool_dedicated_gk > 0) else 0.0

    raw_out_of_pos = best_a["outOfPositionCount"] + best_b["outOfPositionCount"]
    effective_out_of_pos = max(0, raw_out_of_pos - emerg_gk_count) if (gk_mode == "rotating" or pool_dedicated_gk == 0) else raw_out_of_pos
    out_of_pos_penalty = (effective_out_of_pos * 75.0) + emerg_gk_penalty

    ovr_mult = sw.get("overall", {}).get("penaltyMult", 22.0)
    att_mult = sw.get("attack", {}).get("penaltyMult", 8.0)
    mid_mult = sw.get("midfield", {}).get("penaltyMult", 7.5)
    def_mult = sw.get("defense", {}).get("penaltyMult", 9.0)
    pac_mult = sw.get("pace", {}).get("penaltyMult", 1.0)
    phy_mult = sw.get("physical", {}).get("penaltyMult", 0.8)

    penalty = (
        (ovr_delta * ovr_mult)
        + (att_delta * att_mult)
        + (mid_delta * mid_mult)
        + (def_delta * def_mult)
        + (gk_penalty * 2.0)
        + (pos_penalty * 2.0)
        + (pac_delta * pac_mult)
        + (phy_delta * phy_mult)
        + out_of_pos_penalty
    )

    total_weight = max(1.0, ovr_mult + att_mult + mid_mult + def_mult + pac_mult + phy_mult)
    weighted_avg_delta = penalty / total_weight
    fairness_score = max(50, min(100, round(50 + 50 * math.exp(-0.18 * weighted_avg_delta))))

    return {
        "penalty": penalty,
        "fairnessScore": fairness_score,
        "statsA": stats_a,
        "statsB": stats_b,
        "formationA": "1-3-3-1",
        "formationB": "1-3-3-1",
        "assignedTeamA": assigned_a,
        "assignedTeamB": assigned_b,
        "outOfPositionCount": effective_out_of_pos,
        "deltas": {
            "ovr": round(ovr_delta, 1),
            "attack": round(att_delta, 1),
            "midfield": round(mid_delta, 1),
            "defense": round(def_delta, 1),
            "pace": round(pac_delta, 1),
            "physical": round(phy_delta, 1),
            "gk": round(abs(stats_a["goalkeeping"] - stats_b["goalkeeping"]), 1),
        },
    }


def satisfies_constraints(team_a, team_b, constraints):
    if not constraints:
        return True
    ids_a = {p["id"] for p in team_a}
    ids_b = {p["id"] for p in team_b}
    for pid in constraints.get("pinnedA", set()):
        if pid not in ids_a:
            return False
    for pid in constraints.get("pinnedB", set()):
        if pid not in ids_b:
            return False
    return True


def build_balanced_teams(selected_players, options=None):
    options = options or {}
    n = len(selected_players)
    if n < 2 or n % 2 != 0:
        raise ValueError(f"Please select an even number of players (currently {n} selected).")

    team_size = n // 2
    top_k = options.get("topK", 5)
    constraints = options.get("constraints")
    solutions = []
    fallback_solutions = []

    first_player = selected_players[0]
    rest_players = selected_players[1:]
    for combo in itertools.combinations(rest_players, team_size - 1):
        team_a = [first_player] + list(combo)
        a_ids = {p["id"] for p in team_a}
        team_b = [p for p in selected_players if p["id"] not in a_ids]
        ev = score_team_balance(team_a, team_b, options)
        sol = {"teamA": team_a, "teamB": team_b, **ev}
        if satisfies_constraints(team_a, team_b, constraints):
            solutions.append(sol)
        else:
            fallback_solutions.append(sol)

    pool = solutions if solutions else fallback_solutions
    pool.sort(key=lambda s: s["penalty"])
    return pool[:top_k]


class Test8v81331RotatingPlan(unittest.TestCase):
    STANDARD_16 = pick_players(
        "Shasoor", "Blesson",
        "Joshua_Ajith", "Lian", "Sanjay", "Andrew", "Aadi", "KP",
        "Tom", "Ratheesh", "Jibin", "Prasanth", "Abey", "Ajith", "Anoop", "Anup",
    )

    # --- GOOD CASES ---

    def test_tc_g1_standard_1331_pool(self):
        res = build_balanced_teams(self.STANDARD_16, {"mode": "balanced", "gkMode": "rotating", "topK": 5})
        best = res[0]
        self.assertEqual(len(best["assignedTeamA"]), 8)
        self.assertEqual(len(best["assignedTeamB"]), 8)
        self.assertEqual(best["formationA"], "1-3-3-1")
        self.assertEqual(best["formationB"], "1-3-3-1")
        self.assertEqual(best["outOfPositionCount"], 0)
        self.assertGreaterEqual(best["fairnessScore"], 85)
        self.assertFalse(best["statsA"]["hasNoEligibleGk"])
        self.assertFalse(best["statsB"]["hasNoEligibleGk"])

    def test_tc_g2_topk_solution_diversity(self):
        res = build_balanced_teams(self.STANDARD_16, {"mode": "balanced", "gkMode": "rotating", "topK": 5})
        self.assertEqual(len(res), 5)
        penalties = [s["penalty"] for s in res]
        self.assertEqual(penalties, sorted(penalties))
        split_keys = {frozenset((frozenset(p["id"] for p in s["teamA"]), frozenset(p["id"] for p in s["teamB"]))) for s in res}
        self.assertEqual(len(split_keys), 5)

    def test_tc_g3_outfield_only_flag_enforcement(self):
        no_gk_names = {"Sanjay", "Abey", "Shasoor"}
        settings = {PLAYER_BY_NAME[name]["id"]: {"canRotateGk": False} for name in no_gk_names}
        res = build_balanced_teams(self.STANDARD_16, {
            "mode": "balanced",
            "gkMode": "rotating",
            "matchdaySettingsMap": settings,
            "topK": 5,
        })
        best = res[0]
        for team_key, stats_key in (("assignedTeamA", "statsA"), ("assignedTeamB", "statsB")):
            self.assertFalse(best[stats_key]["hasNoEligibleGk"])
            gk_assigned = next(p for p in best[team_key] if p["matchdayPosition"] == "GK")
            self.assertNotIn(gk_assigned["name"], no_gk_names)
            for turn in best[stats_key]["gkSchedule"]:
                self.assertNotIn(turn["player"]["name"], no_gk_names)

    def test_tc_g4_current_sector_weight_sensitivity(self):
        pool = pick_players(
            "Shasoor", "Blesson",
            "Joshua_Ajith", "Lian", "Andrew", "KP", "Akash", "Amal",
            "Vignesh", "Arun_Vishnu", "Ratheesh", "Jibin", "Prasanth", "Abey", "Anoop", "Anup",
        )
        res = build_balanced_teams(pool, {"mode": "balanced", "gkMode": "rotating", "topK": 1})
        best = res[0]
        self.assertEqual(CURRENT_SECTOR_WEIGHTS["overall"]["penaltyMult"], 0)
        self.assertEqual(CURRENT_SECTOR_WEIGHTS["pace"]["penaltyMult"], 10)
        self.assertLessEqual(best["deltas"]["attack"], 3.0)
        self.assertLessEqual(best["deltas"]["midfield"], 3.0)
        self.assertLessEqual(best["deltas"]["defense"], 3.0)
        self.assertLessEqual(best["deltas"]["pace"], 3.0)

    def test_tc_g5_matchday_form_and_chemistry(self):
        settings = {
            PLAYER_BY_NAME["Shasoor"]["id"]: {"form": "hot", "fitness": 100, "canRotateGk": True},
            PLAYER_BY_NAME["Blesson"]["id"]: {"form": "cold", "fitness": 90, "canRotateGk": True},
        }
        res = build_balanced_teams(self.STANDARD_16, {
            "mode": "balanced",
            "gkMode": "rotating",
            "matchdaySettingsMap": settings,
            "topK": 3,
        })
        best = res[0]
        self.assertEqual(best["formationA"], "1-3-3-1")
        self.assertEqual(best["formationB"], "1-3-3-1")
        self.assertGreaterEqual(best["fairnessScore"], 80)

    def test_tc_g6_sanjay_pinned_as_gk_only(self):
        sanjay_id = PLAYER_BY_NAME["Sanjay"]["id"]
        res = build_balanced_teams(self.STANDARD_16, {
            "mode": "balanced",
            "gkMode": "rotating",
            "constraints": {"pinnedPositions": {sanjay_id: "GK"}},
            "topK": 3,
        })
        best = res[0]
        in_a = any(p["id"] == sanjay_id for p in best["assignedTeamA"])
        sanjay_team = best["assignedTeamA"] if in_a else best["assignedTeamB"]
        sanjay_stats = best["statsA"] if in_a else best["statsB"]
        other_stats = best["statsB"] if in_a else best["statsA"]

        sanjay_assigned = next(p for p in sanjay_team if p["id"] == sanjay_id)
        self.assertEqual(sanjay_assigned["matchdayPosition"], "GK")
        self.assertTrue(sanjay_assigned["isPinnedRole"])
        self.assertTrue(sanjay_stats["hasPinnedGk"])
        self.assertEqual(len(sanjay_stats["gkSchedule"]), 1)
        self.assertEqual(sanjay_stats["gkSchedule"][0]["turnLabel"], "Pinned Full Match")
        self.assertFalse(other_stats["hasPinnedGk"])
        self.assertGreater(len(other_stats["gkSchedule"]), 1)

    # --- NEGATIVE CASES ---

    def test_tc_n1_odd_player_count_throws(self):
        with self.assertRaises(ValueError) as ctx:
            build_balanced_teams(self.STANDARD_16[:15], {"mode": "balanced", "gkMode": "rotating"})
        self.assertIn("even number", str(ctx.exception))

    def test_tc_n2_all_16_outfield_only_flags_no_eligible_gk(self):
        settings = {p["id"]: {"canRotateGk": False} for p in self.STANDARD_16}
        res = build_balanced_teams(self.STANDARD_16, {
            "mode": "balanced",
            "gkMode": "rotating",
            "matchdaySettingsMap": settings,
            "topK": 1,
        })
        best = res[0]
        self.assertTrue(best["statsA"]["hasNoEligibleGk"])
        self.assertTrue(best["statsB"]["hasNoEligibleGk"])
        self.assertLess(best["fairnessScore"], 60)

    def test_tc_n3_impossible_pinning_falls_back_gracefully(self):
        nine_ids = {p["id"] for p in self.STANDARD_16[:9]}
        res = build_balanced_teams(self.STANDARD_16, {
            "mode": "balanced",
            "gkMode": "rotating",
            "constraints": {"pinnedA": nine_ids},
            "topK": 1,
        })
        self.assertEqual(len(res[0]["teamA"]), 8)
        self.assertEqual(len(res[0]["teamB"]), 8)

    def test_tc_n4_severe_positional_skew_penalized(self):
        skewed_pool = pick_players(
            "Shasoor", "Blesson", "Mithun", "CP", "Vinay", "Shalu", "Mathai",
            "Joshua_Ajith", "Lian", "Sanjay", "Andrew", "Aadi", "KP", "Akash", "Amal", "Varun",
        )
        res = build_balanced_teams(skewed_pool, {"mode": "balanced", "gkMode": "rotating", "topK": 1})
        best = res[0]
        self.assertGreater(best["outOfPositionCount"], 0)
        self.assertLess(best["fairnessScore"], 75)

    def test_tc_n5_contradictory_sanjay_outfield_only_and_pinned_gk(self):
        sanjay_id = PLAYER_BY_NAME["Sanjay"]["id"]
        res = build_balanced_teams(self.STANDARD_16, {
            "mode": "balanced",
            "gkMode": "rotating",
            "matchdaySettingsMap": {sanjay_id: {"canRotateGk": False}},
            "constraints": {"pinnedPositions": {sanjay_id: "GK"}},
            "topK": 1,
        })
        best = res[0]
        in_a = any(p["id"] == sanjay_id for p in best["assignedTeamA"])
        sanjay_team = best["assignedTeamA"] if in_a else best["assignedTeamB"]
        sanjay_stats = best["statsA"] if in_a else best["statsB"]
        sanjay_assigned = next(p for p in sanjay_team if p["id"] == sanjay_id)
        self.assertEqual(sanjay_assigned["matchdayPosition"], "GK")
        self.assertTrue(sanjay_assigned["isPinnedRole"])
        self.assertTrue(sanjay_stats["hasPinnedGk"])

    # --- EDGE CASES ---

    def test_tc_e1_zero_natural_fwds_uses_secondary_fwd(self):
        no_fwd_pool = pick_players(
            "Joshua_Ajith", "Lian", "Andrew", "KP", "Akash", "Arun",
            "Tom", "Ratheesh", "Jibin", "Prasanth", "Abey", "Ajith", "Anoop", "Anup", "Vimji", "Navin",
        )
        res = build_balanced_teams(no_fwd_pool, {"mode": "balanced", "gkMode": "rotating", "topK": 1})
        best = res[0]
        self.assertEqual(best["outOfPositionCount"], 0)
        st_a = next(p for p in best["assignedTeamA"] if p["matchdayRole"] == "ST")
        st_b = next(p for p in best["assignedTeamB"] if p["matchdayRole"] == "ST")
        self.assertEqual(st_a.get("secondaryPosition"), "FWD")
        self.assertEqual(st_b.get("secondaryPosition"), "FWD")

    def test_tc_e2_single_willing_gk_in_16_players(self):
        anup_id = PLAYER_BY_NAME["Anup"]["id"]
        settings = {p["id"]: {"canRotateGk": (p["id"] == anup_id)} for p in self.STANDARD_16}
        res = build_balanced_teams(self.STANDARD_16, {
            "mode": "balanced",
            "gkMode": "rotating",
            "matchdaySettingsMap": settings,
            "topK": 1,
        })
        best = res[0]
        anup_in_a = any(p["id"] == anup_id for p in best["assignedTeamA"])
        anup_stats = best["statsA"] if anup_in_a else best["statsB"]
        other_stats = best["statsB"] if anup_in_a else best["statsA"]
        anup_team = best["assignedTeamA"] if anup_in_a else best["assignedTeamB"]
        self.assertFalse(anup_stats["hasNoEligibleGk"])
        self.assertEqual(anup_stats["eligibleGkCount"], 1)
        self.assertTrue(other_stats["hasNoEligibleGk"])
        self.assertEqual(next(p for p in anup_team if p["matchdayPosition"] == "GK")["id"], anup_id)

    def test_tc_e3_two_willing_gks_partitioned_one_per_team(self):
        willing_ids = {PLAYER_BY_NAME["Anoop"]["id"], PLAYER_BY_NAME["Anup"]["id"]}
        settings = {p["id"]: {"canRotateGk": (p["id"] in willing_ids)} for p in self.STANDARD_16}
        res = build_balanced_teams(self.STANDARD_16, {
            "mode": "balanced",
            "gkMode": "rotating",
            "matchdaySettingsMap": settings,
            "topK": 1,
        })
        best = res[0]
        self.assertFalse(best["statsA"]["hasNoEligibleGk"])
        self.assertFalse(best["statsB"]["hasNoEligibleGk"])
        self.assertEqual(best["statsA"]["eligibleGkCount"], 1)
        self.assertEqual(best["statsB"]["eligibleGkCount"], 1)

    def test_tc_e4_extreme_ovr_and_pace_outlier(self):
        outlier_pool = pick_players(
            "Shasoor", "Blesson",
            "Joshua_Ajith", "Lian", "Sanjay", "Andrew", "Aadi", "KP",
            "Tom", "Ratheesh", "Jibin", "Vignesh", "Abey", "Pradeep", "Joshua", "Anup",
        )
        res = build_balanced_teams(outlier_pool, {"mode": "balanced", "gkMode": "rotating", "topK": 1})
        best = res[0]
        self.assertLessEqual(best["deltas"]["pace"], 3.0)
        self.assertLessEqual(best["deltas"]["defense"], 3.0)
        self.assertLessEqual(best["deltas"]["attack"], 3.0)

    def test_tc_e5_zero_primary_gks_no_fixed_emergency_penalty(self):
        self.assertFalse(any(p["position"] == "GK" for p in self.STANDARD_16))
        res = build_balanced_teams(self.STANDARD_16, {"mode": "balanced", "gkMode": "rotating", "topK": 1})
        best = res[0]
        self.assertGreaterEqual(best["fairnessScore"], 85)
        self.assertEqual(best["outOfPositionCount"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
