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
 * Intelligently assigns a list of players to formation slots
 * prioritizing primary position, then secondary position, avoiding out-of-position placement.
 * Uses active slider-based positional role assignment without arbitrary penalty.
 */
export function assignPlayersToFormation(players, formation) {
  if (!formation || !formation.slots) return [];
  const slots = formation.slots;
  const unassigned = players.map(p => ({ ...p }));
  const slotAssignments = new Array(slots.length).fill(null);

  // Group slots by index and target category
  const targetSlots = slots.map((slot, index) => ({ index, slot, pos: slot.pos, role: slot.role || slot.label }));

  // Helper to test if a player matches a target position
  const isPrimaryMatch = (p, pos) => p && p.position === pos;
  const isSecondaryMatch = (p, pos) => p && p.secondaryPosition === pos && p.secondaryPosition !== p.position;

  // Pass 1: Assign dedicated GK slots first (highest priority / specialized)
  targetSlots.filter(s => s.pos === "GK").forEach(s => {
    let idx = unassigned.findIndex(p => isPrimaryMatch(p, "GK"));
    if (idx === -1) idx = unassigned.findIndex(p => isSecondaryMatch(p, "GK"));
    if (idx !== -1) {
      slotAssignments[s.index] = unassigned.splice(idx, 1)[0];
    }
  });

  // Pass 1.5: Emergency Goalkeeper Selection (if squad has 0 dedicated GKs)
  targetSlots.filter(s => s.pos === "GK" && slotAssignments[s.index] === null).forEach(s => {
    if (unassigned.length > 0) {
      // Emergency GK Priority: Best GK attribute among DEF/MID first, never a pure FWD unless only FWDs remain
      const nonFwds = unassigned.filter(p => p.position !== "FWD");
      const candidatePool = nonFwds.length > 0 ? nonFwds : unassigned;
      
      // Sort candidates by highest GK reflex rating, then defensive stats
      candidatePool.sort((a, b) => {
        const gkA = a.attributes?.gk ?? 20;
        const gkB = b.attributes?.gk ?? 20;
        if (gkB !== gkA) return gkB - gkA;
        const defA = a.attributes?.def ?? 50;
        const defB = b.attributes?.def ?? 50;
        return defB - defA;
      });

      const emergencyGk = candidatePool[0];
      const unassignedIdx = unassigned.findIndex(p => p.id === emergencyGk.id);
      if (unassignedIdx !== -1) {
        slotAssignments[s.index] = unassigned.splice(unassignedIdx, 1)[0];
      }
    }
  });

  // Pass 2: Assign dedicated primary players to non-GK slots (players with no secondary or whose secondary is not needed)
  // Process constrained slots first: FWD & DEF, then MID
  const remainingSlots = targetSlots.filter(s => slotAssignments[s.index] === null);
  const slotPriorityOrder = ["FWD", "DEF", "MID"];

  slotPriorityOrder.forEach(targetPos => {
    remainingSlots.filter(s => s.pos === targetPos && slotAssignments[s.index] === null).forEach(s => {
      // Find highest OVR player whose primary matches targetPos
      let idx = unassigned.findIndex(p => isPrimaryMatch(p, targetPos));
      if (idx !== -1) {
        slotAssignments[s.index] = unassigned.splice(idx, 1)[0];
      }
    });
  });

  // Pass 3: Fill remaining unfilled slots using Secondary positions (e.g. MID playing FWD or DEF playing MID)
  slotPriorityOrder.forEach(targetPos => {
    remainingSlots.filter(s => s.pos === targetPos && slotAssignments[s.index] === null).forEach(s => {
      let idx = unassigned.findIndex(p => isSecondaryMatch(p, targetPos));
      if (idx !== -1) {
        slotAssignments[s.index] = unassigned.splice(idx, 1)[0];
      }
    });
  });

  // Pass 4: Fallback for any remaining unassigned outfield slots (never GK)
  slots.forEach((slot, i) => {
    if (!slotAssignments[i] && unassigned.length > 0) {
      // Sort unassigned players by suitability for slot.pos
      unassigned.sort((a, b) => {
        if (slot.pos === "FWD") {
          return (b.attributes?.sho || 0) - (a.attributes?.sho || 0);
        } else if (slot.pos === "DEF") {
          return (b.attributes?.def || 0) - (a.attributes?.def || 0);
        } else {
          return (b.attributes?.pas || 0) - (a.attributes?.pas || 0);
        }
      });
      slotAssignments[i] = unassigned.shift();
    }
  });

  // Assemble final result with attached matchdayPosition and matchdayRole
  return slots.map((slot, i) => {
    const rawPlayer = slotAssignments[i] || { name: "TBD", ovr: 70, position: slot.pos, avatar: "⚽" };
    const isPrimary = rawPlayer.position === slot.pos;
    const isSecondary = !isPrimary && rawPlayer.secondaryPosition === slot.pos;
    const isOutOfPosition = !isPrimary && !isSecondary && rawPlayer.position !== "GK";

    const assignedPlayer = {
      ...rawPlayer,
      matchdayPosition: slot.pos,
      matchdayRole: slot.role || slot.label,
      isSecondaryRole: isSecondary,
      isOutOfPosition: isOutOfPosition
    };

    return {
      slot: slot,
      player: assignedPlayer
    };
  });
}

/**
 * Finds the optimal formation and player role assignment for a given team of players.
 * Evaluates candidate formations for the squad size to minimize out-of-position assignments
 * and maximize tactical cohesion according to user slider weights.
 */
export function findBestFormationForTeam(players, teamSizeKey = "8v8", sectorWeights = null, matchdaySettingsMap = {}, calculateStatsFn = null, fixedFormationKey = null) {
  const formations = getFormationsForSize(teamSizeKey);
  const keys = Object.keys(formations);

  if (fixedFormationKey && formations[fixedFormationKey]) {
    const formation = formations[fixedFormationKey];
    const assignedSlots = assignPlayersToFormation(players, formation);
    const assignedPlayers = assignedSlots.map(s => s.player);
    const stats = calculateStatsFn ? calculateStatsFn(assignedPlayers, matchdaySettingsMap, sectorWeights, true) : null;
    return {
      formationKey: fixedFormationKey,
      formation,
      assignedSlots,
      assignedPlayers,
      stats,
      outOfPositionCount: assignedPlayers.filter(p => p.isOutOfPosition).length,
      secondaryCount: assignedPlayers.filter(p => p.isSecondaryRole).length
    };
  }

  let bestResult = null;
  let bestScore = -Infinity;

  for (const key of keys) {
    const formation = formations[key];
    const assignedSlots = assignPlayersToFormation(players, formation);
    const assignedPlayers = assignedSlots.map(s => s.player);

    const outOfPositionCount = assignedPlayers.filter(p => p.isOutOfPosition).length;
    const secondaryCount = assignedPlayers.filter(p => p.isSecondaryRole).length;

    let stats = null;
    let cohesionScore = 0;
    if (calculateStatsFn) {
      stats = calculateStatsFn(assignedPlayers, matchdaySettingsMap, sectorWeights, true);
      // Encourage balanced sectors (Attack, Midfield, Defense should all be solid)
      const sectorMin = Math.min(stats.attack, stats.midfield, stats.defense);
      const sectorMax = Math.max(stats.attack, stats.midfield, stats.defense);
      const sectorSpread = sectorMax - sectorMin;
      cohesionScore = (stats.effectiveAvgOvr * 2) + (sectorMin * 0.5) - (sectorSpread * 0.3);
    }

    // Heavy penalty for unnatural out-of-position players; slight preference for natural primary
    const fitScore = 1000 - (outOfPositionCount * 250) - (secondaryCount * 2) + cohesionScore;

    if (fitScore > bestScore || !bestResult) {
      bestScore = fitScore;
      bestResult = {
        formationKey: key,
        formation,
        assignedSlots,
        assignedPlayers,
        stats,
        outOfPositionCount,
        secondaryCount,
        fitScore
      };
    }
  }

  return bestResult;
}

