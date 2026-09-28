"""
Test suite for Option 3: Form Step Mountain (+1 Win / 0 Draw / -1 Loss)
"""

FALLBACK_MATCHES = [
  {
    "match_date": "2026-08-23",
    "season": 2026,
    "teams": [
      {
        "team": "voyagers",
        "members": ["Abey", "Anoop", "CP", "Mathai", "Sanjay", "Sreekanth", "Sudhi", "Vinay"],
        "score": 8,
        "scorers": [
          {"name": "Vinay", "goals": 3},
          {"name": "Sanjay", "goals": 2},
          {"name": "CP", "goals": 1}
        ]
      },
      {
        "team": "bootsandbeers",
        "members": ["Ajith", "Akash", "Anup", "Mithun", "Pradeep", "Prasanth", "Rajeev", "Tom"],
        "score": 4,
        "scorers": [
          {"name": "Mithun", "goals": 2},
          {"name": "Akash", "goals": 1}
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
          {"name": "CP", "goals": 3},
          {"name": "Mathai", "goals": 1}
        ]
      },
      {
        "team": "bootsandbeers",
        "members": ["Abey", "Akash", "Anoop", "Pradeep", "Prasanth", "Sreekanth", "Sudhi", "Vinay"],
        "score": 5,
        "scorers": [
          {"name": "Vinay", "goals": 3}
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
          {"name": "Rajeev", "goals": 1},
          {"name": "Sanjay", "goals": 1},
          {"name": "Mathai", "goals": 1}
        ]
      },
      {
        "team": "bootsandbeers",
        "members": ["Aadi", "Abey", "Ajith", "Akash", "Anup", "Sreekanth", "Tom", "Vinay"],
        "score": 2,
        "scorers": [
          {"name": "Aadi", "goals": 1}
        ]
      }
    ]
  },
  {
    "match_date": "2026-09-02",
    "season": 2026,
    "teams": [
      {
        "team": "voyagers",
        "members": ["Abey", "Arun", "Jibin", "Mathai", "Pradeep", "Ratheesh", "Varun", "Vignesh"],
        "score": 2,
        "scorers": [
          {"name": "Arun", "goals": 1}
        ]
      },
      {
        "team": "bootsandbeers",
        "members": ["Ajith", "Akash", "Anoop", "Blesson", "Prasanth", "Rajeev", "Sreekanth", "Vinay"],
        "score": 3,
        "scorers": [
          {"name": "Vinay", "goals": 1}
        ]
      }
    ]
  }
]

def compute_player_form_trajectory(player_name, matches):
  clean_name = player_name.strip().lower()
  chron_matches = sorted(matches, key=lambda m: m["match_date"])
  
  history = []
  cumulative_momentum = 0
  wins, draws, losses, total_goals = 0, 0, 0, 0
  jersey_stats = {
    "voyagers": {"matches": 0, "wins": 0, "draws": 0, "losses": 0, "goals": 0},
    "boots": {"matches": 0, "wins": 0, "draws": 0, "losses": 0, "goals": 0}
  }

  for m in chron_matches:
    voy_team = next((t for t in m.get("teams", []) if "voyager" in t.get("team", "").lower()), None)
    boots_team = next((t for t in m.get("teams", []) if "boot" in t.get("team", "").lower()), None)
    if not voy_team or not boots_team:
      continue

    is_voy = any(n.strip().lower() == clean_name for n in voy_team.get("members", []))
    is_boots = any(n.strip().lower() == clean_name for n in boots_team.get("members", []))
    if not is_voy and not is_boots:
      continue

    my_team = voy_team if is_voy else boots_team
    opp_team = boots_team if is_voy else voy_team
    my_score = int(my_team.get("score", 0))
    opp_score = int(opp_team.get("score", 0))
    team_key = "voyagers" if is_voy else "boots"

    if my_score > opp_score:
      outcome = "W"
      delta = 1
      wins += 1
      jersey_stats[team_key]["wins"] += 1
    elif my_score < opp_score:
      outcome = "L"
      delta = -1
      losses += 1
      jersey_stats[team_key]["losses"] += 1
    else:
      outcome = "D"
      delta = 0
      draws += 1
      jersey_stats[team_key]["draws"] += 1

    jersey_stats[team_key]["matches"] += 1
    cumulative_momentum += delta

    goals = 0
    for s in my_team.get("scorers", []):
      s_name = (s.get("name", "") if isinstance(s, dict) else str(s)).strip().lower()
      if s_name == clean_name:
        goals += s.get("goals", 1) if isinstance(s, dict) else 1
    
    total_goals += goals
    jersey_stats[team_key]["goals"] += goals

    history.append({
      "date": m["match_date"],
      "team": team_key,
      "my_score": my_score,
      "opp_score": opp_score,
      "outcome": outcome,
      "delta": delta,
      "cumulative_momentum": cumulative_momentum,
      "goals": goals
    })

  total_matches = len(history)
  win_rate = round((wins / total_matches) * 100) if total_matches > 0 else 0

  return {
    "name": player_name,
    "total_matches": total_matches,
    "wins": wins,
    "draws": draws,
    "losses": losses,
    "total_goals": total_goals,
    "win_rate": win_rate,
    "current_momentum": cumulative_momentum,
    "jersey_stats": jersey_stats,
    "history": history
  }

def test_vinay_form_trajectory():
  print("--- Testing Vinay Option 3 Form Step Mountain ---")
  traj = compute_player_form_trajectory("Vinay", FALLBACK_MATCHES)
  
  assert traj["total_matches"] == 4, f"Expected 4 matches, got {traj['total_matches']}"
  assert traj["wins"] == 2, f"Expected 2 wins, got {traj['wins']}"
  assert traj["draws"] == 1, f"Expected 1 draw, got {traj['draws']}"
  assert traj["losses"] == 1, f"Expected 1 loss, got {traj['losses']}"
  assert traj["total_goals"] == 7, f"Expected 7 goals, got {traj['total_goals']}"
  assert traj["current_momentum"] == 1, f"Expected net momentum +1 (+1, 0, -1, +1), got {traj['current_momentum']}"
  
  # Step by step verification
  momentums = [h["cumulative_momentum"] for h in traj["history"]]
  assert momentums == [1, 1, 0, 1], f"Expected momentum path [1, 1, 0, 1], got {momentums}"
  print(f"[x] Vinay form verified: Record: {traj['wins']}W - {traj['draws']}D - {traj['losses']}L | Net Momentum: +{traj['current_momentum']} | Goals: {traj['total_goals']}")

def test_anoop_form_trajectory():
  print("--- Testing Anoop Top Winner Form Trajectory ---")
  traj = compute_player_form_trajectory("Anoop", FALLBACK_MATCHES)
  
  assert traj["total_matches"] == 4
  assert traj["wins"] == 3
  assert traj["draws"] == 1
  assert traj["losses"] == 0
  assert traj["current_momentum"] == 3, f"Expected momentum +3, got {traj['current_momentum']}"
  
  momentums = [h["cumulative_momentum"] for h in traj["history"]]
  assert momentums == [1, 1, 2, 3], f"Expected momentum path [1, 1, 2, 3], got {momentums}"
  print(f"[x] Anoop form verified: 3W - 1D - 0L | Net Momentum: +{traj['current_momentum']}")

def test_abey_form_trajectory():
  print("--- Testing Abey Form Trajectory & Jersey Breakdown ---")
  traj = compute_player_form_trajectory("Abey", FALLBACK_MATCHES)
  
  assert traj["total_matches"] == 4
  assert traj["wins"] == 1
  assert traj["draws"] == 1
  assert traj["losses"] == 2
  assert traj["current_momentum"] == -1, f"Expected momentum -1, got {traj['current_momentum']}"
  
  # Jersey check: 2 matches in Voyagers (1W-0D-1L), 2 in Boots (0W-1D-1L)
  assert traj["jersey_stats"]["voyagers"]["matches"] == 2
  assert traj["jersey_stats"]["boots"]["matches"] == 2
  print(f"[x] Abey form verified: 1W - 1D - 2L | Net Momentum: {traj['current_momentum']} | Voyagers: 2M ({traj['jersey_stats']['voyagers']['wins']}W), Boots: 2M")

if __name__ == "__main__":
  test_vinay_form_trajectory()
  test_anoop_form_trajectory()
  test_abey_form_trajectory()
  print("\n>>> ALL FORM TRAJECTORY TESTS PASSED! <<<\n")
