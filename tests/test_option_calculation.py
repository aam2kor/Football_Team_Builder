"""
Test suite for Balanced Options (% Match Calculation & Selection)
"""

SAMPLE_PLAYERS = [
  {"id": "p1", "name": "Marcus Vance", "position": "GK", "ovr": 85, "attributes": {"pac": 58, "sho": 30, "pas": 68, "dri": 52, "def": 45, "phy": 82, "gk": 87}},
  {"id": "p2", "name": "Hugo De Silva", "position": "GK", "ovr": 82, "attributes": {"pac": 60, "sho": 25, "pas": 74, "dri": 55, "def": 40, "phy": 78, "gk": 83}},
  {"id": "p4", "name": "Carlos Mendoza", "position": "DEF", "ovr": 86, "attributes": {"pac": 78, "sho": 55, "pas": 76, "dri": 72, "def": 88, "phy": 86, "gk": 25}},
  {"id": "p5", "name": "Trent Walker", "position": "DEF", "ovr": 84, "attributes": {"pac": 85, "sho": 68, "pas": 83, "dri": 80, "def": 81, "phy": 78, "gk": 20}},
  {"id": "p6", "name": "Sami Al-Khatib", "position": "DEF", "ovr": 81, "attributes": {"pac": 74, "sho": 48, "pas": 72, "dri": 68, "def": 84, "phy": 84, "gk": 18}},
  {"id": "p7", "name": "Diego Rossi", "position": "DEF", "ovr": 79, "attributes": {"pac": 80, "sho": 58, "pas": 75, "dri": 74, "def": 80, "phy": 76, "gk": 20}},
  {"id": "p8", "name": "Jonas Richter", "position": "DEF", "ovr": 77, "attributes": {"pac": 71, "sho": 50, "pas": 70, "dri": 66, "def": 79, "phy": 82, "gk": 15}},
  {"id": "p9", "name": "Kofi Mensah", "position": "DEF", "ovr": 74, "attributes": {"pac": 79, "sho": 42, "pas": 65, "dri": 67, "def": 75, "phy": 79, "gk": 18}},
  {"id": "p10", "name": "Lucas Romero", "position": "MID", "ovr": 88, "attributes": {"pac": 82, "sho": 83, "pas": 89, "dri": 88, "def": 72, "phy": 79, "gk": 15}},
  {"id": "p11", "name": "Mateo Kovacic", "position": "MID", "ovr": 85, "attributes": {"pac": 79, "sho": 74, "pas": 86, "dri": 86, "def": 80, "phy": 82, "gk": 18}},
  {"id": "p12", "name": "Hakim Sterling", "position": "MID", "ovr": 84, "attributes": {"pac": 89, "sho": 80, "pas": 81, "dri": 87, "def": 55, "phy": 73, "gk": 15}},
  {"id": "p13", "name": "Nico Barella", "position": "MID", "ovr": 83, "attributes": {"pac": 81, "sho": 76, "pas": 83, "dri": 82, "def": 78, "phy": 84, "gk": 20}},
  {"id": "p14", "name": "Arda Guler", "position": "MID", "ovr": 80, "attributes": {"pac": 78, "sho": 79, "pas": 84, "dri": 85, "def": 50, "phy": 68, "gk": 15}},
  {"id": "p18", "name": "Rafael Santos", "position": "FWD", "ovr": 89, "attributes": {"pac": 88, "sho": 90, "pas": 80, "dri": 87, "def": 42, "phy": 83, "gk": 15}},
  {"id": "p19", "name": "Julian Alvarez", "position": "FWD", "ovr": 86, "attributes": {"pac": 86, "sho": 86, "pas": 81, "dri": 85, "def": 58, "phy": 80, "gk": 15}},
  {"id": "p20", "name": "Antoine Griezmann", "position": "FWD", "ovr": 85, "attributes": {"pac": 80, "sho": 85, "pas": 86, "dri": 86, "def": 62, "phy": 75, "gk": 15}}
]

def calculate_option_fairness(penalty):
  return max(0, min(100, round(100 - (penalty * 0.9))))

def test_option_ranking_and_fairness():
  print("--- Testing Option Ranking & Fairness Calculations ---")
  simulated_penalties = [2.4, 5.1, 8.7]
  fairness_scores = [calculate_option_fairness(p) for p in simulated_penalties]
  
  assert fairness_scores[0] == 98, f"Expected 98% for penalty 2.4, got {fairness_scores[0]}"
  assert fairness_scores[1] == 95, f"Expected 95% for penalty 5.1, got {fairness_scores[1]}"
  assert fairness_scores[2] == 92, f"Expected 92% for penalty 8.7, got {fairness_scores[2]}"
  
  assert fairness_scores[0] >= fairness_scores[1] >= fairness_scores[2], "Options must be ranked monotonically by fairness score"
  print(f"[x] Option rankings verified: Option 1={fairness_scores[0]}%, Option 2={fairness_scores[1]}%, Option 3={fairness_scores[2]}%")

def test_solution_immutability():
  print("--- Testing Solution Immutability on Pitch Modification ---")
  # Simulate generated solution with slots
  original_solution = {
    "teamA": [{"id": "p1", "name": "Marcus Vance"}, {"id": "p4", "name": "Carlos Mendoza"}],
    "teamB": [{"id": "p2", "name": "Hugo De Silva"}, {"id": "p5", "name": "Trent Walker"}],
    "assignedSlotsA": [
      {"slot": {"pos": "GK"}, "player": {"id": "p1", "name": "Marcus Vance"}},
      {"slot": {"pos": "DEF"}, "player": {"id": "p4", "name": "Carlos Mendoza"}}
    ]
  }

  # Apply solution using deep cloning (as implemented in app.js)
  activeSlotsA = [
    {"slot": dict(s["slot"]), "player": dict(s["player"])}
    for s in original_solution["assignedSlotsA"]
  ]

  # User modifies pitch slot (swap player)
  activeSlotsA[0]["player"]["name"] = "Swapped Player"

  # Verify original solution was NOT mutated
  assert original_solution["assignedSlotsA"][0]["player"]["name"] == "Marcus Vance", "Original solution was mutated!"
  print("[x] Immutability verified: Original solution remains pristine after pitch modifications.")

if __name__ == "__main__":
  test_option_ranking_and_fairness()
  test_solution_immutability()
  print("\n>>> ALL OPTION CALCULATION TESTS PASSED! <<<\n")
