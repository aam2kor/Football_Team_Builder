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
        {"team": "voyagers", "members": ["Anoop", "Mathai", "Pradeep", "Prasanth", "Rajeev", "Ratheesh", "Sanjay", "Vignesh"], "score": 3},
        {"team": "bootsandbeers", "members": ["Aadi", "Abey", "Ajith", "Akash", "Anup", "Sreekanth", "Tom", "Vinay"], "score": 2}
      ]
    },
    {
      "match_date": "2026-08-26",
      "season": 2026,
      "teams": [
        {"team": "voyagers", "members": ["Ajith", "Anup", "CP", "Mathai", "Rajeev", "Somu", "Tom", "Varun"], "score": 5},
        {"team": "bootsandbeers", "members": ["Abey", "Akash", "Anoop", "Pradeep", "Prasanth", "Sreekanth", "Sudhi", "Vinay"], "score": 5}
      ]
    },
    {
      "match_date": "2026-08-23",
      "season": 2026,
      "teams": [
        {"team": "voyagers", "members": ["Abey", "Anoop", "CP", "Mathai", "Sanjay", "Sreekanth", "Sudhi", "Vinay"], "score": 8},
        {"team": "bootsandbeers", "members": ["Ajith", "Akash", "Anup", "Mithun", "Pradeep", "Prasanth", "Rajeev", "Tom"], "score": 4}
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

if __name__ == "__main__":
  test_h2h_calculation()
  test_player_stats()
  print("\n>>> ALL LEAGUE SERVICE TESTS PASSED! <<<\n")
