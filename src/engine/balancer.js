/**
 * Team Balancing Engine for Football Team Builder
 * Advanced features:
 * - Matchday Fitness (0-100%) and Form Scaling (⬆️ ↗️ ➡️ ↘️ ⬇️)
 * - Chemistry & Duo Synergy Boosts
 * - Rotating Goalkeeper vs. Fixed GK mode
 * - Multi-objective Combinatorial Optimization
 */

export const FORM_MODIFIERS = {
  hot: { label: "Super Hot", icon: "🔥", arrow: "⬆️", ovrDelta: +4, statMult: 1.08, color: "text-emerald-400" },
  good: { label: "Good Form", icon: "⚡", arrow: "↗️", ovrDelta: +2, statMult: 1.04, color: "text-blue-400" },
  neutral: { label: "Normal", icon: "➡️", arrow: "➡️", ovrDelta: 0, statMult: 1.00, color: "text-slate-400" },
  cold: { label: "Off Day", icon: "🌧️", arrow: "↘️", ovrDelta: -2, statMult: 0.96, color: "text-amber-400" },
  terrible: { label: "Terrible", icon: "❄️", arrow: "⬇️", ovrDelta: -4, statMult: 0.92, color: "text-red-400" }
};

/**
 * Computes effective player stats for matchday based on base attributes, fitness, and form.
 */
export function getEffectivePlayerStats(player, matchdaySetting = {}) {
  const fitness = typeof matchdaySetting.fitness === "number" ? matchdaySetting.fitness : 100;
  const formKey = matchdaySetting.form || "neutral";
  const formMod = FORM_MODIFIERS[formKey] || FORM_MODIFIERS.neutral;

  const baseAttr = player.attributes || { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70, gk: 20 };
  const baseOvr = player.ovr || 75;

  const fFactor = Math.max(0, Math.min(100, fitness)) / 100; // 0.0 to 1.0
  const mult = formMod.statMult;

  const effPac = Math.round((baseAttr.pac || 70) * (0.4 + 0.6 * fFactor) * mult);
  const effPhy = Math.round((baseAttr.phy || 70) * (0.4 + 0.6 * fFactor) * mult);
  const effDri = Math.round((baseAttr.dri || 70) * (0.7 + 0.3 * fFactor) * mult);
  const effDef = Math.round((baseAttr.def || 70) * (0.7 + 0.3 * fFactor) * mult);
  const effSho = Math.round((baseAttr.sho || 70) * (0.8 + 0.2 * fFactor) * mult);
  const effPas = Math.round((baseAttr.pas || 70) * (0.8 + 0.2 * fFactor) * mult);
  const effGk = Math.round((baseAttr.gk || 20) * mult);

  // Scaled effective overall
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
      gk: effGk
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
  // Each active chemistry link grants +1.5 effective OVR boost to team performance
  const synergyBoost = Math.round(synergyCount * 1.5 * 10) / 10;

  return {
    synergyCount,
    synergyBoost,
    activeDuos
  };
}

/**
 * Calculates aggregate stats for a team of players, factoring in matchday settings and chemistry.
 */
export function calculateTeamStats(players, matchdaySettingsMap = {}) {
  if (!players || players.length === 0) {
    return {
      avgOvr: 0,
      baseAvgOvr: 0,
      effectiveAvgOvr: 0,
      attack: 0,
      midfield: 0,
      defense: 0,
      pace: 0,
      passing: 0,
      physical: 0,
      goalkeeping: 0,
      synergyCount: 0,
      synergyBoost: 0,
      activeDuos: [],
      positions: { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    };
  }

  const n = players.length;
  let totalBaseOvr = 0;
  let totalEffOvr = 0;
  let totalPac = 0;
  let totalSho = 0;
  let totalPas = 0;
  let totalDri = 0;
  let totalDef = 0;
  let totalPhy = 0;
  let totalGk = 0;
  let maxGk = 0;

  const positions = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

  const effectivePlayers = players.map(p => {
    const setting = matchdaySettingsMap[p.id] || { fitness: p.fitness ?? 100, form: p.form ?? "neutral" };
    const eff = getEffectivePlayerStats(p, setting);

    totalBaseOvr += p.ovr || 75;
    totalEffOvr += eff.effectiveOvr;

    const a = eff.effectiveAttributes;
    totalPac += a.pac;
    totalSho += a.sho;
    totalPas += a.pas;
    totalDri += a.dri;
    totalDef += a.def;
    totalPhy += a.phy;
    totalGk += a.gk;
    if (a.gk > maxGk) maxGk = a.gk;

    const pos = p.position || "MID";
    if (positions[pos] !== undefined) {
      positions[pos]++;
    } else {
      positions.MID++;
    }

    return eff;
  });

  const chemistry = calculateTeamChemistry(players);

  const baseAvgOvr = Math.round((totalBaseOvr / n) * 10) / 10;
  const rawEffAvgOvr = totalEffOvr / n;
  // Effective OVR includes chemistry synergy
  const effectiveAvgOvr = Math.round((rawEffAvgOvr + chemistry.synergyBoost / n) * 10) / 10;

  const avgPac = totalPac / n;
  const avgSho = totalSho / n;
  const avgPas = totalPas / n;
  const avgDri = totalDri / n;
  const avgDef = totalDef / n;
  const avgPhy = totalPhy / n;

  // Composite tactical ratings (FIFA style)
  const attack = Math.round(avgSho * 0.45 + avgDri * 0.30 + avgPac * 0.25);
  const midfield = Math.round(avgPas * 0.40 + avgDri * 0.30 + avgDef * 0.15 + avgPac * 0.15);
  const defense = Math.round(avgDef * 0.55 + avgPhy * 0.30 + avgPac * 0.15);

  return {
    avgOvr: effectiveAvgOvr,
    baseAvgOvr,
    effectiveAvgOvr,
    attack,
    midfield,
    defense,
    pace: Math.round(avgPac),
    passing: Math.round(avgPas),
    physical: Math.round(avgPhy),
    goalkeeping: Math.round(maxGk),
    avgGkReflex: Math.round(totalGk / n),
    positions,
    synergyCount: chemistry.synergyCount,
    synergyBoost: chemistry.synergyBoost,
    activeDuos: chemistry.activeDuos,
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
 * Scores a split of two teams based on multi-criteria penalty function.
 */
export function scoreTeamBalance(teamA, teamB, options = {}) {
  const {
    mode = "balanced",
    gkMode = "fixed", // "fixed" or "rotating"
    matchdaySettingsMap = {}
  } = options;

  const statsA = calculateTeamStats(teamA, matchdaySettingsMap);
  const statsB = calculateTeamStats(teamB, matchdaySettingsMap);

  // 1. Effective Rating Delta (including Fitness, Form, and Chemistry synergy)
  const ovrDelta = Math.abs(statsA.effectiveAvgOvr - statsB.effectiveAvgOvr);

  // 2. Goalkeeper Penalty
  let gkPenalty = 0;
  if (gkMode === "fixed") {
    // Dedicated GK mode: heavily penalize unbalanced GK counts
    const gkDelta = Math.abs(statsA.positions.GK - statsB.positions.GK);
    gkPenalty = gkDelta > 1 ? gkDelta * 30 : gkDelta * 14;
  } else {
    // Rotating GK mode: penalize only if average team goalkeeping reflexes differ widely
    const gkReflexDelta = Math.abs(statsA.avgGkReflex - statsB.avgGkReflex);
    gkPenalty = gkReflexDelta * 0.3;
  }

  // 3. Positional Balance Penalty
  const defDelta = Math.abs(statsA.positions.DEF - statsB.positions.DEF);
  const midDelta = Math.abs(statsA.positions.MID - statsB.positions.MID);
  const fwdDelta = Math.abs(statsA.positions.FWD - statsB.positions.FWD);
  const posPenalty = (defDelta + midDelta + fwdDelta) * 3.5;

  // 4. Tactical Sub-stat Deltas
  const attDelta = Math.abs(statsA.attack - statsB.attack);
  const midStatDelta = Math.abs(statsA.midfield - statsB.midfield);
  const defStatDelta = Math.abs(statsA.defense - statsB.defense);
  const pacDelta = Math.abs(statsA.pace - statsB.pace);
  const phyDelta = Math.abs(statsA.physical - statsB.physical);

  let penalty = 0;
  switch (mode) {
    case "ratings_first":
      penalty = ovrDelta * 50 + gkPenalty * 1.5 + posPenalty * 0.8 + (attDelta + defStatDelta) * 0.5;
      break;
    case "tactical":
      penalty = ovrDelta * 15 + gkPenalty * 2.0 + posPenalty * 3.0 + (attDelta + defStatDelta + midStatDelta) * 1.5;
      break;
    case "pace_power":
      penalty = ovrDelta * 20 + gkPenalty * 1.5 + posPenalty * 1.0 + pacDelta * 4.0 + phyDelta * 3.0;
      break;
    case "balanced":
    default:
      penalty = (ovrDelta * 28) +
                (gkPenalty * 1.8) +
                (posPenalty * 1.2) +
                (attDelta * 1.0) +
                (defStatDelta * 1.0) +
                (midStatDelta * 0.8) +
                (pacDelta * 0.7) +
                (phyDelta * 0.6);
      break;
  }

  // Calculate Match Fairness Percentage (100% = perfectly equal)
  const fairnessScore = Math.max(0, Math.min(100, Math.round(100 - (penalty * 1.1))));

  return {
    penalty,
    fairnessScore,
    statsA,
    statsB,
    deltas: {
      ovr: Math.round(ovrDelta * 10) / 10,
      attack: attDelta,
      midfield: midStatDelta,
      defense: defStatDelta,
      pace: pacDelta,
      physical: phyDelta,
      synergyA: statsA.synergyCount,
      synergyB: statsB.synergyCount
    }
  };
}

/**
 * Builds balanced teams from a selected list of players.
 */
export function buildBalancedTeams(selectedPlayers, options = {}) {
  const {
    mode = "balanced",
    gkMode = "fixed",
    matchdaySettingsMap = {},
    topK = 5
  } = options;

  const n = selectedPlayers.length;
  if (n < 2 || n % 2 !== 0) {
    throw new Error(`Please select an even number of players (currently ${n} selected).`);
  }

  const teamSize = n / 2;
  const solutions = [];

  if (n <= 18) {
    const firstPlayer = selectedPlayers[0];
    const restPlayers = selectedPlayers.slice(1);
    const combos = getCombinations(restPlayers, teamSize - 1);

    combos.forEach(combo => {
      const teamA = [firstPlayer, ...combo];
      const teamAIds = new Set(teamA.map(p => p.id));
      const teamB = selectedPlayers.filter(p => !teamAIds.has(p.id));

      const evaluation = scoreTeamBalance(teamA, teamB, { mode, gkMode, matchdaySettingsMap });
      solutions.push({
        teamA,
        teamB,
        ...evaluation
      });
    });
  } else {
    const seenCombos = new Set();
    const maxIterations = 5000;

    for (let i = 0; i < maxIterations; i++) {
      const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5);
      const teamA = shuffled.slice(0, teamSize);
      const teamB = shuffled.slice(teamSize);

      const hash = teamA.map(p => p.id).sort().join(",");
      if (seenCombos.has(hash)) continue;
      seenCombos.add(hash);

      const evaluation = scoreTeamBalance(teamA, teamB, { mode, gkMode, matchdaySettingsMap });
      solutions.push({
        teamA,
        teamB,
        ...evaluation
      });
    }
  }

  solutions.sort((a, b) => a.penalty - b.penalty);
  return solutions.slice(0, topK);
}
