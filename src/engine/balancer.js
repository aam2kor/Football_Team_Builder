/**
 * Team Balancing Engine for Football Team Builder
 * Advanced Multi-Sector Balancing:
 * - Sector-specific balance: Attacking, Midfield, and Defensive (including GK)
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
 * Calculates aggregate and sector-specific stats for a team of players.
 * Evaluates:
 * 1. Attack Strength (weighted by FWD and MID finishing, dribbling, pace)
 * 2. Midfield Strength (weighted by playmaking, dribbling, transition, defensive shielding)
 * 3. Defensive Strength (including Goalkeeping shot-stopping + CB/FB tackling & physical presence)
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
      outfieldDef: 0,
      pace: 0,
      passing: 0,
      physical: 0,
      goalkeeping: 0,
      avgGkReflex: 0,
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

  // Sector weighted accumulators
  let attWeightedSum = 0;
  let attWeightTotal = 0;

  let midWeightedSum = 0;
  let midWeightTotal = 0;

  let defWeightedSum = 0;
  let defWeightTotal = 0;

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

    // Role-specific weighted sector contributions
    // Individual player sector capabilities:
    const pAtt = a.sho * 0.45 + a.dri * 0.30 + a.pac * 0.25;
    const pMid = a.pas * 0.40 + a.dri * 0.30 + a.def * 0.15 + a.pac * 0.15;
    const pDef = a.def * 0.55 + a.phy * 0.30 + a.pac * 0.15;

    // Positional weight in sector:
    const attWeight = pos === "FWD" ? 1.4 : pos === "MID" ? 1.0 : 0.5;
    const midWeight = pos === "MID" ? 1.4 : pos === "FWD" ? 1.0 : 0.7;
    const defWeight = pos === "DEF" ? 1.4 : pos === "MID" ? 0.9 : 0.5;

    attWeightedSum += pAtt * attWeight;
    attWeightTotal += attWeight;

    midWeightedSum += pMid * midWeight;
    midWeightTotal += midWeight;

    defWeightedSum += pDef * defWeight;
    defWeightTotal += defWeight;

    return eff;
  });

  const chemistry = calculateTeamChemistry(players);

  const baseAvgOvr = Math.round((totalBaseOvr / n) * 10) / 10;
  const rawEffAvgOvr = totalEffOvr / n;
  const effectiveAvgOvr = Math.round((rawEffAvgOvr + chemistry.synergyBoost / n) * 10) / 10;

  const avgPac = totalPac / n;
  const avgPas = totalPas / n;
  const avgPhy = totalPhy / n;
  const avgGkReflex = totalGk / n;

  // Composite tactical sector ratings
  const attack = Math.round(attWeightedSum / (attWeightTotal || 1));
  const midfield = Math.round(midWeightedSum / (midWeightTotal || 1));
  const outfieldDef = Math.round(defWeightedSum / (defWeightTotal || 1));

  // Defense including Goalkeeping (65% outfield structure + 35% GK shot-stopping)
  const defense = Math.round(outfieldDef * 0.65 + maxGk * 0.35);

  return {
    avgOvr: effectiveAvgOvr,
    baseAvgOvr,
    effectiveAvgOvr,
    attack,
    midfield,
    defense,
    outfieldDef,
    pace: Math.round(avgPac),
    passing: Math.round(avgPas),
    physical: Math.round(avgPhy),
    goalkeeping: Math.round(maxGk),
    avgGkReflex: Math.round(avgGkReflex),
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
 * Scores a split of two teams based on multi-sector fitness function.
 * Strictly checks that:
 * 1. Attacking power is balanced (|ATT_A - ATT_B| -> 0)
 * 2. Midfield battle is balanced (|MID_A - MID_B| -> 0)
 * 3. Defensive fortress (including GK) is balanced (|DEF_A - DEF_B| -> 0)
 * 4. Overall effective rating and position counts are balanced.
 */
export function scoreTeamBalance(teamA, teamB, options = {}) {
  const {
    mode = "balanced",
    gkMode = "fixed", // "fixed" or "rotating"
    matchdaySettingsMap = {}
  } = options;

  const statsA = calculateTeamStats(teamA, matchdaySettingsMap);
  const statsB = calculateTeamStats(teamB, matchdaySettingsMap);

  // 1. Overall Effective Rating Delta
  const ovrDelta = Math.abs(statsA.effectiveAvgOvr - statsB.effectiveAvgOvr);

  // 2. Tactical Sector Deltas (Attack, Midfield, Defense incl GK)
  const attDelta = Math.abs(statsA.attack - statsB.attack);
  const midDelta = Math.abs(statsA.midfield - statsB.midfield);
  const defDelta = Math.abs(statsA.defense - statsB.defense);

  // 3. Goalkeeper Penalty
  let gkPenalty = 0;
  if (gkMode === "fixed") {
    const gkDelta = Math.abs(statsA.positions.GK - statsB.positions.GK);
    gkPenalty = gkDelta > 1 ? gkDelta * 35 : gkDelta * 18;
  } else {
    const gkReflexDelta = Math.abs(statsA.avgGkReflex - statsB.avgGkReflex);
    gkPenalty = gkReflexDelta * 0.4;
  }

  // 4. Positional Count Disparity
  const defCountDelta = Math.abs(statsA.positions.DEF - statsB.positions.DEF);
  const midCountDelta = Math.abs(statsA.positions.MID - statsB.positions.MID);
  const fwdCountDelta = Math.abs(statsA.positions.FWD - statsB.positions.FWD);
  const posPenalty = (defCountDelta + midCountDelta + fwdCountDelta) * 3.5;

  // 5. Sub-attributes
  const pacDelta = Math.abs(statsA.pace - statsB.pace);
  const phyDelta = Math.abs(statsA.physical - statsB.physical);

  let penalty = 0;
  switch (mode) {
    case "ratings_first":
      // Heavily weights overall rating with secondary sector checks
      penalty = (ovrDelta * 40) +
                (attDelta * 5.0) +
                (midDelta * 5.0) +
                (defDelta * 6.0) +
                (gkPenalty * 1.5) +
                (posPenalty * 0.8);
      break;

    case "tactical":
      // Maximum emphasis on sector and position parity
      penalty = (attDelta * 12.0) +
                (midDelta * 10.0) +
                (defDelta * 12.0) +
                (gkPenalty * 2.0) +
                (posPenalty * 4.0) +
                (ovrDelta * 12.0);
      break;

    case "pace_power":
      // Emphasis on speed, stamina, and physical equality
      penalty = (ovrDelta * 18) +
                (attDelta * 6.0) +
                (defDelta * 7.0) +
                (pacDelta * 5.0) +
                (phyDelta * 4.0) +
                (gkPenalty * 1.5);
      break;

    case "balanced":
    default:
      // Balanced multi-sector optimization:
      // Guarantees balanced Attack, Midfield, Defense (incl GK), and Overall
      penalty = (ovrDelta * 22.0) +
                (attDelta * 8.0) +
                (midDelta * 7.0) +
                (defDelta * 9.0) +
                (gkPenalty * 2.0) +
                (posPenalty * 2.0) +
                (pacDelta * 0.8) +
                (phyDelta * 0.7);
      break;
  }

  // Calculate Match Fairness Percentage (100% = perfectly equal)
  const fairnessScore = Math.max(0, Math.min(100, Math.round(100 - (penalty * 0.9))));

  return {
    penalty,
    fairnessScore,
    statsA,
    statsB,
    deltas: {
      ovr: Math.round(ovrDelta * 10) / 10,
      attack: attDelta,
      midfield: midDelta,
      defense: defDelta,
      pace: pacDelta,
      physical: phyDelta,
      gk: Math.abs(statsA.goalkeeping - statsB.goalkeeping),
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
