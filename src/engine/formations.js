/**
 * Formations and 2D pitch coordinates for various team sizes (5v5 to 11v11).
 * Coordinates are in percentage (x: 0-100 from left to right, y: 0-100 from defense to attack).
 * When rendered on a full pitch:
 * - Team 1 (Home/Left or Bottom): defending their goal, attacking towards opponent.
 * - Team 2 (Away/Right or Top): defending their goal, attacking towards opponent.
 */

export const FORMATIONS = {
  // --- 8v8 (Squad Size: 16 -> 8 per team) ---
  "8v8": {
    "1-3-3-1": {
      name: "1-3-3-1 (Classic Balanced)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "LB", label: "LB", pos: "DEF", x: 20, y: 32 },
        { role: "CB", label: "CB", pos: "DEF", x: 50, y: 28 },
        { role: "RB", label: "RB", pos: "DEF", x: 80, y: 32 },
        { role: "LM", label: "LM", pos: "MID", x: 20, y: 62 },
        { role: "CM", label: "CM", pos: "MID", x: 50, y: 58 },
        { role: "RM", label: "RM", pos: "MID", x: 80, y: 62 },
        { role: "ST", label: "ST", pos: "FWD", x: 50, y: 88 }
      ]
    },
    "1-2-4-1": {
      name: "1-2-4-1 (Midfield Control)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "LCB", label: "CB", pos: "DEF", x: 32, y: 30 },
        { role: "RCB", label: "CB", pos: "DEF", x: 68, y: 30 },
        { role: "LM", label: "LM", pos: "MID", x: 15, y: 58 },
        { role: "LCM", label: "CM", pos: "MID", x: 38, y: 55 },
        { role: "RCM", label: "CM", pos: "MID", x: 62, y: 55 },
        { role: "RM", label: "RM", pos: "MID", x: 85, y: 58 },
        { role: "ST", label: "ST", pos: "FWD", x: 50, y: 88 }
      ]
    },
    "1-3-2-2": {
      name: "1-3-2-2 (Double Striker)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "LB", label: "LB", pos: "DEF", x: 20, y: 30 },
        { role: "CB", label: "CB", pos: "DEF", x: 50, y: 26 },
        { role: "RB", label: "RB", pos: "DEF", x: 80, y: 30 },
        { role: "LCM", label: "CM", pos: "MID", x: 35, y: 58 },
        { role: "RCM", label: "CM", pos: "MID", x: 65, y: 58 },
        { role: "LST", label: "ST", pos: "FWD", x: 35, y: 88 },
        { role: "RST", label: "ST", pos: "FWD", x: 65, y: 88 }
      ]
    },
    "1-2-3-2": {
      name: "1-2-3-2 (High Press)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "LCB", label: "CB", pos: "DEF", x: 32, y: 28 },
        { role: "RCB", label: "CB", pos: "DEF", x: 68, y: 28 },
        { role: "LM", label: "LM", pos: "MID", x: 20, y: 56 },
        { role: "CAM", label: "CAM", pos: "MID", x: 50, y: 58 },
        { role: "RM", label: "RM", pos: "MID", x: 80, y: 56 },
        { role: "LST", label: "ST", pos: "FWD", x: 35, y: 88 },
        { role: "RST", label: "ST", pos: "FWD", x: 65, y: 88 }
      ]
    }
  },

  // --- 7v7 (Squad Size: 14 -> 7 per team) ---
  "7v7": {
    "1-2-3-1": {
      name: "1-2-3-1 (Classic 7s)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "LCB", label: "CB", pos: "DEF", x: 30, y: 30 },
        { role: "RCB", label: "CB", pos: "DEF", x: 70, y: 30 },
        { role: "LM", label: "LM", pos: "MID", x: 20, y: 60 },
        { role: "CM", label: "CM", pos: "MID", x: 50, y: 58 },
        { role: "RM", label: "RM", pos: "MID", x: 80, y: 60 },
        { role: "ST", label: "ST", pos: "FWD", x: 50, y: 88 }
      ]
    },
    "1-3-2-1": {
      name: "1-3-2-1 (Solid 7s)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "LB", label: "LB", pos: "DEF", x: 20, y: 30 },
        { role: "CB", label: "CB", pos: "DEF", x: 50, y: 26 },
        { role: "RB", label: "RB", pos: "DEF", x: 80, y: 30 },
        { role: "LCM", label: "CM", pos: "MID", x: 35, y: 60 },
        { role: "RCM", label: "CM", pos: "MID", x: 65, y: 60 },
        { role: "ST", label: "ST", pos: "FWD", x: 50, y: 88 }
      ]
    }
  },

  // --- 5v5 (Squad Size: 10 -> 5 per team) ---
  "5v5": {
    "1-2-1-1": {
      name: "1-2-1-1 (Diamond 5s)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "LCB", label: "DEF", pos: "DEF", x: 30, y: 35 },
        { role: "RCB", label: "DEF", pos: "DEF", x: 70, y: 35 },
        { role: "CM", label: "MID", pos: "MID", x: 50, y: 62 },
        { role: "ST", label: "FWD", pos: "FWD", x: 50, y: 88 }
      ]
    },
    "1-1-2-1": {
      name: "1-1-2-1 (Pivots 5s)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "CB", label: "DEF", pos: "DEF", x: 50, y: 32 },
        { role: "LM", label: "MID", pos: "MID", x: 25, y: 60 },
        { role: "RM", label: "MID", pos: "MID", x: 75, y: 60 },
        { role: "ST", label: "FWD", pos: "FWD", x: 50, y: 88 }
      ]
    }
  },

  // --- 6v6 (Squad Size: 12 -> 6 per team) ---
  "6v6": {
    "1-2-2-1": {
      name: "1-2-2-1 (Standard 6s)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "LB", label: "DEF", pos: "DEF", x: 30, y: 32 },
        { role: "RB", label: "DEF", pos: "DEF", x: 70, y: 32 },
        { role: "LM", label: "MID", pos: "MID", x: 30, y: 60 },
        { role: "RM", label: "MID", pos: "MID", x: 70, y: 60 },
        { role: "ST", label: "FWD", pos: "FWD", x: 50, y: 88 }
      ]
    }
  },

  // --- 9v9 (Squad Size: 18 -> 9 per team) ---
  "9v9": {
    "1-3-3-2": {
      name: "1-3-3-2 (Standard 9s)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 10 },
        { role: "LB", label: "LB", pos: "DEF", x: 20, y: 30 },
        { role: "CB", label: "CB", pos: "DEF", x: 50, y: 26 },
        { role: "RB", label: "RB", pos: "DEF", x: 80, y: 30 },
        { role: "LM", label: "LM", pos: "MID", x: 20, y: 58 },
        { role: "CM", label: "CM", pos: "MID", x: 50, y: 56 },
        { role: "RM", label: "RM", pos: "MID", x: 80, y: 58 },
        { role: "LST", label: "ST", pos: "FWD", x: 35, y: 88 },
        { role: "RST", label: "ST", pos: "FWD", x: 65, y: 88 }
      ]
    }
  },

  // --- 11v11 (Squad Size: 22 -> 11 per team) ---
  "11v11": {
    "1-4-3-3": {
      name: "1-4-3-3 (Classic 11s)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 8 },
        { role: "LB", label: "LB", pos: "DEF", x: 15, y: 28 },
        { role: "LCB", label: "CB", pos: "DEF", x: 38, y: 25 },
        { role: "RCB", label: "CB", pos: "DEF", x: 62, y: 25 },
        { role: "RB", label: "RB", pos: "DEF", x: 85, y: 28 },
        { role: "LCM", label: "CM", pos: "MID", x: 28, y: 54 },
        { role: "CDM", label: "CDM", pos: "MID", x: 50, y: 46 },
        { role: "RCM", label: "CM", pos: "MID", x: 72, y: 54 },
        { role: "LW", label: "LW", pos: "FWD", x: 20, y: 82 },
        { role: "ST", label: "ST", pos: "FWD", x: 50, y: 88 },
        { role: "RW", label: "RW", pos: "FWD", x: 80, y: 82 }
      ]
    },
    "1-4-4-2": {
      name: "1-4-4-2 (Flat 11s)",
      slots: [
        { role: "GK", label: "GK", pos: "GK", x: 50, y: 8 },
        { role: "LB", label: "LB", pos: "DEF", x: 15, y: 28 },
        { role: "LCB", label: "CB", pos: "DEF", x: 38, y: 25 },
        { role: "RCB", label: "CB", pos: "DEF", x: 62, y: 25 },
        { role: "RB", label: "RB", pos: "DEF", x: 85, y: 28 },
        { role: "LM", label: "LM", pos: "MID", x: 15, y: 58 },
        { role: "LCM", label: "CM", pos: "MID", x: 38, y: 54 },
        { role: "RCM", label: "CM", pos: "MID", x: 62, y: 54 },
        { role: "RM", label: "RM", pos: "MID", x: 85, y: 58 },
        { role: "LST", label: "ST", pos: "FWD", x: 35, y: 88 },
        { role: "RST", label: "ST", pos: "FWD", x: 65, y: 88 }
      ]
    }
  }
};

/**
 * Get available formations for a given team size (e.g. "8v8", "7v7", etc.)
 */
export function getFormationsForSize(teamSizeKey = "8v8") {
  return FORMATIONS[teamSizeKey] || FORMATIONS["8v8"];
}

/**
 * Intelligently assigns a list of players to the formation slots
 * based on position matching and ratings.
 */
export function assignPlayersToFormation(players, formation) {
  if (!formation || !formation.slots) return [];
  const slots = formation.slots;
  const unassigned = [...players];
  const assignments = [];

  // Helper: Find best player for a position slot
  const findAndAssign = (targetPos) => {
    // 1. Exact primary position match (highest OVR first)
    let idx = unassigned.findIndex(p => p.position === targetPos);
    if (idx !== -1) {
      return unassigned.splice(idx, 1)[0];
    }
    // 2. Secondary position match
    idx = unassigned.findIndex(p => p.secondaryPosition === targetPos);
    if (idx !== -1) {
      return unassigned.splice(idx, 1)[0];
    }
    // 3. Fallback: take first available
    if (unassigned.length > 0) {
      return unassigned.shift();
    }
    return null;
  };

  // Sort unassigned players by OVR descending first to prioritize high rated players in their main positions
  unassigned.sort((a, b) => b.ovr - a.ovr);

  // Assign in order: GK -> DEF -> FWD -> MID (so specific roles get filled first)
  const slotAssignments = new Array(slots.length).fill(null);

  // 1. Assign GK slots
  slots.forEach((slot, i) => {
    if (slot.pos === "GK") {
      slotAssignments[i] = findAndAssign("GK");
    }
  });

  // 2. Assign DEF slots
  slots.forEach((slot, i) => {
    if (slot.pos === "DEF" && !slotAssignments[i]) {
      slotAssignments[i] = findAndAssign("DEF");
    }
  });

  // 3. Assign FWD slots
  slots.forEach((slot, i) => {
    if (slot.pos === "FWD" && !slotAssignments[i]) {
      slotAssignments[i] = findAndAssign("FWD");
    }
  });

  // 4. Assign MID and remaining slots
  slots.forEach((slot, i) => {
    if (!slotAssignments[i]) {
      slotAssignments[i] = findAndAssign("MID");
    }
  });

  // Assemble final result with slot positions
  return slots.map((slot, i) => ({
    slot: slot,
    player: slotAssignments[i] || { name: "TBD", ovr: 70, position: slot.pos, avatar: "⚽" }
  }));
}

