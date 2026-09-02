/**
 * Team Balancing Engine for Football Team Builder
 * Advanced Multi-Sector Balancing:
 * - Sector-specific balance: Attacking, Midfield, and Defensive (including GK)
 * - Matchday Fitness (0-100%) and Form Scaling (⬆️ ↗️ ➡️ ↘️ ⬇️)
 * - Chemistry & Duo Synergy Boosts
 * - Rotating Goalkeeper vs. Fixed GK mode
 * - Multi-objective Combinatorial Optimization
 * - Fully configurable sector attribute & positional weights
 */

export const FORM_MODIFIERS = {
  hot: { label: "Super Hot", icon: "🔥", arrow: "⬆️", ovrDelta: +4, statMult: 1.08, color: "text-emerald-400" },
  good: { label: "Good Form", icon: "⚡", arrow: "↗️", ovrDelta: +2, statMult: 1.04, color: "text-blue-400" },
  neutral: { label: "Normal", icon: "➡️", arrow: "➡️", ovrDelta: 0, statMult: 1.00, color: "text-slate-400" },
  cold: { label: "Off Day", icon: "🌧️", arrow: "↘️", ovrDelta: -2, statMult: 0.96, color: "text-amber-400" },
  terrible: { label: "Terrible", icon: "❄️", arrow: "⬇️", ovrDelta: -4, statMult: 0.92, color: "text-red-400" }
};

/**
 * Default sector weights — all hardcoded values live here.
 * These are exported so the UI can display them as defaults and allow reset.
 */
export const DEFAULT_SECTOR_WEIGHTS = {
  attack: {
    attributes: { sho: 0.45, dri: 0.30, pac: 0.25, pas: 0, def: 0, phy: 0 },
    positions:  { GK: 0.5, DEF: 0.5, MID: 1.0, FWD: 1.4 },
    penaltyMult: 8.0
  },
  midfield: {
    attributes: { pas: 0.40, dri: 0.30, def: 0.15, pac: 0.15, sho: 0, phy: 0 },
    positions:  { GK: 0.7, DEF: 0.7, MID: 1.4, FWD: 1.0 },
    penaltyMult: 7.0
  },
  defense: {
    attributes: { def: 0.55, phy: 0.30, pac: 0.15, sho: 0, pas: 0, dri: 0 },
    positions:  { GK: 0.5, DEF: 1.4, MID: 0.9, FWD: 0.5 },
    gkBlend: 0.35,   // fraction of the DEF score that comes from best GK rating
    penaltyMult: 9.0
  },
  overall: {
    penaltyMult: 22.0
  }
};

/**
 * Deep clone sector weights (utility to avoid mutating defaults).
 */
export function cloneSectorWeights(w) {
  return JSON.parse(JSON.stringify(w));
}

/**
 * Computes effective player stats for matchday based on base attributes, fitness, and form.
 */
export function getEffectivePlayerStats(player, matchdaySetting = {}) {
  const fitness = typeof matchdaySetting.fitness === "number" ? matchdaySetting.fitness : 100;
  const formKey = matchdaySetting.form || "neutral";
  const formMod = FORM_MODIFIERS[formKey] || FORM_MODIFIERS.neutral;

  const baseAttr = player.attributes || { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70, gk: 20 };
  const baseOvr = player.ovr || 75;

  const fFactor = Math.max(0, Math.min(100, fitness)) / 100;
  const mult = formMod.statMult;

  const effPac = Math.round((baseAttr.pac || 70) * (0.4 + 0.6 * fFactor) * mult);
  const effPhy = Math.round((baseAttr.phy || 70) * (0.4 + 0.6 * fFactor) * mult);
  const effDri = Math.round((baseAttr.dri || 70) * (0.7 + 0.3 * fFactor) * mult);
  const effDef = Math.round((baseAttr.def || 70) * (0.7 + 0.3 * fFactor) * mult);
  const effSho = Math.round((baseAttr.sho || 70) * (0.8 + 0.2 * fFactor) * mult);
  const effPas = Math.round((baseAttr.pas || 70) * (0.8 + 0.2 * fFactor) * mult);
  const effGk  = Math.round((baseAttr.gk  || 20) * mult);

  const effOvr = Math.max(
    30,
    Math.min(99, Math.round(baseOvr * (0.65 + 0.35 * fFactor) + formMod.ovrDelta))
  );

  return {
    ...player,
    fitness,
    form: formKey,
    formMod,
    effectiveOvr: effOvr,
    effectiveAttributes: {
      pac: effPac,
      sho: effSho,
      pas: effPas,
      dri: effDri,
      def: effDef,
      phy: effPhy,
      gk:  effGk
    }
  };
}

/**
 * Calculates active chemistry links and synergy bonus for a team of players.
 */
export function calculateTeamChemistry(teamPlayers) {
  if (!teamPlayers || teamPlayers.length === 0) {
    return { synergyCount: 0, synergyBoost: 0, activeDuos: [] };
  }

  const teamIds = new Set(teamPlayers.map(p => p.id));
  const activeDuos = [];
  const recordedPairs = new Set();

  teamPlayers.forEach(p => {
    const partners = p.chemistryPartners || [];
    partners.forEach(partnerId => {
      if (teamIds.has(partnerId)) {
        const pairKey = [p.id, partnerId].sort().join("-");
        if (!recordedPairs.has(pairKey)) {
          recordedPairs.add(pairKey);
          const partnerObj = teamPlayers.find(tp => tp.id === partnerId);
          activeDuos.push({
            player1: p,
            player2: partnerObj,
            label: `${p.name} & ${partnerObj?.name || 'Partner'}`
          });
        }
      }
    });
  });

  const synergyCount = activeDuos.length;
  const synergyBoost = Math.round(synergyCount * 1.5 * 10) / 10;

  return { synergyCount, synergyBoost, activeDuos };
}

/**
 * Computes a single sector score for a team, given attribute weights & positional weights.
 * @param {Array} effectivePlayerList - players with effectiveAttributes already applied
 * @param {Object} attrWeights  - { pac, sho, pas, dri, def, phy }
 * @param {Object} posWeights   - { GK, DEF, MID, FWD }
 * @returns {number} weighted sector score
 */
function computeSectorScore(effectivePlayerList, attrWeights, posWeights) {
  let weightedSum = 0;
  let weightTotal = 0;

  effectivePlayerList.forEach(eff => {
    const a = eff.effectiveAttributes;
    const pos = eff.matchdayPosition || eff.position || "MID";

    // Dot-product of attribute values × weights
    const rawScore =
      (a.pac || 0) * (attrWeights.pac || 0) +
      (a.sho || 0) * (attrWeights.sho || 0) +
      (a.pas || 0) * (attrWeights.pas || 0) +
      (a.dri || 0) * (attrWeights.dri || 0) +
      (a.def || 0) * (attrWeights.def || 0) +
      (a.phy || 0) * (attrWeights.phy || 0);

    const posKey = posWeights[pos] !== undefined ? pos : "MID";
    const roleWeight = posWeights[posKey] ?? 1.0;

    weightedSum += rawScore * roleWeight;
    weightTotal += roleWeight;
  });

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

/**
 * Calculates a player's individual score for a specific metric key.
 * @param {Object} player
 * @param {Object} setting - { fitness, form }
 * @param {string} metricKey - "attack" | "midfield" | "defense" | "pace" | "physical" | "passing" | "goalkeeping"
 * @param {Object} sectorWeights - custom or DEFAULT_SECTOR_WEIGHTS
 * @param {boolean} useMatchdayPosition - if true, evaluates using on-pitch matchdayPosition; if false, always uses database position
 * @returns {number}
 */
export function getPlayerMetricScore(player, setting = {}, metricKey, sectorWeights = DEFAULT_SECTOR_WEIGHTS, useMatchdayPosition = false) {
  const eff = getEffectivePlayerStats(player, setting);
  const a = eff.effectiveAttributes;
  const pos = (useMatchdayPosition && player.matchdayPosition) ? player.matchdayPosition : (player.position || "MID");
  const sw = sectorWeights || DEFAULT_SECTOR_WEIGHTS;

  switch (metricKey) {
    case "attack": {
      const aw = sw.attack.attributes;
      const pw = sw.attack.positions;
      const raw = (a.pac || 0) * (aw.pac || 0) + (a.sho || 0) * (aw.sho || 0) + (a.pas || 0) * (aw.pas || 0) +
                  (a.dri || 0) * (aw.dri || 0) + (a.def || 0) * (aw.def || 0) + (a.phy || 0) * (aw.phy || 0);
      const roleWeight = pw[pos] !== undefined ? pw[pos] : 1.0;
      return Math.round(raw * roleWeight);
    }
    case "midfield": {
      const aw = sw.midfield.attributes;
      const pw = sw.midfield.positions;
      const raw = (a.pac || 0) * (aw.pac || 0) + (a.sho || 0) * (aw.sho || 0) + (a.pas || 0) * (aw.pas || 0) +
                  (a.dri || 0) * (aw.dri || 0) + (a.def || 0) * (aw.def || 0) + (a.phy || 0) * (aw.phy || 0);
      const roleWeight = pw[pos] !== undefined ? pw[pos] : 1.0;
      return Math.round(raw * roleWeight);
    }
    case "defense": {
      const aw = sw.defense.attributes;
      const pw = sw.defense.positions;
      const outfield = (a.pac || 0) * (aw.pac || 0) + (a.sho || 0) * (aw.sho || 0) + (a.pas || 0) * (aw.pas || 0) +
                       (a.dri || 0) * (aw.dri || 0) + (a.def || 0) * (aw.def || 0) + (a.phy || 0) * (aw.phy || 0);
      const roleWeight = pw[pos] !== undefined ? pw[pos] : 1.0;
      if (pos === "GK") {
        const gkBlend = sw.defense.gkBlend ?? 0.35;
        return Math.round((outfield * roleWeight) * (1 - gkBlend) + a.gk * gkBlend);
      }
      return Math.round(outfield * roleWeight);
    }
    case "pace":
      return Math.round(a.pac);
    case "passing":
      return Math.round(a.pas);
    case "physical":
      return Math.round(a.phy);
    case "goalkeeping":
      return Math.round(a.gk);
    default:
      return Math.round(eff.effectiveOvr);
  }
}

/**
 * Calculates aggregate and sector-specific stats for a team of players.
 * @param {Array}  players
 * @param {Object} matchdaySettingsMap  - { [playerId]: { fitness, form } }
 * @param {Object} sectorWeights        - custom or DEFAULT_SECTOR_WEIGHTS
 * @param {boolean} useMatchdayPositions - if true, evaluates on-pitch matchdayPosition; if false, always uses database position
 */
export function calculateTeamStats(players, matchdaySettingsMap = {}, sectorWeights = DEFAULT_SECTOR_WEIGHTS, useMatchdayPositions = false) {
  const sw = sectorWeights || DEFAULT_SECTOR_WEIGHTS;

  if (!players || players.length === 0) {
    return {
      avgOvr: 0, baseAvgOvr: 0, effectiveAvgOvr: 0,
      attack: 0, midfield: 0, defense: 0, outfieldDef: 0,
      pace: 0, passing: 0, physical: 0, goalkeeping: 0, avgGkReflex: 0,
      synergyCount: 0, synergyBoost: 0, activeDuos: [],
      positions: { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    };
  }

  const n = players.length;
  let totalBaseOvr = 0, totalEffOvr = 0;
  let totalPac = 0, totalPas = 0, totalPhy = 0, totalGk = 0;
  let maxGk = 0;
  const positions = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

  const effectivePlayers = players.map(p => {
    const setting = matchdaySettingsMap[p.id] || { fitness: p.fitness ?? 100, form: p.form ?? "neutral" };
    const eff = getEffectivePlayerStats(p, setting);

    totalBaseOvr += p.ovr || 75;
    totalEffOvr  += eff.effectiveOvr;

    const a = eff.effectiveAttributes;
    totalPac += a.pac;
    totalPas += a.pas;
    totalPhy += a.phy;
    totalGk  += a.gk;
    if (a.gk > maxGk) maxGk = a.gk;

    const pos = (useMatchdayPositions && p.matchdayPosition) ? p.matchdayPosition : (p.position || "MID");
    if (positions[pos] !== undefined) positions[pos]++;
    else positions.MID++;

    eff.position = pos;
    eff.matchdayPosition = (useMatchdayPositions && p.matchdayPosition) ? p.matchdayPosition : null;

    return eff;
  });

  const chemistry = calculateTeamChemistry(players);

  const baseAvgOvr      = Math.round((totalBaseOvr / n) * 10) / 10;
  const rawEffAvgOvr    = totalEffOvr / n;
  const effectiveAvgOvr = Math.round((rawEffAvgOvr + chemistry.synergyBoost / n) * 10) / 10;

  // Compute each sector using the configurable weights
  const attackRaw    = computeSectorScore(effectivePlayers, sw.attack.attributes,  sw.attack.positions);
  const midfieldRaw  = computeSectorScore(effectivePlayers, sw.midfield.attributes, sw.midfield.positions);
  const outfieldDefRaw = computeSectorScore(effectivePlayers, sw.defense.attributes, sw.defense.positions);

  const gkBlend  = sw.defense.gkBlend ?? 0.35;
  const defenseRaw = outfieldDefRaw * (1 - gkBlend) + maxGk * gkBlend;

  return {
    avgOvr: effectiveAvgOvr,
    baseAvgOvr,
    effectiveAvgOvr,
    attack:      Math.round(attackRaw),
    midfield:    Math.round(midfieldRaw),
    defense:     Math.round(defenseRaw),
    outfieldDef: Math.round(outfieldDefRaw),
    pace:        Math.round(totalPac / n),
    passing:     Math.round(totalPas / n),
    physical:    Math.round(totalPhy / n),
    goalkeeping: Math.round(maxGk),
    avgGkReflex: Math.round(totalGk / n),
    positions,
    synergyCount: chemistry.synergyCount,
    synergyBoost: chemistry.synergyBoost,
    activeDuos:   chemistry.activeDuos,
    effectivePlayers
  };
}

/**
 * Combinations generator helper
 */
function getCombinations(array, k) {
  const result = [];
  function backtrack(start, current) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

/**
 * Scores a split of two teams based on multi-sector fitness function.
 * All sector weights are fully configurable.
 */
export function scoreTeamBalance(teamA, teamB, options = {}) {
  const {
    mode = "balanced",
    gkMode = "fixed",
    matchdaySettingsMap = {},
    sectorWeights = DEFAULT_SECTOR_WEIGHTS
  } = options;

  const sw = sectorWeights || DEFAULT_SECTOR_WEIGHTS;

  const statsA = calculateTeamStats(teamA, matchdaySettingsMap, sw);
  const statsB = calculateTeamStats(teamB, matchdaySettingsMap, sw);

  const ovrDelta = Math.abs(statsA.effectiveAvgOvr - statsB.effectiveAvgOvr);
  const attDelta = Math.abs(statsA.attack   - statsB.attack);
  const midDelta = Math.abs(statsA.midfield - statsB.midfield);
  const defDelta = Math.abs(statsA.defense  - statsB.defense);

  // Goalkeeper penalty
  let gkPenalty = 0;
  if (gkMode === "fixed") {
    const gkDelta = Math.abs(statsA.positions.GK - statsB.positions.GK);
    gkPenalty = gkDelta > 1 ? gkDelta * 35 : gkDelta * 18;
  } else {
    gkPenalty = Math.abs(statsA.avgGkReflex - statsB.avgGkReflex) * 0.4;
  }

  // Positional count disparity
  const posPenalty = (
    Math.abs(statsA.positions.DEF - statsB.positions.DEF) +
    Math.abs(statsA.positions.MID - statsB.positions.MID) +
    Math.abs(statsA.positions.FWD - statsB.positions.FWD)
  ) * 3.5;

  const pacDelta = Math.abs(statsA.pace     - statsB.pace);
  const phyDelta = Math.abs(statsA.physical - statsB.physical);

  // Use configurable penalty multipliers for balanced mode;
  // other modes use fixed coefficients (overridable via sectorWeights.overall).
  const ovrMult = sw.overall?.penaltyMult ?? 22.0;
  const attMult = sw.attack?.penaltyMult  ?? 8.0;
  const midMult = sw.midfield?.penaltyMult ?? 7.0;
  const defMult = sw.defense?.penaltyMult  ?? 9.0;

  let penalty = 0;
  switch (mode) {
    case "ratings_first":
      penalty = (ovrDelta * 40) + (attDelta * 5.0) + (midDelta * 5.0) +
                (defDelta * 6.0) + (gkPenalty * 1.5) + (posPenalty * 0.8);
      break;
    case "tactical":
      penalty = (attDelta * 12.0) + (midDelta * 10.0) + (defDelta * 12.0) +
                (gkPenalty * 2.0) + (posPenalty * 4.0) + (ovrDelta * 12.0);
      break;
    case "pace_power":
      penalty = (ovrDelta * 18) + (attDelta * 6.0) + (defDelta * 7.0) +
                (pacDelta * 5.0) + (phyDelta * 4.0) + (gkPenalty * 1.5);
      break;
    case "balanced":
    default:
      penalty = (ovrDelta * ovrMult) +
                (attDelta * attMult) +
                (midDelta * midMult) +
                (defDelta * defMult) +
                (gkPenalty * 2.0)   +
                (posPenalty * 2.0)  +
                (pacDelta * 0.8)    +
                (phyDelta * 0.7);
      break;
  }

  const fairnessScore = Math.max(0, Math.min(100, Math.round(100 - (penalty * 0.9))));

  return {
    penalty,
    fairnessScore,
    statsA,
    statsB,
    deltas: {
      ovr:      Math.round(ovrDelta * 10) / 10,
      attack:   attDelta,
      midfield: midDelta,
      defense:  defDelta,
      pace:     pacDelta,
      physical: phyDelta,
      gk:       Math.abs(statsA.goalkeeping - statsB.goalkeeping),
      synergyA: statsA.synergyCount,
      synergyB: statsB.synergyCount
    }
  };
}

/**
 * Checks whether a candidate split satisfies user/AI hard constraints.
 */
function satisfiesConstraints(teamA, teamB, constraints) {
  if (!constraints) return true;
  const { pinnedA, pinnedB, separated, paired } = constraints;
  const teamAIds = new Set(teamA.map(p => p.id));
  const teamBIds = new Set(teamB.map(p => p.id));

  // Pinned to Team A
  if (pinnedA && pinnedA.size > 0) {
    for (const id of pinnedA) {
      if (!teamAIds.has(id)) return false;
    }
  }

  // Pinned to Team B
  if (pinnedB && pinnedB.size > 0) {
    for (const id of pinnedB) {
      if (!teamBIds.has(id)) return false;
    }
  }

  // Separated pairs (must be on different teams)
  if (separated && separated.length > 0) {
    for (const [id1, id2] of separated) {
      if ((teamAIds.has(id1) && teamAIds.has(id2)) || (teamBIds.has(id1) && teamBIds.has(id2))) {
        return false;
      }
    }
  }

  // Paired duos (must be on the same team)
  if (paired && paired.length > 0) {
    for (const [id1, id2] of paired) {
      const inA1 = teamAIds.has(id1), inA2 = teamAIds.has(id2);
      const inB1 = teamBIds.has(id1), inB2 = teamBIds.has(id2);
      if ((inA1 && inB2) || (inB1 && inA2)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Builds balanced teams from a selected list of players.
 */
export function buildBalancedTeams(selectedPlayers, options = {}) {
  const {
    mode = "balanced",
    gkMode = "fixed",
    matchdaySettingsMap = {},
    sectorWeights = DEFAULT_SECTOR_WEIGHTS,
    constraints = null,
    topK = 5
  } = options;

  // Always sanitize players so balancing evaluates strictly by true database positions
  const cleanPlayers = selectedPlayers.map(p => {
    const cp = { ...p };
    delete cp.matchdayPosition;
    delete cp.matchdayRole;
    return cp;
  });

  const n = cleanPlayers.length;
  if (n < 2 || n % 2 !== 0) {
    throw new Error(`Please select an even number of players (currently ${n} selected).`);
  }

  const teamSize = n / 2;
  const solutions = [];
  const fallbackSolutions = [];

  if (n <= 18) {
    const firstPlayer = cleanPlayers[0];
    const restPlayers = cleanPlayers.slice(1);
    const combos = getCombinations(restPlayers, teamSize - 1);

    combos.forEach(combo => {
      const teamA = [firstPlayer, ...combo];
      const teamAIds = new Set(teamA.map(p => p.id));
      const teamB = cleanPlayers.filter(p => !teamAIds.has(p.id));

      const evaluation = scoreTeamBalance(teamA, teamB, { mode, gkMode, matchdaySettingsMap, sectorWeights });
      const sol = { teamA, teamB, ...evaluation };

      if (satisfiesConstraints(teamA, teamB, constraints)) {
        solutions.push(sol);
      } else {
        fallbackSolutions.push(sol);
      }
    });
  } else {
    const seenCombos = new Set();
    for (let i = 0; i < 5000; i++) {
      const shuffled = [...cleanPlayers].sort(() => Math.random() - 0.5);
      const teamA = shuffled.slice(0, teamSize);
      const teamB = shuffled.slice(teamSize);
      const hash = teamA.map(p => p.id).sort().join(",");
      if (seenCombos.has(hash)) continue;
      seenCombos.add(hash);

      const evaluation = scoreTeamBalance(teamA, teamB, { mode, gkMode, matchdaySettingsMap, sectorWeights });
      const sol = { teamA, teamB, ...evaluation };

      if (satisfiesConstraints(teamA, teamB, constraints)) {
        solutions.push(sol);
      } else {
        fallbackSolutions.push(sol);
      }
    }
  }

  // If constraints were too restrictive to find valid solutions, fall back to best unconstrained splits
  const targetPool = solutions.length > 0 ? solutions : fallbackSolutions;
  targetPool.sort((a, b) => a.penalty - b.penalty);
  return targetPool.slice(0, topK);
}
