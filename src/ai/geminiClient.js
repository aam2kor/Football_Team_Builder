/**
 * Google Gemini AI Client for Football Team Builder
 * Connects to Google Gemini API (gemini-2.5-flash, gemini-2.5-pro, etc.)
 * using structured JSON schemas and responseMimeType: "application/json".
 */

export const GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Helper to call Gemini API directly or via local server proxy
 */
async function callGeminiGenerateContent(model, apiKey, payload) {
  const targetModel = model || GEMINI_DEFAULT_MODEL;
  
  // Try direct Google Generative Language API endpoint first
  const directUrl = `${GEMINI_API_BASE}/${targetModel}:generateContent?key=${apiKey || ""}`;
  const proxyUrl = `/api/gemini/${targetModel}:generateContent${apiKey ? `?key=${apiKey}` : ""}`;

  const candidates = apiKey ? [directUrl, proxyUrl] : [proxyUrl, directUrl];
  let lastError = null;

  const headers = {
    "Content-Type": "application/json"
  };
  if (apiKey) {
    headers["x-goog-api-key"] = apiKey;
  }

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return data;
      }

      const errBody = await res.text();
      let parsedErr = errBody;
      try {
        const j = JSON.parse(errBody);
        parsedErr = j.error?.message || errBody;
      } catch (e) {}
      lastError = new Error(`Gemini API error (HTTP ${res.status}): ${parsedErr}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to reach Gemini API");
}

/**
 * Tests connection to Google Gemini API
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<{ ok: boolean, error?: string, model?: string }>}
 */
export async function testGeminiConnection(apiKey = "", model = GEMINI_DEFAULT_MODEL) {
  const targetModel = model || GEMINI_DEFAULT_MODEL;
  
  const payload = {
    contents: [
      {
        parts: [
          { text: "Ping test. Respond with JSON: {\"status\": \"ok\"}" }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  try {
    const data = await callGeminiGenerateContent(targetModel, apiKey, payload);
    const candidate = data.candidates?.[0];
    if (!candidate) {
      return { ok: false, error: "No response candidates returned by Gemini" };
    }
    return {
      ok: true,
      model: targetModel
    };
  } catch (err) {
    let msg = err.message || "Failed to reach Gemini API";
    if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID") || msg.includes("400")) {
      msg = "Invalid Gemini API Key. Please verify your key at https://aistudio.google.com/app/apikey";
    }
    return { ok: false, error: msg };
  }
}

/**
 * Generates dynamic text explaining the sector potential calculation rules based on active slider settings
 */
export function formatSectorWeightsExplanation(weights) {
  const sw = weights || {
    attack: { attributes: { sho: 0.45, dri: 0.30, pac: 0.25 }, positions: { FWD: 1.4, MID: 1.0, DEF: 0.5, GK: 0.5 } },
    midfield: { attributes: { pas: 0.40, dri: 0.30, def: 0.15, pac: 0.15 }, positions: { MID: 1.4, FWD: 1.0, DEF: 0.7, GK: 0.7 } },
    defense: { attributes: { def: 0.55, phy: 0.30, pac: 0.15 }, positions: { DEF: 1.4, MID: 0.9, FWD: 0.5, GK: 0.5 }, gkBlend: 0.35 }
  };

  const formatAttrs = (attrs = {}) => {
    return Object.entries(attrs)
      .filter(([_, val]) => val > 0)
      .map(([k, val]) => `${Math.round(val * 100)}% ${k.toUpperCase()}`)
      .join(" + ") || "Balanced attributes";
  };

  const attStr = formatAttrs(sw.attack?.attributes);
  const midStr = formatAttrs(sw.midfield?.attributes);
  const defStr = formatAttrs(sw.defense?.attributes);
  const gkBlendPct = Math.round((sw.defense?.gkBlend ?? 0.35) * 100);
  const outfieldPct = 100 - gkBlendPct;

  return `ACTIVE SECTOR POTENTIAL CALCULATION RULES (from user's active sliders):
1. ATTACK POTENTIAL: ${attStr} (Positional multipliers: FWD ${sw.attack?.positions?.FWD || 1.4}x, MID ${sw.attack?.positions?.MID || 1.0}x, DEF ${sw.attack?.positions?.DEF || 0.5}x), scaled by matchday fitness & form.
2. MIDFIELD POTENTIAL: ${midStr} (Positional multipliers: MID ${sw.midfield?.positions?.MID || 1.4}x, FWD ${sw.midfield?.positions?.FWD || 1.0}x, DEF ${sw.midfield?.positions?.DEF || 0.7}x).
3. DEFENSE POTENTIAL: ${outfieldPct}% Outfield Defense (${defStr}, DEF ${sw.defense?.positions?.DEF || 1.4}x) + ${gkBlendPct}% Best Goalkeeper (max GK reflex/handling attribute).
4. OVERALL POTENTIAL (OVR): Mean squad effective OVR (fitness & form scaled) + Chemistry Synergy (+1.5 OVR per verified duo link).`;
}

/**
 * Sends natural language coach instructions to Google Gemini
 * and returns structured constraints & tactical briefing.
 * 
 * @param {string} userPrompt
 * @param {Array}  players - Selected players for the match
 * @param {Object} context - { teamAName, teamBName, targetTeamSize, sectorWeights, matchdaySettings }
 * @param {Object} aiConfig - { geminiApiKey, geminiModel }
 * @returns {Promise<{ constraints: Object, coachBriefing: string, raw: Object }>}
 */
/**
 * Deterministic rule-based extractor for player on-pitch role/position constraints
 * Matches patterns like "keep Sanjay as GK", "play Abey as striker", "Manu in defense", etc.
 */
export function extractPositionalConstraints(userPrompt, players = []) {
  const result = {};
  if (!userPrompt || !players || players.length === 0) return result;

  const text = userPrompt.toLowerCase();

  const roleMap = {
    gk: "GK",
    goalkeeper: "GK",
    goalie: "GK",
    keeper: "GK",
    goal: "GK",
    def: "DEF",
    defender: "DEF",
    defense: "DEF",
    cb: "DEF",
    lb: "DEF",
    rb: "DEF",
    mid: "MID",
    midfielder: "MID",
    midfield: "MID",
    cm: "MID",
    fwd: "FWD",
    forward: "FWD",
    striker: "FWD",
    attacker: "FWD",
    attack: "FWD",
    st: "FWD"
  };

  players.forEach(p => {
    const firstName = p.name.split(" ")[0].toLowerCase();
    const fullName = p.name.toLowerCase();
    const pId = p.id.toLowerCase();

    if (text.includes(firstName) || text.includes(fullName) || text.includes(pId)) {
      const escapedFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedFull = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const namePattern = `(?:${escapedFull}|${escapedFirst}|${pId})`;

      const regexes = [
        new RegExp(`(?:keep|play|put|make|set|have|use)\\s+${namePattern}\\s+(?:as|in|at|on)?\\s+(?:the\\s+)?(gk|goalkeeper|goalie|keeper|goal|def|defender|defense|cb|lb|rb|mid|midfielder|midfield|cm|fwd|forward|striker|attacker|attack|st)\\b`, "i"),
        new RegExp(`${namePattern}\\s+(?:as|in|at|to be|is|must be|should be)\\s+(?:the\\s+)?(gk|goalkeeper|goalie|keeper|goal|def|defender|defense|cb|lb|rb|mid|midfielder|midfield|cm|fwd|forward|striker|attacker|attack|st)\\b`, "i"),
        new RegExp(`(?:^|[,.;&\\s])(gk|goalkeeper|goalie|keeper|def|defender|mid|midfielder|fwd|forward|striker)\\s+${namePattern}\\b`, "i"),
        new RegExp(`\\b${namePattern}\\s+(gk|goalkeeper|goalie|keeper)\\b`, "i")
      ];

      for (const rx of regexes) {
        const match = text.match(rx);
        if (match && match[1]) {
          const roleKey = match[1].toLowerCase();
          if (roleMap[roleKey]) {
            result[p.id] = roleMap[roleKey];
            break;
          }
        }
      }
    }
  });

  return result;
}

export async function queryGeminiCoach(userPrompt, players, context = {}, aiConfig = {}) {
  const apiKey = aiConfig.geminiApiKey || "";
  const model = aiConfig.geminiModel || GEMINI_DEFAULT_MODEL;
  const teamAName = context.teamAName || "Voyagers";
  const teamBName = context.teamBName || "Boots & Beers";

  const detailedRoster = players.map(p => {
    const a = p.attributes || {};
    return `  - ${p.name} (ID: "${p.id}", Pos: ${p.position}, OVR: ${p.ovr}, PAC: ${a.pac || 70}, SHO: ${a.sho || 70}, PAS: ${a.pas || 70}, DRI: ${a.dri || 70}, DEF: ${a.def || 70}, PHY: ${a.phy || 70}, GK: ${a.gk || 20})`;
  }).join("\n");

  const sectorExplanation = formatSectorWeightsExplanation(context.sectorWeights);

  const systemInstruction = `You are an elite football tactical coach and matchmaker.
Your task is to interpret the user's natural language squad instructions and convert them into structured balancing constraints and a pre-match tactical briefing.

Available Players in Today's Match:
${detailedRoster}
${context.leagueSummary ? `\nRecent League & Derby Context:\n${context.leagueSummary}\n` : ""}
Teams Playing: Team A ("${teamAName}") vs Team B ("${teamBName}")

${sectorExplanation}

Output Rules:
1. Extract pinned players for Team A ("${teamAName}") and Team B ("${teamBName}").
2. Extract pinnedPositions: any explicit on-pitch role/position assigned to a player (e.g. "keep Sanjay as GK" -> { player: "Sanjay", position: "GK" }, "play Abey as striker" -> { player: "Abey", position: "FWD" }).
3. Extract separated pairs (rivals who must be on opposite teams).
4. Extract paired players (duos who must be on the same team).
5. Provide a passionate, insightful 2-sentence pre-match tactical briefing referencing the match dynamics and strategy based on your sector analysis.`;

  const promptText = `User Instruction: "${userPrompt || "Generate tactically balanced lineups with even attacking and defensive strength"}"`;

  const payload = {
    contents: [
      {
        parts: [
          { text: `${systemInstruction}\n\n${promptText}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          pinnedTeamA: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Player names or IDs pinned to Team A"
          },
          pinnedTeamB: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Player names or IDs pinned to Team B"
          },
          pinnedPositions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                player: { type: "STRING", description: "Player name or ID" },
                position: { type: "STRING", enum: ["GK", "DEF", "MID", "FWD"], description: "Role/position player must play" }
              },
              required: ["player", "position"]
            },
            description: "Explicit role/position assignments requested by user (e.g. 'keep Sanjay as GK')"
          },
          separatedPairs: {
            type: "ARRAY",
            items: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            description: "Pairs of player names who must be on opposite teams"
          },
          pairedTogether: {
            type: "ARRAY",
            items: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            description: "Pairs of player names who must be on the same team"
          },
          coachBriefing: {
            type: "STRING",
            description: "2-sentence tactical pre-match briefing"
          }
        },
        required: ["pinnedTeamA", "pinnedTeamB", "separatedPairs", "pairedTogether", "coachBriefing"]
      }
    }
  };

  const data = await callGeminiGenerateContent(model, apiKey, payload);
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(textContent);

  const findIdByName = (nameOrId) => {
    if (!nameOrId) return null;
    const clean = nameOrId.toString().toLowerCase().trim();
    const direct = players.find(p => p.id.toLowerCase() === clean);
    if (direct) return direct.id;
    const nameMatch = players.find(p => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase().split(" ")[0]));
    return nameMatch ? nameMatch.id : null;
  };

  const pinnedA = new Set();
  const pinnedB = new Set();
  const separated = [];
  const paired = [];
  const pinnedPositions = {};

  (parsed.pinnedTeamA || []).forEach(name => {
    const id = findIdByName(name);
    if (id) pinnedA.add(id);
  });

  (parsed.pinnedTeamB || []).forEach(name => {
    const id = findIdByName(name);
    if (id) pinnedB.add(id);
  });

  (parsed.pinnedPositions || []).forEach(item => {
    if (item && item.player && item.position) {
      const id = findIdByName(item.player);
      const pos = (item.position || "").toUpperCase().trim();
      if (id && ["GK", "DEF", "MID", "FWD"].includes(pos)) {
        pinnedPositions[id] = pos;
      }
    }
  });

  // Guarantee extraction with rule-based regex fallback
  const regexPositions = extractPositionalConstraints(userPrompt, players);
  Object.assign(pinnedPositions, regexPositions);

  (parsed.separatedPairs || []).forEach(pair => {
    if (Array.isArray(pair) && pair.length >= 2) {
      const id1 = findIdByName(pair[0]);
      const id2 = findIdByName(pair[1]);
      if (id1 && id2 && id1 !== id2) separated.push([id1, id2]);
    }
  });

  (parsed.pairedTogether || []).forEach(pair => {
    if (Array.isArray(pair) && pair.length >= 2) {
      const id1 = findIdByName(pair[0]);
      const id2 = findIdByName(pair[1]);
      if (id1 && id2 && id1 !== id2) paired.push([id1, id2]);
    }
  });

  return {
    constraints: {
      pinnedA,
      pinnedB,
      pinnedTeamA: pinnedA,
      pinnedTeamB: pinnedB,
      separated,
      separatedPairs: separated,
      paired,
      pairedTogether: paired,
      pinnedPositions
    },
    coachBriefing: parsed.coachBriefing || "Tactically balanced lineup created.",
    raw: parsed
  };
}

import {
  formatLeagueSummaryForAi,
  computePlayerH2HRivalries,
  computePlayerJerseyWinRates,
  computeDefensiveLeakageStats,
  computeClutchScorers,
  computeDerbyTrends,
  computeTopWinningChemistries
} from "../services/leagueService.js";

/**
 * Analyzes historical Third Half United League match data using Google Gemini
 * @param {Array} matches
 * @param {Object} context
 * @param {Object} aiConfig
 * @returns {Promise<{ headline: string, rivalryInsight: string, partnershipInsight: string, clutchScorerInsight: string, defensiveInsight: string, jerseyParadoxInsight: string, derbyDynamicInsight: string }>}
 */
export async function queryGeminiLeagueInsights(matches = [], context = {}, aiConfig = {}) {
  const apiKey = aiConfig.geminiApiKey || "";
  const model = aiConfig.geminiModel || GEMINI_DEFAULT_MODEL;

  const leagueContext = formatLeagueSummaryForAi(matches);

  const prompt = `You are the chief tactical analyst and master statistician for Third Half United League.
Analyze the following deep historical match statistics from Season 2026:

${leagueContext}

Generate 6 deep, concrete, data-grounded insights derived strictly from actual match history:
1. "headline": Catchy, dramatic newspaper headline summarizing the derby narrative.
2. "rivalryInsight": Highlight a fierce personal Head-to-Head player rivalry (e.g. Abey vs Anoop, Abey vs Vinay), citing exact win/loss records when on opposing sides.
3. "partnershipInsight": Highlight a lethal winning teammate duo/chemistry (e.g. Vinay & Sreekanth, Mathai & Sanjay) and why they dominate when playing together.
4. "clutchScorerInsight": Analyze decisive clutch goalscorers in tight 1-goal games / draws vs high-scoring hat-trick performances (cite exact names and numbers).
5. "defensiveInsight": Analyze defensive lockdown vs goals conceded leakage per match, identifying who acts as a defensive wall and who needs greater compactness.
6. "jerseyParadoxInsight": Explore any surprising win rate disparities or paradoxes when players wear the Voyagers (Blue) jersey vs Boots & Beers (Yellow) jersey.
7. "derbyDynamicInsight": Forecast the derby pace and expected scoreline based on the historical goals per match average and past blowout/thriller patterns.`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.25,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          headline: { type: "STRING" },
          rivalryInsight: { type: "STRING" },
          partnershipInsight: { type: "STRING" },
          clutchScorerInsight: { type: "STRING" },
          defensiveInsight: { type: "STRING" },
          jerseyParadoxInsight: { type: "STRING" },
          derbyDynamicInsight: { type: "STRING" }
        },
        required: [
          "headline",
          "rivalryInsight",
          "partnershipInsight",
          "clutchScorerInsight",
          "defensiveInsight",
          "jerseyParadoxInsight",
          "derbyDynamicInsight"
        ]
      }
    }
  };

  const rivalries = computePlayerH2HRivalries(matches, 2);
  const chemistries = computeTopWinningChemistries(matches);
  const clutch = computeClutchScorers(matches);
  const defensive = computeDefensiveLeakageStats(matches, 3);
  const jerseyStats = computePlayerJerseyWinRates(matches).filter(p => p.totalMatches >= 2 && p.voyagers.matches > 0 && p.boots.matches > 0);
  const trends = computeDerbyTrends(matches);

  const topRivalry = rivalries[0] || { p1: "Abey", p2: "Anoop", matches: 4, p1Wins: 2, p2Wins: 1, draws: 1 };
  const topDuo = chemistries[0] || { p1: "Vinay", p2: "Sreekanth", wins: 2 };
  const topClutch = clutch.clutchScorers[0] || { name: "Sanjay", clutchGoals: 3 };
  const topDef = defensive[0] || { name: "Mathai", goalsAgainstPerMatch: 3.5 };
  const topJersey = jerseyStats[0] || { name: "Abey", voyagers: { winRate: 50 }, boots: { winRate: 33 } };

  try {
    const data = await callGeminiGenerateContent(model, apiKey, payload);
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(textContent);

    return {
      headline: parsed.headline || "Third Half United Derby Dynamics",
      rivalryInsight: parsed.rivalryInsight || `${topRivalry.p1} and ${topRivalry.p2} have clashed in ${topRivalry.matches} direct matchups (${topRivalry.p1} ${topRivalry.p1Wins}W - ${topRivalry.draws}D - ${topRivalry.p2Wins}W ${topRivalry.p2}).`,
      partnershipInsight: parsed.partnershipInsight || `${topDuo.p1} & ${topDuo.p2} boast a lethal joint record with ${topDuo.wins} wins when paired on the same side.`,
      clutchScorerInsight: parsed.clutchScorerInsight || `${topClutch.name} leads high-pressure moments with ${topClutch.clutchGoals} clutch goals in 1-goal margin games, while CP & Vinay hold hat-trick honours.`,
      defensiveInsight: parsed.defensiveInsight || `${topDef.name} anchors defensive stability with an impressive ${topDef.goalsAgainstPerMatch} goals conceded per match.`,
      jerseyParadoxInsight: parsed.jerseyParadoxInsight || `${topJersey.name} exhibits a stark jersey win rate contrast: ${topJersey.voyagers.winRate}% with Voyagers vs ${topJersey.boots.winRate}% with Boots & Beers.`,
      derbyDynamicInsight: parsed.derbyDynamicInsight || `Across ${trends.totalMatches} matches, an explosive ${trends.totalGoals} goals have been scored (${trends.avgGoalsPerMatch} goals/match) — expect another high-octane battle!`
    };
  } catch (err) {
    console.warn("Gemini league insights call failed, generating data-driven fallback:", err);
    return {
      headline: "Third Half United Derby Dynamics & Tactical Breakdown",
      rivalryInsight: `${topRivalry.p1} vs ${topRivalry.p2} has been one of the most intense battles (${topRivalry.matches} matches: ${topRivalry.p1} ${topRivalry.p1Wins}W - ${topRivalry.draws}D - ${topRivalry.p2Wins}W ${topRivalry.p2}).`,
      partnershipInsight: `${topDuo.p1} & ${topDuo.p2} form the benchmark winning partnership with ${topDuo.wins} victories when paired together.`,
      clutchScorerInsight: `${topClutch.name} delivers when the stakes are highest with ${topClutch.clutchGoals} clutch goals in close contests, complemented by CP & Vinay's 3-goal blitzes.`,
      defensiveInsight: `${topDef.name} leads defensive containment with only ${topDef.goalsAgainstPerMatch} goals conceded per match.`,
      jerseyParadoxInsight: `${topJersey.name} shows notable jersey polarity (${topJersey.voyagers.winRate}% win rate as Voyager vs ${topJersey.boots.winRate}% with Boots & Beers).`,
      derbyDynamicInsight: `With ${trends.totalGoals} goals scored across ${trends.totalMatches} games (${trends.avgGoalsPerMatch} goals/match), historical trends point towards a high-scoring thriller.`
    };
  }
}

/**
 * Reviews a balanced first draft and suggests tactical player swaps with Google Gemini.
 * @param {string} userPrompt
 * @param {Array} teamA
 * @param {Array} teamB
 * @param {Object} context
 * @param {Object} aiConfig
 * @returns {Promise<{ reviewCommentary: string, swaps: Array<{ playerFromTeamA: string, playerFromTeamB: string, rationale: string }> }>}
 */
export async function refineDraftWithGemini(userPrompt, teamA = [], teamB = [], context = {}, aiConfig = {}) {
  const apiKey = aiConfig.geminiApiKey || "";
  const model = aiConfig.geminiModel || GEMINI_DEFAULT_MODEL;

  const teamAName = context.teamAName || "Voyagers";
  const teamBName = context.teamBName || "Boots & Beers";

  const formatRoster = (players) => (players || []).map(p => {
    const a = p.effectiveAttributes || p.attributes || {};
    return `  - ${p.name} (${p.position}, OVR: ${p.effectiveOvr || p.ovr}, SHO: ${a.sho ?? 70}, DEF: ${a.def ?? 70}, PAS: ${a.pas ?? 75}, PAC: ${a.pac ?? 75})`;
  }).join("\n");

  const statsSummary = (context.statsA && context.statsB) ? `
CURRENT CALCULATED TEAM POTENTIALS & BALANCE:
- [${teamAName}]: Effective OVR: ${context.statsA.avgOvr} | ⚔️ Attack: ${context.statsA.attack} | ⚙️ Midfield: ${context.statsA.midfield} | 🛡️ Defense (incl GK): ${context.statsA.defense} (Best GK: ${context.statsA.goalkeeping}, Chemistry Boost: +${context.statsA.synergyBoost || 0} OVR)
- [${teamBName}]: Effective OVR: ${context.statsB.avgOvr} | ⚔️ Attack: ${context.statsB.attack} | ⚙️ Midfield: ${context.statsB.midfield} | 🛡️ Defense (incl GK): ${context.statsB.defense} (Best GK: ${context.statsB.goalkeeping}, Chemistry Boost: +${context.statsB.synergyBoost || 0} OVR)
- Sector Deltas: OVR Δ ${Math.abs(context.statsA.avgOvr - context.statsB.avgOvr).toFixed(1)} | ATT Δ ${Math.abs(context.statsA.attack - context.statsB.attack)} | MID Δ ${Math.abs(context.statsA.midfield - context.statsB.midfield)} | DEF Δ ${Math.abs(context.statsA.defense - context.statsB.defense)}
` : "";

  const sectorExplanation = formatSectorWeightsExplanation(context.sectorWeights);

  const prompt = `You are an elite football tactical coach refining an active 8v8 match draft.

ABSOLUTE STRICT RESTRICTION:
- There are ONLY ${teamA.length + teamB.length} players available today: exactly ${teamA.length} on ${teamAName} and ${teamB.length} on ${teamBName} as listed below.
- NO OTHER PLAYERS EXIST. You are STRICTLY FORBIDDEN from bringing in or naming any player not listed in the rosters below.
- Every swap MUST be 1 player currently on ${teamAName} exchanged with 1 player currently on ${teamBName}.

CURRENT DRAFT ROSTERS:
[${teamAName} Active Squad]:
${formatRoster(teamA)}

[${teamBName} Active Squad]:
${formatRoster(teamB)}
${statsSummary}
${sectorExplanation}
${context.leagueSummary ? `\nActive Squad Form Context:\n${context.leagueSummary}\n` : ""}

USER TACTICAL DIRECTIVE: "${userPrompt}"

YOUR MISSION:
Propose 1 or 2 player swaps between the active squad of ${teamAName} and active squad of ${teamBName} to satisfy: "${userPrompt}".
In your reviewCommentary, cite the sector dynamics (Attack, Midfield, Defense, or OVR) you chose to rebalance and explain the tactical impact of the swaps.
Do NOT say "no swaps needed". Propose concrete player swaps that fulfill the user's tactical instructions while keeping the match balanced.`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          reviewCommentary: {
            type: "STRING",
            description: "Tactical explanation of the swaps made to satisfy the directive"
          },
          swaps: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                playerFromTeamA: { type: "STRING" },
                playerFromTeamB: { type: "STRING" },
                rationale: { type: "STRING" }
              },
              required: ["playerFromTeamA", "playerFromTeamB", "rationale"]
            }
          }
        },
        required: ["reviewCommentary", "swaps"]
      }
    }
  };

  const data = await callGeminiGenerateContent(model, apiKey, payload);
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(textContent);

  return {
    reviewCommentary: parsed.reviewCommentary || "Draft reviewed and tactically aligned with your instructions.",
    swaps: Array.isArray(parsed.swaps) ? parsed.swaps : []
  };
}

/**
 * AI Scout: Analyzes historical league performance data, goals, and partner records
 * to generate attribute calibrations and chemistry partner recommendations using Google Gemini.
 *
 * @param {Object} scoutData - { playerProfiles, duoList, h2h }
 * @param {Object} aiConfig - { apiKey, model }
 * @returns {Promise<{ scoutSummary: string, attributeRecommendations: Array, chemistryRecommendations: Array }>}
 */
export async function generateGeminiScoutRecommendations(scoutData, aiConfig = {}) {
  const apiKey = aiConfig.apiKey || "";
  const model = aiConfig.model || GEMINI_DEFAULT_MODEL;

  const { playerProfiles = [], duoList = [], h2h = {} } = scoutData;

  const playerRosterSummary = playerProfiles.map(p => {
    const s = p.leagueStats || {};
    const a = p.attributes || {};
    return `• ${p.name} (ID: ${p.id}, Pos: ${p.position}/${p.secondaryPosition}, OVR: ${p.ovr}):
   - League Record: ${s.matches} matches (${s.wins}W - ${s.draws}D - ${s.losses}L, WinRate: ${s.winRate}%), Goals: ${s.goals}, GoalDiff: ${s.goalDifference > 0 ? '+' + s.goalDifference : s.goalDifference}
   - Current Attributes: PAC:${a.pac} SHO:${a.sho} PAS:${a.pas} DRI:${a.dri} DEF:${a.def} PHY:${a.phy} GK:${a.gk || 20}
   - Chemistry Partners: [${(p.chemistryPartners || []).join(', ')}]`;
  }).join("\n\n");

  const duoSummary = duoList.slice(0, 10).map(d =>
    `• ${d.p1Name} & ${d.p2Name}: ${d.matches} matches together, ${d.wins} wins (${d.winRate}% win rate, ${d.goalsFor} team goals)`
  ).join("\n");

  const prompt = `You are the Lead Performance Scout & Chief Analyst for the Third Half United League.
Your mission is to analyze players' real match history (goals scored, win rates, goal differences, teammate partnerships) and compare them with their current FIFA-style attributes (PAC, SHO, PAS, DRI, DEF, PHY, GK, OVR).

LEAGUE CONTEXT:
Total Matches Recorded: ${h2h.totalMatches || 4}
Voyagers (${h2h.voyagersWins || 0}W) vs Boots & Beers (${h2h.bootsWins || 0}W)

PLAYER PROFILES & STATS:
${playerRosterSummary}

TOP WINNING TEAMMATE DUOS:
${duoSummary || "None recorded yet"}

SCOUTING GUIDELINES:
1. ATTRIBUTE CALIBRATIONS:
   - Identify standout goalscorers (e.g. Vinay with 7 goals, Sreekanth with 5 goals) whose current SHO/PAC/DRI/OVR is underrated relative to their finishing impact. Recommend realistic upgrades (e.g. +4 to +10 SHO, +1 to +4 OVR).
   - Identify high-win-rate anchors and defensive leaders (e.g. Anoop with 75% win rate, Sanjay) and recommend appropriate DEF/PHY/PAS boosts.
   - For players with zero goals or struggling win rates, consider small recalibrations if appropriate.
   - For each recommended player, provide a sharp 1-2 sentence scouting rationale, their currentOvr, suggestedOvr, attributeDiffs (e.g. { "sho": "+8", "pac": "+3" }), and complete suggestedAttributes object.

2. CHEMISTRY DUO RECOMMENDATIONS:
   - Recommend new Chemistry Partner pairs for teammates who have proven high win rates when playing together (e.g. win rate >= 65% across multiple games).
   - Provide a clear rationale explaining their on-pitch synergy.

Be precise, realistic, and insightful.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          scoutSummary: {
            type: "STRING",
            description: "2-3 sentence executive scout summary of the league's standout performers and key trends."
          },
          attributeRecommendations: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                playerId: { type: "STRING" },
                playerName: { type: "STRING" },
                reason: { type: "STRING" },
                currentOvr: { type: "NUMBER" },
                suggestedOvr: { type: "NUMBER" },
                attributeDiffs: {
                  type: "OBJECT",
                  properties: {
                    pac: { type: "STRING" },
                    sho: { type: "STRING" },
                    pas: { type: "STRING" },
                    dri: { type: "STRING" },
                    def: { type: "STRING" },
                    phy: { type: "STRING" },
                    gk: { type: "STRING" }
                  }
                },
                suggestedAttributes: {
                  type: "OBJECT",
                  properties: {
                    pac: { type: "NUMBER" },
                    sho: { type: "NUMBER" },
                    pas: { type: "NUMBER" },
                    dri: { type: "NUMBER" },
                    def: { type: "NUMBER" },
                    phy: { type: "NUMBER" },
                    gk: { type: "NUMBER" }
                  },
                  required: ["pac", "sho", "pas", "dri", "def", "phy"]
                }
              },
              required: ["playerId", "playerName", "reason", "currentOvr", "suggestedOvr", "suggestedAttributes"]
            }
          },
          chemistryRecommendations: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                player1Id: { type: "STRING" },
                player1Name: { type: "STRING" },
                player2Id: { type: "STRING" },
                player2Name: { type: "STRING" },
                reason: { type: "STRING" },
                winRate: { type: "NUMBER" },
                matchesTogether: { type: "NUMBER" }
              },
              required: ["player1Id", "player1Name", "player2Id", "player2Name", "reason"]
            }
          }
        },
        required: ["scoutSummary", "attributeRecommendations", "chemistryRecommendations"]
      }
    }
  };

  const data = await callGeminiGenerateContent(model, apiKey, payload);
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(textContent);

  return {
    scoutSummary: parsed.scoutSummary || "AI Scout analyzed recent league fixtures and performance records.",
    attributeRecommendations: Array.isArray(parsed.attributeRecommendations) ? parsed.attributeRecommendations : [],
    chemistryRecommendations: Array.isArray(parsed.chemistryRecommendations) ? parsed.chemistryRecommendations : []
  };
}

/**
 * Direct Pure AI Squad Selection: Google Gemini directly allocates players to Team A and Team B without the math balancer.
 * @param {string} userPrompt - Instructions from user
 * @param {Array}  players - Selected players for the match
 * @param {Object} context - { teamAName, teamBName, targetTeamSize, sectorWeights, matchdaySettings, leagueSummary }
 * @param {Object} aiConfig - { geminiApiKey, geminiModel }
 * @returns {Promise<{ teamANames: string[], teamBNames: string[], formationA?: string, formationB?: string, tacticalRationale: string, coachBriefing: string }>}
 */
export async function queryGeminiPureTeamSplit(userPrompt, players, context = {}, aiConfig = {}) {
  const apiKey = aiConfig.geminiApiKey || "";
  const model = aiConfig.geminiModel || GEMINI_DEFAULT_MODEL;
  const teamAName = context.teamAName || "Voyagers";
  const teamBName = context.teamBName || "Boots & Beers";
  const targetTeamSize = context.targetTeamSize || Math.floor(players.length / 2);

  const detailedRoster = players.map(p => {
    const a = p.attributes || {};
    const setting = (context.matchdaySettings && context.matchdaySettings[p.id]) || {};
    const form = setting.form || p.form || "neutral";
    const fit = setting.fitness !== undefined ? setting.fitness : (p.fitness || 100);
    const chem = (p.chemistryPartners || []).join(", ") || "None";
    return `  - "${p.name}" (ID: "${p.id}", Natural Pos: ${p.position}, OVR: ${p.ovr}, PAC: ${a.pac || 70}, SHO: ${a.sho || 70}, PAS: ${a.pas || 70}, DRI: ${a.dri || 70}, DEF: ${a.def || 70}, PHY: ${a.phy || 70}, GK: ${a.gk || 20}, Form: ${form}, Fit: ${fit}%, Chemistry Partners: [${chem}])`;
  }).join("\n");

  const sectorExplanation = formatSectorWeightsExplanation(context.sectorWeights);

  const systemInstruction = `You are an elite football tactical coach and AI squad matchmaker.
Your task is to autonomously assign EXACTLY ${players.length} selected players into two balanced, tactically complete teams:
- Team A ("${teamAName}"): exactly ${targetTeamSize} players
- Team B ("${teamBName}"): exactly ${targetTeamSize} players

Every single player from the list below MUST be assigned to exactly ONE team (no omissions, no duplicates).

Available Selected Players:
${detailedRoster}
${context.leagueSummary ? `\nRecent League & Derby Context:\n${context.leagueSummary}\n` : ""}
${sectorExplanation}

Tactical Rules:
1. Ensure both teams have suitable positional coverage (Goalkeeping, Defense, Midfield, Attack).
2. Take into account chemistry duos, player attributes, matchday form, and sector balance.
3. Follow the user's tactical instructions strictly while creating competitive derby lineups.
4. Output recommended formations for both teams (e.g. "1-3-3-1", "1-3-2-2", "1-2-3-2", "1-2-4-1").
5. Provide a tactical rationale and pre-match briefing.`;

  const promptText = `User Instruction: "${userPrompt || `Build two tactically balanced, fiercely competitive derby teams for ${teamAName} and ${teamBName}`}"`;

  const payload = {
    contents: [
      {
        parts: [
          { text: `${systemInstruction}\n\n${promptText}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          teamA: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: `List of exactly ${targetTeamSize} player names assigned to ${teamAName}`
          },
          teamB: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: `List of exactly ${targetTeamSize} player names assigned to ${teamBName}`
          },
          formationA: {
            type: "STRING",
            description: `Recommended formation for ${teamAName} (e.g. 1-3-3-1, 1-3-2-2)`
          },
          formationB: {
            type: "STRING",
            description: `Recommended formation for ${teamBName} (e.g. 1-3-3-1, 1-3-2-2)`
          },
          tacticalRationale: {
            type: "STRING",
            description: "2-3 sentence analysis explaining how the tactical matchup and sector dynamics were constructed."
          },
          coachBriefing: {
            type: "STRING",
            description: "Passionate 2-sentence pre-match tactical locker-room briefing."
          }
        },
        required: ["teamA", "teamB", "tacticalRationale", "coachBriefing"]
      }
    }
  };

  const data = await callGeminiGenerateContent(model, apiKey, payload);
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(textContent);

  return {
    teamANames: Array.isArray(parsed.teamA) ? parsed.teamA : [],
    teamBNames: Array.isArray(parsed.teamB) ? parsed.teamB : [],
    formationA: parsed.formationA || null,
    formationB: parsed.formationB || null,
    tacticalRationale: parsed.tacticalRationale || "",
    coachBriefing: parsed.coachBriefing || parsed.tacticalRationale || ""
  };
}


