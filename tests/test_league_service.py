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

  print(f"[x] Top 3 Scorers Verified: 1. {top_scorers[0][0]} ({top_scorers[0][1]}G), 2. {top_scorers[1][0]} ({top_scorers[1][1]}G), 3. {top_scorers[2][0]} ({top_scorers[2][1]}G)")

  print(f"[x] Top 3 Scorers Verified: 1. {top_scorers[0][0]} ({top_scorers[0][1]}G), 2. {top_scorers[1][0]} ({top_scorers[1][1]}G), 3. {top_scorers[2][0]} ({top_scorers[2][1]}G)")

if __name__ == "__main__":
  test_h2h_calculation()
  test_player_stats()
  test_top_winners_and_losers()
  test_top_goal_scorers()
  print("\n>>> ALL LEAGUE SERVICE TESTS PASSED! <<<\n")
