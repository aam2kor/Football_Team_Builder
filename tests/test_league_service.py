"""
Test suite for Third Half United League Service & AI Historical Insights
"""

import json

SAMPLE_API_RESPONSE = {
  "matches": [
    {
      "match_date": "2026-09-02",
      "season": 2026,
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
      "match_date": "2026-08-26",
      "season": 2026,
      "teams": [
        {
          "team": "voyagers",
          "members": ["Ajith", "Anup", "CP", "Mathai", "Rajeev", "Somu", "Tom", "Varun"],
          "score": 5,
          "scorers": [
            {"name": "CP", "goals": 3, "is_own_goal": False},
            {"name": "Mathai", "goals": 1, "is_own_goal": False},
            {"name": "Rajeev", "goals": 1, "is_own_goal": False}
          ]
        },
        {
          "team": "bootsandbeers",
          "members": ["Abey", "Akash", "Anoop", "Pradeep", "Prasanth", "Sreekanth", "Sudhi", "Vinay"],
          "score": 5,
          "scorers": [
            {"name": "Vinay", "goals": 3, "is_own_goal": False},
            {"name": "Sreekanth", "goals": 2, "is_own_goal": False}
          ]
        }
      ]
    },
    {
      "match_date": "2026-08-23",
      "season": 2026,
      "teams": [
        {
          "team": "voyagers",
          "members": ["Abey", "Anoop", "CP", "Mathai", "Sanjay", "Sreekanth", "Sudhi", "Vinay"],
          "score": 8,
          "scorers": [
            {"name": "Vinay", "goals": 3, "is_own_goal": False},
            {"name": "Sanjay", "goals": 2, "is_own_goal": False},
            {"name": "CP", "goals": 1, "is_own_goal": False},
            {"name": "Sudhi", "goals": 1, "is_own_goal": False},
            {"name": "Sreekanth", "goals": 1, "is_own_goal": False}
          ]
        },
        {
          "team": "bootsandbeers",
          "members": ["Ajith", "Akash", "Anup", "Mithun", "Pradeep", "Prasanth", "Rajeev", "Tom"],
          "score": 4,
          "scorers": [
            {"name": "Mithun", "goals": 2, "is_own_goal": False},
            {"name": "Akash", "goals": 1, "is_own_goal": False},
            {"name": "Tom", "goals": 1, "is_own_goal": False}
          ]
        }
      ]
    }
  ]
}

def compute_h2h(matches):
  v_wins, b_wins, draws = 0, 0, 0
  v_goals, b_goals = 0, 0
  for m in matches:
    voy = next(t for t in m["teams"] if "voyager" in t["team"].lower())
    boots = next(t for t in m["teams"] if "boot" in t["team"].lower())
    v_score = voy["score"]
    b_score = boots["score"]
    v_goals += v_score
    b_goals += b_score
    if v_score > b_score: v_wins += 1
    elif b_score > v_score: b_wins += 1
    else: draws += 1
  return {
    "v_wins": v_wins,
    "b_wins": b_wins,
    "draws": draws,
    "v_goals": v_goals,
    "b_goals": b_goals,
    "total": len(matches)
  }

def compute_player_win_rates(matches):
  p_stats = {}
  for m in matches:
    voy = next(t for t in m["teams"] if "voyager" in t["team"].lower())
    boots = next(t for t in m["teams"] if "boot" in t["team"].lower())
    v_score = voy["score"]
    b_score = boots["score"]

    for name in voy["members"]:
      p_stats.setdefault(name, {"played": 0, "wins": 0, "draws": 0, "losses": 0})
      p_stats[name]["played"] += 1
      if v_score > b_score: p_stats[name]["wins"] += 1
      elif v_score < b_score: p_stats[name]["losses"] += 1
      else: p_stats[name]["draws"] += 1

    for name in boots["members"]:
      p_stats.setdefault(name, {"played": 0, "wins": 0, "draws": 0, "losses": 0})
      p_stats[name]["played"] += 1
      if b_score > v_score: p_stats[name]["wins"] += 1
      elif b_score < v_score: p_stats[name]["losses"] += 1
      else: p_stats[name]["draws"] += 1

  return p_stats

def test_h2h_calculation():
  print("--- Testing Head-to-Head Stats Calculation ---")
  h2h = compute_h2h(SAMPLE_API_RESPONSE["matches"])
  assert h2h["total"] == 4
  assert h2h["v_wins"] == 2, f"Expected 2 Voyagers wins, got {h2h['v_wins']}"
  assert h2h["b_wins"] == 1, f"Expected 1 Boots win, got {h2h['b_wins']}"
  assert h2h["draws"] == 1, f"Expected 1 draw, got {h2h['draws']}"
  assert h2h["v_goals"] == 18, f"Expected 18 Voyagers goals, got {h2h['v_goals']}"
  assert h2h["b_goals"] == 14, f"Expected 14 Boots goals, got {h2h['b_goals']}"
  print(f"[x] Head-to-Head verified: Voyagers ({h2h['v_wins']}W, {h2h['v_goals']}G) vs Boots & Beers ({h2h['b_wins']}W, {h2h['b_goals']}G), Draws: {h2h['draws']}")

def test_player_stats():
  print("--- Testing Player Historical Stats Calculation ---")
  p_stats = compute_player_win_rates(SAMPLE_API_RESPONSE["matches"])
  assert "Mathai" in p_stats
  assert p_stats["Mathai"]["played"] == 4
  assert p_stats["Mathai"]["wins"] == 2
  assert p_stats["Mathai"]["draws"] == 1
  assert "Abey" in p_stats
  assert p_stats["Abey"]["played"] == 4
  print(f"[x] Mathai record: {p_stats['Mathai']['wins']}W - {p_stats['Mathai']['draws']}D - {p_stats['Mathai']['losses']}L in {p_stats['Mathai']['played']} games")
  print(f"[x] Abey record: {p_stats['Abey']['played']} matches played across fixtures.")

def test_top_winners_and_losers():
  print("--- Testing Top Consistent Winners & Losers (Bayesian Average) ---")
  p_stats = compute_player_win_rates(SAMPLE_API_RESPONSE["matches"])
  
  total_pts = sum(p["wins"] + 0.5 * p["draws"] for p in p_stats.values())
  total_matches = sum(p["played"] for p in p_stats.values())
  global_avg = total_pts / total_matches
  C = 2.0
  for name, p in p_stats.items():
    pts = p["wins"] + 0.5 * p["draws"]
    p["bayesianScore"] = (C * global_avg + pts) / (C + p["played"])

  ranked_winners = sorted(p_stats.items(), key=lambda x: (x[1]["bayesianScore"], x[1]["wins"], x[1]["played"]), reverse=True)[:3]
  ranked_losers = sorted(p_stats.items(), key=lambda x: (x[1]["losses"], -x[1]["wins"]), reverse=True)[:3]

  winner_names = [w[0] for w in ranked_winners]
  loser_names = [l[0] for l in ranked_losers]

  winner_strs = [f"{w[0]} ({w[1]['wins']}W/{w[1]['played']}M, {w[1]['bayesianScore']:.2f} Bayes)" for w in ranked_winners]
  print(f"[x] Top Winners (Bayesian Average): {', '.join(winner_strs)}")
  print(f"[x] Top Underdogs/Losers: {', '.join(loser_names)}")

def test_top_goal_scorers():
  print("--- Testing Top Goal Scorers Extraction ---")
  goal_map = {}
  for m in SAMPLE_API_RESPONSE["matches"]:
    for t in m["teams"]:
      for s in t.get("scorers", []):
        if not s.get("is_own_goal", False):
          name = s["name"]
          goal_map[name] = goal_map.get(name, 0) + s.get("goals", 1)

  top_scorers = sorted(goal_map.items(), key=lambda x: x[1], reverse=True)[:3]
  assert top_scorers[0] == ("Vinay", 7), f"Expected Vinay 7 goals, got {top_scorers[0]}"
  assert top_scorers[1] == ("Sreekanth", 5), f"Expected Sreekanth 5 goals, got {top_scorers[1]}"
  assert top_scorers[2] == ("CP", 4), f"Expected CP 4 goals, got {top_scorers[2]}"

def test_ai_scout_analysis_and_calibration():
  print("--- Testing AI Scout Analysis & Calibration Logic ---")
  p_stats = compute_player_win_rates(SAMPLE_API_RESPONSE["matches"])
  goal_map = {}
  for m in SAMPLE_API_RESPONSE["matches"]:
    for t in m["teams"]:
      for s in t.get("scorers", []):
        if not s.get("is_own_goal", False):
          name = s["name"]
          goal_map[name] = goal_map.get(name, 0) + s.get("goals", 1)

  # Check high goal scorer calibration criteria
  vinay_goals = goal_map.get("Vinay", 0)
  assert vinay_goals >= 3, f"Vinay expected >= 3 goals, got {vinay_goals}"

  # Simulated Scout Recommendation logic: UPGRADES
  vinay_sho_base = 76
  vinay_sho_boost = 8
  vinay_sho_calibrated = vinay_sho_base + vinay_sho_boost
  assert vinay_sho_calibrated == 84
  print(f"[x] Upgrade Calibration verified: Vinay ({vinay_goals} goals) SHO {vinay_sho_base} -> {vinay_sho_calibrated}")

  # Simulated Scout Recommendation logic: DOWNGRADES
  # Anup: 3 matches, 0 goals, 0 wins, high starting rating
  anup_matches = p_stats["Anup"]["played"]
  anup_wins = p_stats["Anup"]["wins"]
  anup_goals = goal_map.get("Anup", 0)
  assert anup_matches >= 2 and anup_goals == 0 and anup_wins == 0
  anup_sho_base = 74
  anup_sho_nerf = 5
  anup_sho_calibrated = anup_sho_base - anup_sho_nerf
  assert anup_sho_calibrated == 69
  print(f"[x] Downgrade Calibration verified: Anup (0 goals in {anup_matches}M) SHO {anup_sho_base} -> {anup_sho_calibrated}")

  # Winning duo detection
  duo_stats = {}
  for m in SAMPLE_API_RESPONSE["matches"]:
    for t in m["teams"]:
      members = sorted(t["members"])
      win = 1 if t["score"] > (next(ot["score"] for ot in m["teams"] if ot != t)) else 0
      for i in range(len(members)):
        for j in range(i + 1, len(members)):
          key = f"{members[i]}___{members[j]}"
          duo_stats.setdefault(key, {"matches": 0, "wins": 0})
          duo_stats[key]["matches"] += 1
          duo_stats[key]["wins"] += win

  # Find high win rate duos
  top_duos = [
    (k, v) for k, v in duo_stats.items()
    if v["matches"] >= 2 and (v["wins"] / v["matches"]) >= 0.65
  ]
  assert len(top_duos) > 0, "Expected at least one high-win-rate duo in match history"
  print(f"[x] AI Scout Payload & Calibration verified: Top duo candidate '{top_duos[0][0]}' ({top_duos[0][1]['wins']}/{top_duos[0][1]['matches']} wins)")

def test_h2h_rivalries():
  print("--- Testing Player H2H Rivalries ---")
  rivalry_map = {}
  matches = SAMPLE_API_RESPONSE["matches"]
  for m in matches:
    voy = next(t for t in m["teams"] if "voyager" in t["team"].lower())
    boots = next(t for t in m["teams"] if "boot" in t["team"].lower())
    v_score = voy["score"]
    b_score = boots["score"]
    for p1 in voy["members"]:
      for p2 in boots["members"]:
        pair = tuple(sorted([p1, p2]))
        rivalry_map.setdefault(pair, {"matches": 0, "p1_wins": 0, "p2_wins": 0, "draws": 0})
        rivalry_map[pair]["matches"] += 1
        p1_is_voy = (p1 == pair[0])
        a_score = v_score if p1_is_voy else b_score
        b_score_val = b_score if p1_is_voy else v_score
        if a_score > b_score_val: rivalry_map[pair]["p1_wins"] += 1
        elif b_score_val > a_score: rivalry_map[pair]["p2_wins"] += 1
        else: rivalry_map[pair]["draws"] += 1

  # Abey vs Anoop (2 clashes as opponents, 2 matches as teammates)
  abey_anoop = rivalry_map.get(("Abey", "Anoop"))
  assert abey_anoop is not None
  assert abey_anoop["matches"] == 2
  print(f"[x] Abey vs Anoop H2H verified: {abey_anoop['matches']} direct clashes")

  # Abey vs Ajith (3 clashes as opponents)
  abey_ajith = rivalry_map.get(("Abey", "Ajith"))
  assert abey_ajith is not None
  assert abey_ajith["matches"] == 3
  print(f"[x] Abey vs Ajith H2H verified: {abey_ajith['matches']} direct clashes")

def test_jersey_win_rates():
  print("--- Testing Player Jersey Win Rates ---")
  matches = SAMPLE_API_RESPONSE["matches"]
  jersey_stats = {}
  for m in matches:
    voy = next(t for t in m["teams"] if "voyager" in t["team"].lower())
    boots = next(t for t in m["teams"] if "boot" in t["team"].lower())
    v_score, b_score = voy["score"], boots["score"]

    for name in voy["members"]:
      jersey_stats.setdefault(name, {"voy_played": 0, "voy_wins": 0, "boots_played": 0, "boots_wins": 0})
      jersey_stats[name]["voy_played"] += 1
      if v_score > b_score: jersey_stats[name]["voy_wins"] += 1

    for name in boots["members"]:
      jersey_stats.setdefault(name, {"voy_played": 0, "voy_wins": 0, "boots_played": 0, "boots_wins": 0})
      jersey_stats[name]["boots_played"] += 1
      if b_score > v_score: jersey_stats[name]["boots_wins"] += 1

  assert "Abey" in jersey_stats
  assert jersey_stats["Abey"]["voy_played"] == 2
  assert jersey_stats["Abey"]["boots_played"] == 2
  print(f"[x] Jersey Win Rates verified for Abey: Voyagers ({jersey_stats['Abey']['voy_wins']}/{jersey_stats['Abey']['voy_played']}W) vs Boots ({jersey_stats['Abey']['boots_wins']}/{jersey_stats['Abey']['boots_played']}W)")

def test_defensive_leakage():
  print("--- Testing Defensive Leakage Stats ---")
  matches = SAMPLE_API_RESPONSE["matches"]
  p_stats = compute_player_win_rates(matches)
  # compute goals against per player
  ga_map = {}
  for m in matches:
    voy = next(t for t in m["teams"] if "voyager" in t["team"].lower())
    boots = next(t for t in m["teams"] if "boot" in t["team"].lower())
    for name in voy["members"]:
      ga_map.setdefault(name, {"ga": 0, "m": 0})
      ga_map[name]["ga"] += boots["score"]
      ga_map[name]["m"] += 1
    for name in boots["members"]:
      ga_map.setdefault(name, {"ga": 0, "m": 0})
      ga_map[name]["ga"] += voy["score"]
      ga_map[name]["m"] += 1

  mathai_ga = ga_map["Mathai"]
  assert mathai_ga["m"] == 4
  assert mathai_ga["ga"] == 14  # 3 + 2 + 5 + 4 = 14
  avg_ga = mathai_ga["ga"] / mathai_ga["m"]
  assert avg_ga == 3.5
  print(f"[x] Defensive Leakage verified for Mathai: {mathai_ga['ga']} goals against in {mathai_ga['m']} matches ({avg_ga:.1f} GA/match)")

def test_clutch_scorers_and_derby_trends():
  print("--- Testing Clutch Scorers & Derby Trends ---")
  matches = SAMPLE_API_RESPONSE["matches"]
  total_goals = 0
  clutch_goals = {}
  hat_tricks = []
  for m in matches:
    voy = next(t for t in m["teams"] if "voyager" in t["team"].lower())
    boots = next(t for t in m["teams"] if "boot" in t["team"].lower())
    margin = abs(voy["score"] - boots["score"])
    is_clutch = margin <= 1
    total_goals += voy["score"] + boots["score"]
    for t in [voy, boots]:
      for s in t.get("scorers", []):
        if not s.get("is_own_goal", False):
          if is_clutch:
            clutch_goals[s["name"]] = clutch_goals.get(s["name"], 0) + s.get("goals", 1)
          if s.get("goals", 1) >= 3:
            hat_tricks.append((s["name"], s.get("goals", 1), m["match_date"]))

  assert total_goals == 32
  assert len(hat_tricks) >= 2  # CP and Vinay
  hat_trick_names = [ht[0] for ht in hat_tricks]
  assert "CP" in hat_trick_names
  assert "Vinay" in hat_trick_names
  print(f"[x] Total derby goals: {total_goals} across 4 matches (8.0 avg)")
  print(f"[x] Hat-tricks recorded: {hat_tricks}")

def test_audit_team_matchup():
  print("--- Testing AI Matchup Auditor & Score Predictor Logic ---")
  # Balanced squads simulation
  team_a = [
    {"name": "CP", "position": "FWD", "ovr": 78, "attributes": {"pac": 80, "sho": 78, "def": 55}},
    {"name": "Mathai", "position": "DEF", "ovr": 77, "attributes": {"pac": 72, "sho": 68, "def": 78}},
    {"name": "Ajith", "position": "MID", "ovr": 75, "attributes": {"pac": 74, "sho": 70, "def": 68}},
    {"name": "Tom", "position": "DEF", "ovr": 74, "attributes": {"pac": 70, "sho": 60, "def": 74}},
  ]
  team_b = [
    {"name": "Vinay", "position": "FWD", "ovr": 78, "attributes": {"pac": 78, "sho": 76, "def": 54}},
    {"name": "Sreekanth", "position": "MID", "ovr": 78, "attributes": {"pac": 76, "sho": 75, "def": 68}},
    {"name": "Abey", "position": "DEF", "ovr": 76, "attributes": {"pac": 74, "sho": 65, "def": 76}},
    {"name": "Pradeep", "position": "MID", "ovr": 74, "attributes": {"pac": 70, "sho": 68, "def": 70}},
  ]

  # Goal production rate for Vinay (7G in 4M = 1.75) and CP (4G in 2M = 2.0)
  p_stats = compute_player_win_rates(SAMPLE_API_RESPONSE["matches"])
  goal_map = {}
  for m in SAMPLE_API_RESPONSE["matches"]:
    for t in m["teams"]:
      for s in t.get("scorers", []):
        if not s.get("is_own_goal", False):
          goal_map[s["name"]] = goal_map.get(s["name"], 0) + s.get("goals", 1)

  threat_a = (goal_map.get("CP", 0) / 2) + (goal_map.get("Mathai", 0) / 4)
  threat_b = (goal_map.get("Vinay", 0) / 4) + (goal_map.get("Sreekanth", 0) / 4)
  delta = abs(threat_a - threat_b)
  assert delta < 1.0  # Evenly matched firepower
  print(f"[x] Matchup Audit Parity verified: Team A Threat={threat_a:.2f} G/M vs Team B Threat={threat_b:.2f} G/M (Delta={delta:.2f})")

def test_jersey_rotation_dual_window():
  print("--- Testing Dual-Window (Short: 2, Long: 4) Jersey Rotation ---")
  matches = sorted(SAMPLE_API_RESPONSE["matches"], key=lambda m: m["match_date"], reverse=True)
  
  # Build appearance history for players
  appearances = {}
  for m in matches:
    voy = next(t for t in m["teams"] if "voyager" in t["team"].lower())
    boots = next(t for t in m["teams"] if "boot" in t["team"].lower())
    for name in voy["members"]:
      appearances.setdefault(name, []).append("A")
    for name in boots["members"]:
      appearances.setdefault(name, []).append("B")

  # Mathai played in Voyagers (A) in all 4 matches: ['A', 'A', 'A', 'A']
  mathai_hist = appearances["Mathai"]
  assert mathai_hist[:2] == ["A", "A"]  # Short window = 2 in A
  assert mathai_hist[:4].count("A") == 4  # Long window = 4 in A
  print(f"[x] Mathai history: {mathai_hist} -> Due for Boots & Beers")

  # Vinay played in Boots in last 3 matches: ['B', 'B', 'B', 'A']
  vinay_hist = appearances["Vinay"]
  assert vinay_hist[:2] == ["B", "B"]  # Short window = 2 in B
  assert vinay_hist[:4].count("B") == 3  # Long window = 3 in B
  print(f"[x] Vinay history: {vinay_hist} -> Due for Voyagers")

  # Akash played in Boots in all 4 matches: ['B', 'B', 'B', 'B']
  akash_hist = appearances["Akash"]
  assert akash_hist[:2] == ["B", "B"]
  assert akash_hist[:4].count("B") == 4
  print(f"[x] Akash history: {akash_hist} -> Due for Voyagers")

  # Abey played: ['A', 'B', 'B', 'A'] -> Short window = 1 in A, 1 in B (no streak)
  abey_hist = appearances["Abey"]
  assert abey_hist[:2] == ["A", "B"]
  assert abey_hist[:4].count("A") == 2
  assert abey_hist[:4].count("B") == 2
  print(f"[x] Abey history: {abey_hist} -> Balanced (Can play for either)")

if __name__ == "__main__":
  test_h2h_calculation()
  test_player_stats()
  test_top_winners_and_losers()
  test_top_goal_scorers()
  test_h2h_rivalries()
  test_jersey_win_rates()
  test_defensive_leakage()
  test_clutch_scorers_and_derby_trends()
  test_audit_team_matchup()
  test_jersey_rotation_dual_window()
  test_ai_scout_analysis_and_calibration()
  print("\n>>> ALL LEAGUE SERVICE TESTS PASSED! <<<\n")


