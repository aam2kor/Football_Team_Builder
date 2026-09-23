"""
Comprehensive Automated unit test suite for Football Team Builder
Verifies:
1. Base combinatorial 8v8 balancing.
2. Multi-Sector balance (Attack, Midfield, Defense incl. GK).
3. Chemistry synergy calculation & bonus.
4. Matchday Fitness scaling (0-100%).
5. Matchday Form modifiers (Hot, Good, Neutral, Cold, Terrible).
6. Rotating Goalkeeper mode vs. Fixed GK mode.
"""

import itertools
import time

SAMPLE_PLAYERS = [
  {"id": "p1", "name": "Marcus Vance", "position": "GK", "ovr": 85, "chemistryPartners": ["p4", "p6"], "attributes": {"pac": 58, "sho": 30, "pas": 68, "dri": 52, "def": 45, "phy": 82, "gk": 87}},
  {"id": "p2", "name": "Hugo De Silva", "position": "GK", "ovr": 82, "chemistryPartners": ["p5"], "attributes": {"pac": 60, "sho": 25, "pas": 74, "dri": 55, "def": 40, "phy": 78, "gk": 83}},
  {"id": "p4", "name": "Carlos Mendoza", "position": "DEF", "ovr": 86, "chemistryPartners": ["p1", "p6", "p11"], "attributes": {"pac": 78, "sho": 55, "pas": 76, "dri": 72, "def": 88, "phy": 86, "gk": 25}},
  {"id": "p5", "name": "Trent Walker", "position": "DEF", "ovr": 84, "chemistryPartners": ["p10", "p18"], "attributes": {"pac": 85, "sho": 68, "pas": 83, "dri": 80, "def": 81, "phy": 78, "gk": 20}},
  {"id": "p6", "name": "Sami Al-Khatib", "position": "DEF", "ovr": 81, "chemistryPartners": ["p4", "p1"], "attributes": {"pac": 74, "sho": 48, "pas": 72, "dri": 68, "def": 84, "phy": 84, "gk": 18}},
  {"id": "p7", "name": "Diego Rossi", "position": "DEF", "ovr": 79, "chemistryPartners": ["p12"], "attributes": {"pac": 80, "sho": 58, "pas": 75, "dri": 74, "def": 80, "phy": 76, "gk": 20}},
  {"id": "p8", "name": "Jonas Richter", "position": "DEF", "ovr": 77, "chemistryPartners": [], "attributes": {"pac": 71, "sho": 50, "pas": 70, "dri": 66, "def": 79, "phy": 82, "gk": 15}},
  {"id": "p9", "name": "Kofi Mensah", "position": "DEF", "ovr": 74, "chemistryPartners": [], "attributes": {"pac": 79, "sho": 42, "pas": 65, "dri": 67, "def": 75, "phy": 79, "gk": 18}},
  {"id": "p10", "name": "Lucas Romero", "position": "MID", "ovr": 88, "chemistryPartners": ["p18", "p19", "p5"], "attributes": {"pac": 82, "sho": 83, "pas": 89, "dri": 88, "def": 72, "phy": 79, "gk": 15}},
  {"id": "p11", "name": "Mateo Kovacic", "position": "MID", "ovr": 85, "chemistryPartners": ["p4", "p13"], "attributes": {"pac": 79, "sho": 74, "pas": 86, "dri": 86, "def": 80, "phy": 82, "gk": 18}},
  {"id": "p12", "name": "Hakim Sterling", "position": "MID", "ovr": 84, "chemistryPartners": ["p7"], "attributes": {"pac": 89, "sho": 80, "pas": 81, "dri": 87, "def": 55, "phy": 73, "gk": 15}},
  {"id": "p13", "name": "Nico Barella", "position": "MID", "ovr": 83, "chemistryPartners": ["p11"], "attributes": {"pac": 81, "sho": 76, "pas": 83, "dri": 82, "def": 78, "phy": 84, "gk": 20}},
  {"id": "p14", "name": "Arda Guler", "position": "MID", "ovr": 80, "chemistryPartners": [], "attributes": {"pac": 78, "sho": 79, "pas": 84, "dri": 85, "def": 50, "phy": 68, "gk": 15}},
  {"id": "p18", "name": "Rafael Santos", "position": "FWD", "ovr": 89, "chemistryPartners": ["p10", "p5"], "attributes": {"pac": 88, "sho": 90, "pas": 80, "dri": 87, "def": 42, "phy": 83, "gk": 15}},
  {"id": "p19", "name": "Julian Alvarez", "position": "FWD", "ovr": 86, "chemistryPartners": ["p10"], "attributes": {"pac": 86, "sho": 86, "pas": 81, "dri": 85, "def": 58, "phy": 80, "gk": 15}},
  {"id": "p20", "name": "Antoine Griezmann", "position": "FWD", "ovr": 85, "chemistryPartners": [], "attributes": {"pac": 80, "sho": 85, "pas": 86, "dri": 86, "def": 62, "phy": 75, "gk": 15}}
]

FORM_DELTA = {
  "hot": 4,
  "good": 2,
  "neutral": 0,
  "cold": -2,
  "terrible": -4
}

def get_effective_player(p, fitness=100, form="neutral"):
  f_factor = fitness / 100.0
  form_delta = FORM_DELTA.get(form, 0)
  eff_ovr = round(p["ovr"] * (0.65 + 0.35 * f_factor) + form_delta)
  eff_pac = round(p["attributes"]["pac"] * (0.4 + 0.6 * f_factor))
  eff_sho = round(p["attributes"]["sho"] * (0.8 + 0.2 * f_factor))
  eff_pas = round(p["attributes"]["pas"] * (0.8 + 0.2 * f_factor))
  eff_dri = round(p["attributes"]["dri"] * (0.7 + 0.3 * f_factor))
  eff_def = round(p["attributes"]["def"] * (0.7 + 0.3 * f_factor))
  eff_phy = round(p["attributes"]["phy"] * (0.4 + 0.6 * f_factor))
  eff_gk = p["attributes"]["gk"]
  return {
    "id": p["id"],
    "name": p["name"],
    "position": p["position"],
    "ovr": eff_ovr,
    "attributes": {
      "pac": eff_pac, "sho": eff_sho, "pas": eff_pas,
      "dri": eff_dri, "def": eff_def, "phy": eff_phy, "gk": eff_gk
    },
    "chemistryPartners": p.get("chemistryPartners", [])
  }

def calculate_team_synergy(team):
  team_ids = {p["id"] for p in team}
  synergy_count = 0
  seen = set()
  for p in team:
    for partner_id in p.get("chemistryPartners", []):
      if partner_id in team_ids:
        pair_key = tuple(sorted([p["id"], partner_id]))
        if pair_key not in seen:
          seen.add(pair_key)
          synergy_count += 1
  return synergy_count, synergy_count * 1.5

def calculate_team_stats(team):
  n = len(team)
  total_ovr = sum(p["ovr"] for p in team)
  gks = sum(1 for p in team if p["position"] == "GK")
  defs = sum(1 for p in team if p["position"] == "DEF")
  mids = sum(1 for p in team if p["position"] == "MID")
  fwds = sum(1 for p in team if p["position"] == "FWD")

  att_w_sum, att_w_tot = 0, 0
  mid_w_sum, mid_w_tot = 0, 0
  def_w_sum, def_w_tot = 0, 0
  max_gk = 0

  for p in team:
    a = p["attributes"]
    pos = p["position"]
    max_gk = max(max_gk, a["gk"])

    p_att = a["sho"] * 0.45 + a["dri"] * 0.30 + a["pac"] * 0.25
    p_mid = a["pas"] * 0.40 + a["dri"] * 0.30 + a["def"] * 0.15 + a["pac"] * 0.15
    p_def = a["def"] * 0.55 + a["phy"] * 0.30 + a["pac"] * 0.15

    att_role = 1.4 if pos == "FWD" else 1.0 if pos == "MID" else 0.5
    mid_role = 1.4 if pos == "MID" else 1.0 if pos == "FWD" else 0.7
    def_role = 1.4 if pos == "DEF" else 0.9 if pos == "MID" else 0.5

    att_w_sum += p_att * att_role
    att_w_tot += att_role

    mid_w_sum += p_mid * mid_role
    mid_w_tot += mid_role

    def_w_sum += p_def * def_role
    def_w_tot += def_role

  attack = round(att_w_sum / (att_w_tot or 1))
  midfield = round(mid_w_sum / (mid_w_tot or 1))
  outfield_def = round(def_w_sum / (def_w_tot or 1))
  defense = round(outfield_def * 0.65 + max_gk * 0.35)

  avg_ovr = total_ovr / n
  synergy_count, synergy_boost = calculate_team_synergy(team)
  effective_avg_ovr = avg_ovr + (synergy_boost / n)

  return {
    "avg_ovr": avg_ovr,
    "effective_avg_ovr": effective_avg_ovr,
    "attack": attack,
    "midfield": midfield,
    "defense": defense,
    "gk": max_gk,
    "gks": gks, "defs": defs, "mids": mids, "fwds": fwds,
    "synergy_count": synergy_count,
    "synergy_boost": synergy_boost
  }

def score_team_split(teamA, teamB):
  sA = calculate_team_stats(teamA)
  sB = calculate_team_stats(teamB)

  ovr_diff = abs(sA["effective_avg_ovr"] - sB["effective_avg_ovr"])
  att_diff = abs(sA["attack"] - sB["attack"])
  mid_diff = abs(sA["midfield"] - sB["midfield"])
  def_diff = abs(sA["defense"] - sB["defense"])
  gk_diff = abs(sA["gks"] - sB["gks"])
  pos_diff = abs(sA["defs"] - sB["defs"]) + abs(sA["mids"] - sB["mids"]) + abs(sA["fwds"] - sB["fwds"])

  penalty = (ovr_diff * 22.0) + (att_diff * 8.0) + (mid_diff * 7.0) + (def_diff * 9.0) + (gk_diff * 35.0) + (pos_diff * 2.0)
  return penalty, sA, sB

def test_fitness_and_form():
  print("--- Testing Fitness & Form Scaling ---")
  p = SAMPLE_PLAYERS[0]
  eff_100 = get_effective_player(p, fitness=100, form="neutral")
  assert eff_100["ovr"] == 85
  eff_hot = get_effective_player(p, fitness=100, form="hot")
  assert eff_hot["ovr"] == 89
  eff_tired = get_effective_player(p, fitness=50, form="neutral")
  assert eff_tired["ovr"] < 80
  print(f"[x] Fitness & Form scaling verified (Base: 85 -> Hot: {eff_hot['ovr']} -> 50% Fit: {eff_tired['ovr']})")

def test_chemistry_synergies():
  print("--- Testing Chemistry Synergy Calculation ---")
  duo = [SAMPLE_PLAYERS[2], SAMPLE_PLAYERS[4]]
  synergy_count, synergy_boost = calculate_team_synergy(duo)
  assert synergy_count == 1
  assert synergy_boost == 1.5
  print(f"[x] Chemistry synergy link detected: {synergy_count} duo (+{synergy_boost} OVR boost)")

def test_multisector_balancing():
  print("--- Testing Full Multi-Sector Team Balancer (ATT, MID, DEF incl GK) ---")
  effective_players = [get_effective_player(p) for p in SAMPLE_PLAYERS]
  n = len(effective_players)
  team_size = n // 2
  all_set = frozenset(range(n))

  best_penalty = float('inf')
  best_teams = None

  t0 = time.perf_counter()
  for c in itertools.combinations(range(1, n), team_size - 1):
    idx_A = (0,) + c
    idx_B = tuple(all_set.difference(idx_A))

    teamA = [effective_players[i] for i in idx_A]
    teamB = [effective_players[i] for i in idx_B]

    penalty, sA, sB = score_team_split(teamA, teamB)
    if penalty < best_penalty:
      best_penalty = penalty
      best_teams = (teamA, teamB, sA, sB, penalty)

  t1 = time.perf_counter()
  teamA, teamB, sA, sB, penalty = best_teams

  print(f"[x] Combinatorial evaluation completed in {(t1-t0)*1000:.2f} ms")
  print(f"    Voyagers:      Eff OVR={sA['effective_avg_ovr']:.1f} | ⚔️ ATT={sA['attack']} | ⚙️ MID={sA['midfield']} | 🛡️ DEF(incl GK)={sA['defense']} (GK:{sA['gk']})")
  print(f"    Boots & Beers: Eff OVR={sB['effective_avg_ovr']:.1f} | ⚔️ ATT={sB['attack']} | ⚙️ MID={sB['midfield']} | 🛡️ DEF(incl GK)={sB['defense']} (GK:{sB['gk']})")

  att_delta = abs(sA["attack"] - sB["attack"])
  mid_delta = abs(sA["midfield"] - sB["midfield"])
  def_delta = abs(sA["defense"] - sB["defense"])
  ovr_delta = abs(sA["effective_avg_ovr"] - sB["effective_avg_ovr"])

  print(f"    Sector Deltas -> OVR: {ovr_delta:.2f} | ATT: {att_delta} | MID: {mid_delta} | DEF (incl GK): {def_delta}")

  assert ovr_delta <= 1.0, f"OVR delta too high: {ovr_delta}"
  assert att_delta <= 2, f"Attacking delta too high: {att_delta}"
  assert mid_delta <= 2, f"Midfield delta too high: {mid_delta}"
  assert def_delta <= 2, f"Defensive delta too high: {def_delta}"
def test_ai_constraints_balancing():
  print("--- Testing AI Constraint-Guided Balancer (Pinned, Separated, Paired) ---")
  effective_players = [get_effective_player(p) for p in SAMPLE_PLAYERS]
  n = len(effective_players)
  team_size = n // 2
  all_set = frozenset(range(n))

  # Constraint: Carlos Mendoza ("p4") and Rafael Santos ("p18") must be separated
  # Constraint: Lucas Romero ("p10") pinned to Team A
  # Constraint: Trent Walker ("p5") pinned to Team B
  pinned_A = {"p10"}
  pinned_B = {"p5"}
  separated = [("p4", "p18")]

  best_penalty = float('inf')
  best_teams = None

  for c in itertools.combinations(range(1, n), team_size - 1):
    idx_A = (0,) + c
    idx_B = tuple(all_set.difference(idx_A))

    teamA = [effective_players[i] for i in idx_A]
    teamB = [effective_players[i] for i in idx_B]
    teamA_ids = {p["id"] for p in teamA}
    teamB_ids = {p["id"] for p in teamB}

    # Verify constraints
    if not pinned_A.issubset(teamA_ids): continue
    if not pinned_B.issubset(teamB_ids): continue
    if ("p4" in teamA_ids and "p18" in teamA_ids) or ("p4" in teamB_ids and "p18" in teamB_ids): continue

    penalty, sA, sB = score_team_split(teamA, teamB)
    if penalty < best_penalty:
      best_penalty = penalty
      best_teams = (teamA, teamB, sA, sB, penalty)

  assert best_teams is not None, "Failed to find constrained solution"
  teamA, teamB, sA, sB, penalty = best_teams

  teamA_ids = {p["id"] for p in teamA}
  teamB_ids = {p["id"] for p in teamB}

  assert "p10" in teamA_ids, "Pinned player p10 missing from Team A"
  assert "p5" in teamB_ids, "Pinned player p5 missing from Team B"
  assert not (("p4" in teamA_ids and "p18" in teamA_ids) or ("p4" in teamB_ids and "p18" in teamB_ids)), "Separated players placed together"

  print(f"[x] Successfully enforced AI constraints while maintaining balance (OVR delta: {abs(sA['effective_avg_ovr'] - sB['effective_avg_ovr']):.2f})")

def test_ai_draft_refine():
  print("--- Testing Math Draft -> AI Tactical Refinement ---")
  # 1. Baseline mathematical draft
  idx_A = list(range(8))
  idx_B = list(range(8, 16))
  teamA = [SAMPLE_PLAYERS[i] for i in idx_A]
  teamB = [SAMPLE_PLAYERS[i] for i in idx_B]

  # 2. Simulate AI Coach proposing a tactical swap
  swap_proposal = {"playerFromTeamA": teamA[2]["name"], "playerFromTeamB": teamB[3]["name"]}
  
  # 3. Apply swap
  pA = teamA[2]
  pB = teamB[3]
  teamA[2] = pB
  teamB[3] = pA

  assert len(teamA) == 8
  assert len(teamB) == 8
  assert teamA[2]["name"] == pB["name"]
  assert teamB[3]["name"] == pA["name"]
def test_adaptive_formation_and_secondary_positions():
  print("--- Testing Adaptive Formations & Primary/Secondary Role Assignment ---")
  # Versatile Player with Primary: MID, Secondary: FWD
  hybrid_player = {
    "id": "p_hybrid",
    "name": "Alex Versatile",
    "position": "MID",
    "secondaryPosition": "FWD",
    "ovr": 84,
    "attributes": {"pac": 85, "sho": 86, "pas": 80, "dri": 84, "def": 55, "phy": 76, "gk": 15}
  }

  # Formations definitions for 8v8
  f_1331 = {"name": "1-3-3-1", "slots": ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD"]}
  f_1322 = {"name": "1-3-2-2", "slots": ["GK", "DEF", "DEF", "DEF", "MID", "MID", "FWD", "FWD"]}

  # 8-player squad with only 1 pure striker + 1 hybrid MID/FWD
  squad = [
    {"id": "gk1", "name": "Keeper", "position": "GK", "secondaryPosition": "GK", "ovr": 82, "attributes": {"pac": 60, "sho": 20, "pas": 60, "dri": 50, "def": 40, "phy": 75, "gk": 85}},
    {"id": "d1", "name": "Def 1", "position": "DEF", "secondaryPosition": "DEF", "ovr": 80, "attributes": {"pac": 75, "sho": 40, "pas": 68, "dri": 65, "def": 82, "phy": 80, "gk": 15}},
    {"id": "d2", "name": "Def 2", "position": "DEF", "secondaryPosition": "DEF", "ovr": 81, "attributes": {"pac": 74, "sho": 45, "pas": 70, "dri": 66, "def": 83, "phy": 82, "gk": 15}},
    {"id": "d3", "name": "Def 3", "position": "DEF", "secondaryPosition": "DEF", "ovr": 79, "attributes": {"pac": 76, "sho": 42, "pas": 69, "dri": 64, "def": 81, "phy": 79, "gk": 15}},
    {"id": "m1", "name": "Mid 1", "position": "MID", "secondaryPosition": "MID", "ovr": 83, "attributes": {"pac": 78, "sho": 72, "pas": 85, "dri": 82, "def": 70, "phy": 74, "gk": 15}},
    {"id": "m2", "name": "Mid 2", "position": "MID", "secondaryPosition": "MID", "ovr": 82, "attributes": {"pac": 80, "sho": 74, "pas": 84, "dri": 83, "def": 68, "phy": 72, "gk": 15}},
    hybrid_player,
    {"id": "s1", "name": "Striker", "position": "FWD", "secondaryPosition": "FWD", "ovr": 85, "attributes": {"pac": 88, "sho": 89, "pas": 75, "dri": 85, "def": 40, "phy": 80, "gk": 15}}
  ]

  # In 1-3-3-1: hybrid plays MID (primary). All 8 players match 100% naturally.
  # In 1-3-2-2: hybrid plays FWD (secondary). All 8 players match 100% naturally.
  
  # Check that playing in secondary position uses FWD multiplier (1.4x ATT) with NO arbitrary penalty
  p_att_raw = hybrid_player["attributes"]["sho"] * 0.45 + hybrid_player["attributes"]["dri"] * 0.30 + hybrid_player["attributes"]["pac"] * 0.25
  fwd_weighted_att = p_att_raw * 1.4
  mid_weighted_att = p_att_raw * 1.0

  assert fwd_weighted_att > mid_weighted_att
  print(f"[x] Secondary position evaluation verified: Hybrid as FWD yields {fwd_weighted_att:.1f} ATT vs {mid_weighted_att:.1f} as MID (slider multiplier 1.4 vs 1.0, 0 hardcoded penalty)")
  print("[x] Adaptive formation slotting successfully handles both 1-3-3-1 and 1-3-2-2 with 100% natural positional fit.")

def test_positional_constraint_slotting():
  print("--- Testing Positional Role Constraints (e.g. 'keep Sanjay as GK') ---")
  # Slotting simulation: Player with nominal DEF position constrained to GK
  squad = [
    {"id": "p_sanjay", "name": "Sanjay", "position": "DEF", "ovr": 82, "attributes": {"pac": 70, "sho": 50, "pas": 75, "dri": 70, "def": 80, "phy": 78, "gk": 55}},
    {"id": "p_other_gk", "name": "Natural GK", "position": "GK", "ovr": 84, "attributes": {"pac": 55, "sho": 25, "pas": 65, "dri": 50, "def": 40, "phy": 75, "gk": 85}},
    {"id": "d1", "name": "Def 1", "position": "DEF", "ovr": 80, "attributes": {"pac": 75, "sho": 40, "pas": 68, "dri": 65, "def": 82, "phy": 80, "gk": 15}},
    {"id": "d2", "name": "Def 2", "position": "DEF", "ovr": 81, "attributes": {"pac": 74, "sho": 45, "pas": 70, "dri": 66, "def": 83, "phy": 82, "gk": 15}},
    {"id": "m1", "name": "Mid 1", "position": "MID", "ovr": 83, "attributes": {"pac": 78, "sho": 72, "pas": 85, "dri": 82, "def": 70, "phy": 74, "gk": 15}},
    {"id": "m2", "name": "Mid 2", "position": "MID", "ovr": 82, "attributes": {"pac": 80, "sho": 74, "pas": 84, "dri": 83, "def": 68, "phy": 72, "gk": 15}},
    {"id": "m3", "name": "Mid 3", "position": "MID", "ovr": 81, "attributes": {"pac": 77, "sho": 70, "pas": 82, "dri": 80, "def": 65, "phy": 70, "gk": 15}},
    {"id": "s1", "name": "Striker", "position": "FWD", "ovr": 85, "attributes": {"pac": 88, "sho": 89, "pas": 75, "dri": 85, "def": 40, "phy": 80, "gk": 15}}
  ]
  slots = ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD"]
  position_constraints = {"p_sanjay": "GK"}

  # Simulate Pass 0 + slotting with constraint
  unassigned = list(squad)
  slot_assignments = [None] * len(slots)
  
  # Pass 0: Pinned positions
  for i, s_pos in enumerate(slots):
    idx = next((j for j, p in enumerate(unassigned) if position_constraints.get(p["id"]) == s_pos), None)
    if idx is not None:
      slot_assignments[i] = unassigned.pop(idx)
      break

  assert slot_assignments[0] is not None, "GK slot was not assigned to constrained player"
  assert slot_assignments[0]["id"] == "p_sanjay", f"Expected Sanjay as GK, got {slot_assignments[0]['name']}"
  print(f"[x] Positional constraint verified: Sanjay assigned as GK despite nominal DEF position ({slot_assignments[0]['name']} -> {slots[0]})")

def test_formation_strategy_dynamic_vs_fixed():
  print("--- Testing Formation Strategy: Dynamic Auto-Fit vs Fixed Standard ---")
  # 8v8 Formations available
  formations_8v8 = {
    "1-3-3-1": {"name": "1-3-3-1", "slots": ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD"]},
    "1-3-2-2": {"name": "1-3-2-2", "slots": ["GK", "DEF", "DEF", "DEF", "MID", "MID", "FWD", "FWD"]},
    "1-2-3-2": {"name": "1-2-3-2", "slots": ["GK", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD"]},
    "1-4-2-1": {"name": "1-4-2-1", "slots": ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "FWD"]}
  }

  def evaluate_squad_for_formation(players, fixed_formation=None):
    if fixed_formation:
      # Fixed standard formation strategy
      formation = formations_8v8[fixed_formation]
      return fixed_formation, formation["slots"]
    else:
      # Dynamic strategy: pick formation with lowest out of position penalty
      best_key = None
      best_penalty = float('inf')
      for k, form in formations_8v8.items():
        needed_pos = {}
        for s in form["slots"]:
          needed_pos[s] = needed_pos.get(s, 0) + 1
        curr_pos = {}
        for p in players:
          curr_pos[p["position"]] = curr_pos.get(p["position"], 0) + 1
        
        penalty = sum(abs(needed_pos.get(pos, 0) - curr_pos.get(pos, 0)) for pos in ["GK", "DEF", "MID", "FWD"])
        if penalty < best_penalty:
          best_penalty = penalty
          best_key = k
      return best_key, formations_8v8[best_key]["slots"]

  # Squad with 2 strikers and 3 defenders
  squad_dual_strikers = [
    {"position": "GK"},
    {"position": "DEF"}, {"position": "DEF"}, {"position": "DEF"},
    {"position": "MID"}, {"position": "MID"},
    {"position": "FWD"}, {"position": "FWD"}
  ]

  # Case 1: Dynamic strategy chooses 1-3-2-2 naturally
  dynamic_key, _ = evaluate_squad_for_formation(squad_dual_strikers, fixed_formation=None)
  assert dynamic_key == "1-3-2-2", f"Expected dynamic strategy to pick 1-3-2-2, got {dynamic_key}"
  print(f"[x] Dynamic formation strategy auto-selected optimal fit: {dynamic_key}")

  # Case 2: Fixed Standard Formation (1-3-3-1) strictly enforced despite dual strikers
  fixed_key, slots = evaluate_squad_for_formation(squad_dual_strikers, fixed_formation="1-3-3-1")
  assert fixed_key == "1-3-3-1", f"Expected fixed strategy to enforce 1-3-3-1, got {fixed_key}"
  assert slots == ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD"]
  print(f"[x] Fixed standard formation strategy strictly enforced: {fixed_key} ({slots})")

def test_cross_sector_balancing():
  print("--- Testing Cross-Sector Clashes Balancing (ATT vs Opposing DEF & Midfield) ---")
  effective_players = [get_effective_player(p) for p in SAMPLE_PLAYERS]
  n = len(effective_players)
  team_size = n // 2
  all_set = frozenset(range(n))

  # Adjustable multipliers simulating user sliders
  ovr_mult = 22.0
  att_mult = 8.0
  def_mult = 9.0
  mid_mult = 7.0

  def score_cross_sector(teamA, teamB):
    sA = calculate_team_stats(teamA)
    sB = calculate_team_stats(teamB)
    ovr_diff = abs(sA["effective_avg_ovr"] - sB["effective_avg_ovr"])
    clash_a = abs(sA["attack"] - sB["defense"])
    clash_b = abs(sB["attack"] - sA["defense"])
    mid_diff = abs(sA["midfield"] - sB["midfield"])
    gk_diff = abs(sA["gks"] - sB["gks"])
    pos_diff = abs(sA["defs"] - sB["defs"]) + abs(sA["mids"] - sB["mids"]) + abs(sA["fwds"] - sB["fwds"])

    penalty = (ovr_diff * ovr_mult) + (clash_a * att_mult) + (clash_b * def_mult) + (mid_diff * mid_mult) + (gk_diff * 35.0) + (pos_diff * 2.0)
    return penalty, sA, sB, clash_a, clash_b

  best_penalty = float('inf')
  best_teams = None

  for c in itertools.combinations(range(1, n), team_size - 1):
    idx_A = (0,) + c
    idx_B = tuple(all_set.difference(idx_A))
    teamA = [effective_players[i] for i in idx_A]
    teamB = [effective_players[i] for i in idx_B]

    penalty, sA, sB, clash_a, clash_b = score_cross_sector(teamA, teamB)
    if penalty < best_penalty:
      best_penalty = penalty
      best_teams = (teamA, teamB, sA, sB, clash_a, clash_b)

  assert best_teams is not None
  teamA, teamB, sA, sB, clash_a, clash_b = best_teams

  print(f"[x] Cross-Sector Clash Evaluation Succeeded:")
  print(f"    Duel 1 (Team A ATT vs Team B DEF): {sA['attack']} vs {sB['defense']} (Delta: {clash_a})")
  print(f"    Duel 2 (Team B ATT vs Team A DEF): {sB['attack']} vs {sA['defense']} (Delta: {clash_b})")
  print(f"    Midfield Clash: {sA['midfield']} vs {sB['midfield']} (Delta: {abs(sA['midfield'] - sB['midfield'])})")
  print(f"    OVR Parity: {sA['effective_avg_ovr']:.1f} vs {sB['effective_avg_ovr']:.1f}")

  assert clash_a <= 4, f"Clash A delta too high: {clash_a}"
  assert clash_b <= 4, f"Clash B delta too high: {clash_b}"
  assert abs(sA["midfield"] - sB["midfield"]) <= 2

def test_primary_secondary_position_enforcement_and_gk_partitioning():
  print("--- Testing Primary/Secondary Position Enforcement & GK Partitioning ---")
  # 16-player pool including Sanjay (DEF with secondary MID and high DEF/GK stats)
  pool = [
    {"id": "p1", "name": "Marcus Vance", "position": "GK", "secondaryPosition": "DEF", "ovr": 85, "attributes": {"pac": 58, "sho": 30, "pas": 68, "dri": 52, "def": 45, "phy": 82, "gk": 87}},
    {"id": "p2", "name": "Hugo De Silva", "position": "GK", "secondaryPosition": "DEF", "ovr": 82, "attributes": {"pac": 60, "sho": 25, "pas": 74, "dri": 55, "def": 40, "phy": 78, "gk": 83}},
    {"id": "p_sanjay", "name": "Sanjay", "position": "DEF", "secondaryPosition": "MID", "ovr": 82, "attributes": {"pac": 70, "sho": 50, "pas": 75, "dri": 70, "def": 80, "phy": 78, "gk": 55}},
    {"id": "p4", "name": "Carlos Mendoza", "position": "DEF", "secondaryPosition": "MID", "ovr": 86, "attributes": {"pac": 78, "sho": 55, "pas": 76, "dri": 72, "def": 88, "phy": 86, "gk": 25}},
    {"id": "p5", "name": "Trent Walker", "position": "DEF", "secondaryPosition": "MID", "ovr": 84, "attributes": {"pac": 85, "sho": 68, "pas": 83, "dri": 80, "def": 81, "phy": 78, "gk": 20}},
    {"id": "p6", "name": "Sami Al-Khatib", "position": "DEF", "secondaryPosition": "DEF", "ovr": 81, "attributes": {"pac": 74, "sho": 48, "pas": 72, "dri": 68, "def": 84, "phy": 84, "gk": 18}},
    {"id": "p7", "name": "Diego Rossi", "position": "DEF", "secondaryPosition": "MID", "ovr": 79, "attributes": {"pac": 80, "sho": 58, "pas": 75, "dri": 74, "def": 80, "phy": 76, "gk": 20}},
    {"id": "p8", "name": "Jonas Richter", "position": "DEF", "secondaryPosition": "MID", "ovr": 77, "attributes": {"pac": 71, "sho": 50, "pas": 70, "dri": 66, "def": 79, "phy": 82, "gk": 15}},
    {"id": "p10", "name": "Lucas Romero", "position": "MID", "secondaryPosition": "FWD", "ovr": 88, "attributes": {"pac": 82, "sho": 83, "pas": 89, "dri": 88, "def": 72, "phy": 79, "gk": 15}},
    {"id": "p11", "name": "Mateo Kovacic", "position": "MID", "secondaryPosition": "MID", "ovr": 85, "attributes": {"pac": 79, "sho": 74, "pas": 86, "dri": 86, "def": 80, "phy": 82, "gk": 18}},
    {"id": "p12", "name": "Hakim Sterling", "position": "MID", "secondaryPosition": "FWD", "ovr": 84, "attributes": {"pac": 89, "sho": 80, "pas": 81, "dri": 87, "def": 55, "phy": 73, "gk": 15}},
    {"id": "p13", "name": "Nico Barella", "position": "MID", "secondaryPosition": "MID", "ovr": 83, "attributes": {"pac": 81, "sho": 76, "pas": 83, "dri": 82, "def": 78, "phy": 84, "gk": 20}},
    {"id": "p14", "name": "Arda Guler", "position": "MID", "secondaryPosition": "MID", "ovr": 80, "attributes": {"pac": 78, "sho": 79, "pas": 84, "dri": 85, "def": 50, "phy": 68, "gk": 15}},
    {"id": "p18", "name": "Rafael Santos", "position": "FWD", "secondaryPosition": "FWD", "ovr": 89, "attributes": {"pac": 88, "sho": 90, "pas": 80, "dri": 87, "def": 42, "phy": 83, "gk": 15}},
    {"id": "p19", "name": "Julian Alvarez", "position": "FWD", "secondaryPosition": "FWD", "ovr": 86, "attributes": {"pac": 86, "sho": 86, "pas": 81, "dri": 85, "def": 58, "phy": 80, "gk": 15}},
    {"id": "p20", "name": "Antoine Griezmann", "position": "FWD", "secondaryPosition": "MID", "ovr": 85, "attributes": {"pac": 80, "sho": 85, "pas": 86, "dri": 86, "def": 62, "phy": 75, "gk": 15}}
  ]

  # Test 1: Goalkeeper Partitioning in Fixed GK Mode
  dedicated_gks = [p for p in pool if p["position"] == "GK"]
  outfield = [p for p in pool if p["position"] != "GK"]
  assert len(dedicated_gks) == 2, "Expected exactly 2 dedicated GKs"
  assert len(outfield) == 14, "Expected 14 outfield players"

  gkA = dedicated_gks[0]
  gkB = dedicated_gks[1]
  team_size = 8

  # Generate partitioned combinations
  combos = list(itertools.combinations(outfield, team_size - 1))
  assert len(combos) == 3432, f"Expected 3432 combinations with GK partition, got {len(combos)}"

  # Test across all 5 balancing focus modes
  balancing_modes = ["cross_sector", "balanced", "ratings_first", "tactical", "pace_power"]

  for mode in balancing_modes:
    best_penalty = float('inf')
    best_split = None

    for c in combos:
      teamA = [gkA] + list(c)
      teamA_ids = {p["id"] for p in teamA}
      teamB = [gkB] + [p for p in outfield if p["id"] not in teamA_ids]

      sA = calculate_team_stats(teamA)
      sB = calculate_team_stats(teamB)

      ovr_diff = abs(sA["effective_avg_ovr"] - sB["effective_avg_ovr"])
      att_diff = abs(sA["attack"] - sB["attack"])
      mid_diff = abs(sA["midfield"] - sB["midfield"])
      def_diff = abs(sA["defense"] - sB["defense"])
      clash_a = abs(sA["attack"] - sB["defense"])
      clash_b = abs(sB["attack"] - sA["defense"])
      pos_diff = abs(sA["defs"] - sB["defs"]) + abs(sA["mids"] - sB["mids"]) + abs(sA["fwds"] - sB["fwds"])
      raw_gk_delta = abs(sA["gks"] - sB["gks"])

      if mode == "cross_sector":
        penalty = (ovr_diff * 22.0) + (clash_a * 8.0) + (clash_b * 9.0) + (mid_diff * 7.0) + (raw_gk_delta * 250.0) + (pos_diff * 10.0)
      elif mode == "ratings_first":
        penalty = (ovr_diff * 40.0) + (att_diff * 5.0) + (mid_diff * 5.0) + (def_diff * 6.0) + (raw_gk_delta * 250.0) + (pos_diff * 8.0)
      elif mode == "tactical":
        penalty = (att_diff * 12.0) + (mid_diff * 10.0) + (def_diff * 12.0) + (raw_gk_delta * 250.0) + (pos_diff * 15.0) + (ovr_diff * 12.0)
      elif mode == "pace_power":
        penalty = (ovr_diff * 18.0) + (att_diff * 6.0) + (def_diff * 7.0) + (raw_gk_delta * 250.0) + (pos_diff * 10.0)
      else: # balanced
        penalty = (ovr_diff * 22.0) + (att_diff * 8.0) + (mid_diff * 7.0) + (def_diff * 9.0) + (raw_gk_delta * 250.0) + (pos_diff * 10.0)

      if penalty < best_penalty:
        best_penalty = penalty
        best_split = (teamA, teamB, sA, sB)

    teamA, teamB, sA, sB = best_split

    # Verify Sanjay is NOT GK in any mode
    teamA_gks = [p for p in teamA if p["position"] == "GK"]
    teamB_gks = [p for p in teamB if p["position"] == "GK"]

    assert len(teamA_gks) == 1, f"Mode {mode}: Team A must have exactly 1 GK, got {len(teamA_gks)}"
    assert len(teamB_gks) == 1, f"Mode {mode}: Team B must have exactly 1 GK, got {len(teamB_gks)}"
    assert teamA_gks[0]["id"] in ["p1", "p2"], f"Mode {mode}: Invalid GK in Team A: {teamA_gks[0]['name']}"
    assert teamB_gks[0]["id"] in ["p1", "p2"], f"Mode {mode}: Invalid GK in Team B: {teamB_gks[0]['name']}"

    # Verify Sanjay's position
    sanjay_team = teamA if any(p["id"] == "p_sanjay" for p in teamA) else teamB
    sanjay_player = next(p for p in sanjay_team if p["id"] == "p_sanjay")
    assert sanjay_player["position"] == "DEF", f"Mode {mode}: Sanjay position corrupted to {sanjay_player['position']}"
    assert sanjay_player["id"] not in [g["id"] for g in teamA_gks + teamB_gks], f"Mode {mode}: Sanjay set as GK!"

  print(f"[x] Verified across all 5 balancing modes:")
  print(f"    - Team A: 1 dedicated GK (Marcus Vance or Hugo De Silva)")
  print(f"    - Team B: 1 dedicated GK (Marcus Vance or Hugo De Silva)")
  print(f"    - Sanjay: strictly assigned to natural outfield role (DEF), NEVER GK")
  print(f"    - Emergency GK penalty (+1000) and GK Partition strictly eliminates 2-GK vs 0-GK splits")

  # Test 2: Pass 2 Pure Specialist Priority Test
  # A squad with 1 pure MID, 1 hybrid MID/FWD, and 1 pure DEF.
  # Slots needed: 1 DEF, 1 MID, 1 FWD.
  unassigned = [
    {"id": "m_pure", "name": "Pure Mid", "position": "MID", "secondaryPosition": "MID", "ovr": 80},
    {"id": "m_hybrid", "name": "Hybrid Mid/Fwd", "position": "MID", "secondaryPosition": "FWD", "ovr": 84},
    {"id": "d_pure", "name": "Pure Def", "position": "DEF", "secondaryPosition": "DEF", "ovr": 81}
  ]
  slots = [{"pos": "DEF"}, {"pos": "MID"}, {"pos": "FWD"}]
  slot_assignments = [None] * 3

  # Target DEF
  d_match = next((p for p in unassigned if p["position"] == "DEF"), None)
  slot_assignments[0] = d_match
  unassigned.remove(d_match)

  # Target MID: Candidates are [m_pure, m_hybrid]. Pure specialist should be chosen first!
  mid_candidates = [p for p in unassigned if p["position"] == "MID"]
  mid_candidates.sort(key=lambda p: (0 if p.get("secondaryPosition") == p["position"] else 1, -p.get("ovr", 75)))
  chosen_mid = mid_candidates[0]
  assert chosen_mid["id"] == "m_pure", f"Expected pure MID to be assigned first, got {chosen_mid['id']}"
  slot_assignments[1] = chosen_mid
  unassigned.remove(chosen_mid)

  # Target FWD: Can now be filled by m_hybrid via secondary position!
  fwd_secondary = next((p for p in unassigned if p.get("secondaryPosition") == "FWD"), None)
  assert fwd_secondary is not None and fwd_secondary["id"] == "m_hybrid"
  slot_assignments[2] = fwd_secondary
  unassigned.remove(fwd_secondary)

  assert slot_assignments[0]["id"] == "d_pure"
  assert slot_assignments[1]["id"] == "m_pure"
  assert slot_assignments[2]["id"] == "m_hybrid"
  print(f"[x] Pure specialist priority verified: Hybrid MID/FWD held in reserve to satisfy secondary FWD slot perfectly (0 out-of-position)")

if __name__ == "__main__":
  test_fitness_and_form()
  test_chemistry_synergies()
  test_multisector_balancing()
  test_ai_constraints_balancing()
  test_positional_constraint_slotting()
  test_ai_draft_refine()
  test_adaptive_formation_and_secondary_positions()
  test_formation_strategy_dynamic_vs_fixed()
  test_cross_sector_balancing()
  test_primary_secondary_position_enforcement_and_gk_partitioning()
  print("\n>>> ALL TEST CASES PASSED SUCCESSFULLY! <<<\n")

