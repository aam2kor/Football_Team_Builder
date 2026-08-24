"""
Unit tests verifying multi-sector balance:
- Attacking balance
- Midfield balance
- Defensive balance (including GK)
- Overall rating & synergy balance
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

def calculate_detailed_sector_stats(team):
  n = len(team)
  total_ovr = sum(p["ovr"] for p in team)
  gks = sum(1 for p in team if p["position"] == "GK")
  defs = sum(1 for p in team if p["position"] == "DEF")
  mids = sum(1 for p in team if p["position"] == "MID")
  fwds = sum(1 for p in team if p["position"] == "FWD")

  # Sector weights based on positional role
  att_weighted_sum = 0
  att_weight_total = 0

  mid_weighted_sum = 0
  mid_weight_total = 0

  def_weighted_sum = 0
  def_weight_total = 0

  max_gk = 0

  for p in team:
    a = p["attributes"]
    pos = p["position"]
    max_gk = max(max_gk, a["gk"])

    # Individual player scores
    p_att = a["sho"] * 0.45 + a["dri"] * 0.30 + a["pac"] * 0.25
    p_mid = a["pas"] * 0.40 + a["dri"] * 0.30 + a["def"] * 0.15 + a["pac"] * 0.15
    p_def = a["def"] * 0.55 + a["phy"] * 0.30 + a["pac"] * 0.15

    # Role multipliers
    att_role_w = 1.4 if pos == "FWD" else 1.0 if pos == "MID" else 0.5
    mid_role_w = 1.4 if pos == "MID" else 1.0 if pos == "FWD" else 0.7
    def_role_w = 1.4 if pos == "DEF" else 0.9 if pos == "MID" else 0.5

    att_weighted_sum += p_att * att_role_w
    att_weight_total += att_role_w

    mid_weighted_sum += p_mid * mid_role_w
    mid_weight_total += mid_role_w

    def_weighted_sum += p_def * def_role_w
    def_weight_total += def_role_w

  attack_rating = round(att_weighted_sum / att_weight_total)
  midfield_rating = round(mid_weighted_sum / mid_weight_total)
  outfield_def = round(def_weighted_sum / def_weight_total)

  # Defense including GK
  defense_incl_gk = round(outfield_def * 0.65 + max_gk * 0.35)

  avg_ovr = total_ovr / n

  return {
    "avg_ovr": avg_ovr,
    "attack": attack_rating,
    "midfield": midfield_rating,
    "defense": defense_incl_gk,
    "outfield_def": outfield_def,
    "gk": max_gk,
    "gks": gks, "defs": defs, "mids": mids, "fwds": fwds
  }

def score_multisector_split(teamA, teamB):
  sA = calculate_detailed_sector_stats(teamA)
  sB = calculate_detailed_sector_stats(teamB)

  ovr_diff = abs(sA["avg_ovr"] - sB["avg_ovr"])
  att_diff = abs(sA["attack"] - sB["attack"])
  mid_diff = abs(sA["midfield"] - sB["midfield"])
  def_diff = abs(sA["defense"] - sB["defense"])
  gk_diff = abs(sA["gks"] - sB["gks"])
  pos_diff = abs(sA["defs"] - sB["defs"]) + abs(sA["mids"] - sB["mids"]) + abs(sA["fwds"] - sB["fwds"])

  # High penalty on Attacking, Midfield, and Defense (incl GK) differentials
  penalty = (ovr_diff * 20) + (att_diff * 8) + (mid_diff * 7) + (def_diff * 9) + (gk_diff * 35) + (pos_diff * 4)
  return penalty, sA, sB

def test_multisector_balancing():
  print("=== Testing Multi-Sector Balancing (ATT, MID, DEF incl GK) ===")
  n = len(SAMPLE_PLAYERS)
  team_size = n // 2
  all_set = frozenset(range(n))

  best_penalty = float('inf')
  best_teams = None

  t0 = time.perf_counter()
  for c in itertools.combinations(range(1, n), team_size - 1):
    idx_A = (0,) + c
    idx_B = tuple(all_set.difference(idx_A))

    teamA = [SAMPLE_PLAYERS[i] for i in idx_A]
    teamB = [SAMPLE_PLAYERS[i] for i in idx_B]

    penalty, sA, sB = score_multisector_split(teamA, teamB)
    if penalty < best_penalty:
      best_penalty = penalty
      best_teams = (teamA, teamB, sA, sB, penalty)

  t1 = time.perf_counter()
  teamA, teamB, sA, sB, penalty = best_teams

  print(f"[x] Combinatorial evaluation completed in {(t1-t0)*1000:.2f} ms")
  print(f"    Team A: OVR={sA['avg_ovr']:.1f} | ⚔️ ATT={sA['attack']} | ⚙️ MID={sA['midfield']} | 🛡️ DEF(incl GK)={sA['defense']} (GK: {sA['gk']})")
  print(f"    Team B: OVR={sB['avg_ovr']:.1f} | ⚔️ ATT={sB['attack']} | ⚙️ MID={sB['midfield']} | 🛡️ DEF(incl GK)={sB['defense']} (GK: {sB['gk']})")

  att_delta = abs(sA["attack"] - sB["attack"])
  mid_delta = abs(sA["midfield"] - sB["midfield"])
  def_delta = abs(sA["defense"] - sB["defense"])
  ovr_delta = abs(sA["avg_ovr"] - sB["avg_ovr"])

  print(f"    Deltas -> OVR: {ovr_delta:.1f} | ATT: {att_delta} | MID: {mid_delta} | DEF(incl GK): {def_delta}")

  assert ovr_delta <= 1.0, f"OVR delta too high: {ovr_delta}"
  assert att_delta <= 2, f"Attacking delta too high: {att_delta}"
  assert mid_delta <= 2, f"Midfield delta too high: {mid_delta}"
  assert def_delta <= 2, f"Defensive delta too high: {def_delta}"
  assert sA["gks"] == 1 and sB["gks"] == 1, "GKs not split equally"

  print("\n>>> ALL MULTI-SECTOR BALANCING TESTS PASSED! <<<\n")

if __name__ == "__main__":
  test_multisector_balancing()
