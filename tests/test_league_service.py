"""
Test suite for Third Half United League Service & AI Historical Insights
"""

import json

SAMPLE_API_RESPONSE = {
  "matches": [
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
  assert h2h["total"] == 3
  assert h2h["v_wins"] == 2, f"Expected 2 Voyagers wins, got {h2h['v_wins']}"
  assert h2h["b_wins"] == 0, f"Expected 0 Boots wins, got {h2h['b_wins']}"
  assert h2h["draws"] == 1, f"Expected 1 draw, got {h2h['draws']}"
  assert h2h["v_goals"] == 16, f"Expected 16 Voyagers goals, got {h2h['v_goals']}"
  assert h2h["b_goals"] == 11, f"Expected 11 Boots goals, got {h2h['b_goals']}"
  print(f"[x] Head-to-Head verified: Voyagers ({h2h['v_wins']}W, {h2h['v_goals']}G) vs Boots & Beers ({h2h['b_wins']}W, {h2h['b_goals']}G), Draws: {h2h['draws']}")

def test_player_stats():
  print("--- Testing Player Historical Stats Calculation ---")
  p_stats = compute_player_win_rates(SAMPLE_API_RESPONSE["matches"])
  assert "Mathai" in p_stats
  assert p_stats["Mathai"]["played"] == 3
  assert p_stats["Mathai"]["wins"] == 2, f"Expected Mathai 2 wins, got {p_stats['Mathai']['wins']}"
  assert p_stats["Mathai"]["draws"] == 1, f"Expected Mathai 1 draw, got {p_stats['Mathai']['draws']}"
  assert "Abey" in p_stats
  assert p_stats["Abey"]["played"] == 3
  print(f"[x] Mathai record: {p_stats['Mathai']['wins']}W - {p_stats['Mathai']['draws']}D - 0L in {p_stats['Mathai']['played']} games (Undefeated!)")
  print(f"[x] Abey record: {p_stats['Abey']['played']} matches played across fixtures.")

def test_top_winners_and_losers():
  print("--- Testing Top Consistent Winners & Losers ---")
  p_stats = compute_player_win_rates(SAMPLE_API_RESPONSE["matches"])
  winners = sorted(p_stats.items(), key=lambda x: (x[1]["wins"], -x[1]["losses"]), reverse=True)[:3]
  losers = sorted(p_stats.items(), key=lambda x: (x[1]["losses"], -x[1]["wins"]), reverse=True)[:3]

  winner_names = [w[0] for w in winners]
  loser_names = [l[0] for l in losers]

  assert "Anoop" in winner_names or "Mathai" in winner_names or "Sanjay" in winner_names
  assert "Ajith" in loser_names and "Akash" in loser_names and "Anup" in loser_names

  print(f"[x] Top Winners: {', '.join(winner_names)}")
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
  assert top_scorers[0] == ("Vinay", 6), f"Expected Vinay 6 goals, got {top_scorers[0]}"
  assert top_scorers[1] == ("Sreekanth", 4) or top_scorers[1] == ("CP", 4)
  assert top_scorers[2] == ("CP", 4) or top_scorers[2] == ("Sreekanth", 4)

  print(f"[x] Top 3 Scorers Verified: 1. {top_scorers[0][0]} ({top_scorers[0][1]}G), 2. {top_scorers[1][0]} ({top_scorers[1][1]}G), 3. {top_scorers[2][0]} ({top_scorers[2][1]}G)")

if __name__ == "__main__":
  test_h2h_calculation()
  test_player_stats()
  test_top_winners_and_losers()
  test_top_goal_scorers()
  print("\n>>> ALL LEAGUE SERVICE TESTS PASSED! <<<\n")
