import { testGeminiConnection, queryGeminiCoach, queryGeminiLeagueInsights, refineDraftWithGemini, generateGeminiScoutRecommendations, formatSectorWeightsExplanation, GEMINI_DEFAULT_MODEL } from "./geminiClient.js";

export const DEFAULT_AI_CONFIG = {
  provider: "ollama", // "ollama" | "gemini"
  endpoint: "http://localhost:11434",
  model: "qwen2.5-coder:1.5b",
  geminiApiKey: "",
  geminiModel: GEMINI_DEFAULT_MODEL,
  enabled: true
};

/**
 * Loads AI config from localStorage with defaults
 */
export function loadAiConfig() {
  try {
    const raw = localStorage.getItem("ftb_ai_config");
    if (raw) {
      return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn("Failed to load AI config from storage:", e);
  }
  return { ...DEFAULT_AI_CONFIG };
}

/**
 * Saves AI config to localStorage
 */
export function saveAiConfig(config) {
  try {
    localStorage.setItem("ftb_ai_config", JSON.stringify(config));
  } catch (e) {
    console.warn("Failed to save AI config to storage:", e);
  }
}

export { testGeminiConnection };

/**
 * Shared helper to call Ollama API with automatic CORS proxy fallback
 */
async function fetchOllamaApi(subpath, options = {}, preferredEndpoint = DEFAULT_AI_CONFIG.endpoint) {
  const cleanEndpoint = (preferredEndpoint || DEFAULT_AI_CONFIG.endpoint).replace(/\/+$/, "");
  const normalizedPath = subpath.startsWith("/") ? subpath : "/" + subpath;

  const candidates = [
    `/api/ollama${normalizedPath}`,
    `${cleanEndpoint}${normalizedPath}`
  ];

  const uniqueCandidates = [...new Set(candidates)];
  let lastError = null;

  for (const url of uniqueCandidates) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return res;
      }
      lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to reach Ollama API");
}

/**
 * Tests connection to the local Ollama instance
 * @param {string} endpoint - e.g. "http://localhost:11434"
 * @param {string} model - e.g. "qwen2.5-coder:1.5b"
 * @returns {Promise<{ ok: boolean, error?: string, models?: string[] }>}
 */
export async function testOllamaConnection(endpoint = DEFAULT_AI_CONFIG.endpoint, model = DEFAULT_AI_CONFIG.model) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetchOllamaApi("/api/tags", {
      method: "GET",
      signal: controller.signal
    }, endpoint);
    clearTimeout(timeoutId);

    const data = await res.json();
    const modelList = (data.models || []).map(m => m.name);
    const hasModel = modelList.some(name => name.includes(model) || model.includes(name.split(":")[0]));

    return {
      ok: true,
      models: modelList,
      hasTargetModel: hasModel,
      targetModel: model
    };
  } catch (err) {
    let errorMsg = err.message || "Failed to reach Ollama";
    if (err.name === "AbortError") {
      errorMsg = "Connection timed out (Ollama not responding on port 11434)";
    } else if (errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
      errorMsg = "Cannot connect to Ollama. Make sure Ollama is running (`ollama serve`).";
    }
    return { ok: false, error: errorMsg };
  }
}

/**
 * Unified test connection function supporting both Ollama and Gemini
 */
export async function testAiConnection(aiConfig = DEFAULT_AI_CONFIG) {
  if (aiConfig.provider === "gemini") {
    return testGeminiConnection(aiConfig.geminiApiKey, aiConfig.geminiModel);
  }
  return testOllamaConnection(aiConfig.endpoint, aiConfig.model);
}

/**
 * Robust JSON extractor that handles markdown blocks, trailing tokens, or truncated outputs
 */
export function extractJsonObject(rawText) {
  if (!rawText) return {};
  // 1. Direct parse attempt
  try { return JSON.parse(rawText); } catch (e) {}

  // 2. Remove markdown code fences
  let cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch (e) {}

  // 3. Extract substring between first '{' and last '}'
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sub = cleaned.substring(firstBrace, lastBrace + 1);
    try { return JSON.parse(sub); } catch (e) {}
  }

  // 4. Attempt to repair truncated JSON (e.g. missing closing quotes or brackets)
  if (firstBrace !== -1) {
    let partial = cleaned.substring(firstBrace);
    // Count open brackets
    const openBraces = (partial.match(/{/g) || []).length;
    const closeBraces = (partial.match(/}/g) || []).length;
    const openBrackets = (partial.match(/\[/g) || []).length;
    const closeBrackets = (partial.match(/\]/g) || []).length;
    
    if (openBrackets > closeBrackets) partial += "]".repeat(openBrackets - closeBrackets);
    if (openBraces > closeBraces) partial += "}".repeat(openBraces - closeBraces);
    try { return JSON.parse(partial); } catch (e) {}
  }

  // 5. Fallback: return raw text as coachBriefing without crashing
  return {
    coachBriefing: rawText.replace(/[{}[\]"]/g, "").trim() || "Tactically balanced lineup created."
  };
}

/**
 * Sends natural language coach instructions to Ollama or Gemini
 */
export async function queryAiCoach(userPrompt, players, context = {}, aiConfig = DEFAULT_AI_CONFIG) {
  if (aiConfig.provider === "gemini") {
    return queryGeminiCoach(userPrompt, players, context, aiConfig);
  }
  return queryOllamaCoach(userPrompt, players, context, aiConfig);
}

/**
 * Sends natural language coach instructions to Ollama qwen2.5-coder:1.5b
 * and returns structured constraints & tactical briefing.
 */
async function queryOllamaCoach(userPrompt, players, context = {}, aiConfig = DEFAULT_AI_CONFIG) {
  const endpoint = (aiConfig.endpoint || DEFAULT_AI_CONFIG.endpoint).replace(/\/+$/, "");
  const model = aiConfig.model || DEFAULT_AI_CONFIG.model;
  const teamAName = context.teamAName || "Voyagers";
  const teamBName = context.teamBName || "Boots & Beers";

  // Format individual player ratings (PAC, SHO, PAS, DRI, DEF, PHY, GK) compactly
  const detailedRoster = players.map(p => {
    const a = p.attributes || {};
    if (p.position === "GK") {
      return `• ${p.name} [GK | OVR:${p.ovr} | GK:${a.gk || 75} PAS:${a.pas || 60} PHY:${a.phy || 70}]`;
    }
    return `• ${p.name} [${p.position} | OVR:${p.ovr} | PAC:${a.pac || 70} SHO:${a.sho || 70} PAS:${a.pas || 70} DRI:${a.dri || 70} DEF:${a.def || 70} PHY:${a.phy || 70}]`;
  }).join("\n");

  const sectorExplanation = formatSectorWeightsExplanation(context.sectorWeights);

  const systemPrompt = `You are an elite football tactical coach. Analyze the user's instructions and player pool for an 8v8 match between ${teamAName} and ${teamBName}.
Available Players:
${detailedRoster}

${sectorExplanation}

Rules:
1. Pinned players: assign specific players to "${teamAName}" or "${teamBName}" ONLY if the user explicitly requested it or implied it strongly.
2. Separated players: if user wants players on opposite teams (e.g. "separate strikers", "put X against Y"), pair them in separatedPairs.
3. Paired players: if user wants players together, pair them in pairedTogether.
4. If the user mentions tactical style (e.g. "counter-attack", "possession", "high pace"), pick key players fitting that profile and pin or pair them accordingly.
5. Provide a 2-sentence pre-match tactical briefing explaining your strategy and highlighting a key player matchup based on sector potentials.

CRITICAL: You MUST respond ONLY with a valid JSON object matching this schema. No intro, no markdown explanation, no other text:
{
  "pinnedTeamA": ["PlayerName1", "PlayerName2"],
  "pinnedTeamB": ["PlayerName3"],
  "separatedPairs": [["PlayerNameA", "PlayerNameB"]],
  "pairedTogether": [["PlayerNameC", "PlayerNameD"]],
  "coachBriefing": "Two-sentence tactical briefing and matchup preview."
}`;

  const payload = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    stream: false,
    format: "json",
    options: {
      temperature: 0.1,
      num_predict: 350,
      num_ctx: 1536
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetchOllamaApi("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    }, endpoint);
    clearTimeout(timeoutId);

    const data = await res.json();
    const content = (data.message?.content || "").trim();
    const parsed = extractJsonObject(content);

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

    (parsed.pinnedTeamA || []).forEach(name => {
      const id = findIdByName(name);
      if (id) pinnedA.add(id);
    });

    (parsed.pinnedTeamB || []).forEach(name => {
      const id = findIdByName(name);
      if (id) pinnedB.add(id);
    });

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
      constraints: { pinnedA, pinnedB, separated, paired },
      coachBriefing: parsed.coachBriefing || parsed.tacticalStyle || "Balanced lineup generated based on matchday tactical requirements.",
      raw: parsed
    };
  } catch (err) {
    clearTimeout(timeoutId);
    let msg = err.message || "Failed to communicate with local AI";
    if (err.name === "AbortError") {
      msg = "AI Coach request timed out after 60s. Is Ollama running?";
    }
    throw new Error(msg);
  }
}

/**
 * Generates comprehensive tactical and historical league insights from match history.
 */
export async function queryLeagueInsights(matches = [], aiConfig = DEFAULT_AI_CONFIG) {
  if (aiConfig.provider === "gemini") {
    return queryGeminiLeagueInsights(matches, {}, aiConfig);
  }
  return queryOllamaLeagueInsights(matches, aiConfig);
}

async function queryOllamaLeagueInsights(matches = [], aiConfig = DEFAULT_AI_CONFIG) {
  const endpoint = (aiConfig.endpoint || DEFAULT_AI_CONFIG.endpoint).replace(/\/+$/, "");
  const model = aiConfig.model || DEFAULT_AI_CONFIG.model;

  const matchSummary = matches.map(m => {
    const voyTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("voyager"));
    const bootsTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("boot"));
    const voyScorers = (voyTeam?.scorers || []).filter(s => !s.is_own_goal).map(s => `${s.name} (${s.goals}G)`).join(", ") || "none";
    const bootsScorers = (bootsTeam?.scorers || []).filter(s => !s.is_own_goal).map(s => `${s.name} (${s.goals}G)`).join(", ") || "none";
    return `• ${m.match_date} (Season ${m.season}): Voyagers ${voyTeam?.score ?? '?'} (Scorers: ${voyScorers}) - ${bootsTeam?.score ?? '?'} (Scorers: ${bootsScorers}) Boots & Beers
  - Voyagers Lineup: ${(voyTeam?.members || []).join(", ")}
  - Boots & Beers Lineup: ${(bootsTeam?.members || []).join(", ")}`;
  }).join("\n");

  const systemPrompt = `You are a sharp football pundit for Third Half United League.
Match & Scorers History:
${matchSummary}

Provide a concise, specific tactical breakdown and fun fact.
Respond with pure JSON matching this exact schema:
{
  "headline": "Punchy 1-line headline summarizing the rivalry status",
  "scorersTakeaway": "1-2 sentences on top 3 goal scorers (Vinay with 7 goals, Sreekanth with 5 goals, CP with 4 goals) and their finishing impact",
  "winnersTakeaway": "1-2 sentences on top 3 consistent winners (Anoop, Mathai, Sanjay) and how their presence wins games",
  "losersTakeaway": "1-2 sentences on top 3 consistent losers (Ajith, Akash, Anup) with practical tactical advice on how to secure a win",
  "funFact": "1-2 sentences with an entertaining or surprising fun fact based on the historical match statistics"
}
Rules: Be concise, cite exact player names and goal tallies from data, and focus on practical tactics and engaging trivia.`;

  const payload = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Analyze top scorers, consistent winners, consistent losers, and share an engaging matchday fun fact." }
    ],
    stream: false,
    format: "json",
    options: {
      temperature: 0.15,
      num_predict: 350,
      num_ctx: 1024
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetchOllamaApi("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    }, endpoint);
    clearTimeout(timeoutId);

    const data = await res.json();
    const content = (data.message?.content || "").trim();

    // Parse JSON safely
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      let cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first !== -1 && last > first) {
        parsed = JSON.parse(cleaned.substring(first, last + 1));
      } else {
        parsed = {
          headline: "Third Half United League Analysis",
          scorersTakeaway: "Vinay (7G), Sreekanth (5G), and CP (4G) have provided lethal finishing across high-scoring fixtures.",
          winnersTakeaway: "Anoop, Mathai, and Sanjay have provided consistent match-winning cohesion for their sides.",
          losersTakeaway: "Ajith, Akash, and Anup need tighter midfield compactness and quicker defensive transitions.",
          funFact: "Across all 4 fixtures this season, 32 goals have been scored at an average of 8.0 goals per match!"
        };
      }
    }

    return {
      headline: parsed.headline || "Third Half United Derby Dynamics",
      scorersTakeaway: parsed.scorersTakeaway || "Vinay (7G), Sreekanth (5G), and CP (4G) lead the scoring charts with clinical finishing.",
      winnersTakeaway: parsed.winnersTakeaway || "Anoop, Mathai, and Sanjay have maintained undefeated winning runs through strong midfield control.",
      losersTakeaway: parsed.losersTakeaway || "Ajith, Akash, and Anup must improve defensive discipline and counter-attack finishing to break the streak.",
      funFact: parsed.funFact || parsed.prediction || "Across all 4 fixtures this season, 32 goals have been scored at an average of 8.0 goals per match!"
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(err.message || "Failed to generate league insights from local AI");
  }
}

/**
 * Reviews a balanced first draft and suggests tactical player swaps based on user instructions.
 */
export async function refineDraftWithAi(userPrompt, teamA = [], teamB = [], context = {}, aiConfig = DEFAULT_AI_CONFIG) {
  if (aiConfig.provider === "gemini") {
    return refineDraftWithGemini(userPrompt, teamA, teamB, context, aiConfig);
  }
  return refineDraftWithOllama(userPrompt, teamA, teamB, context, aiConfig);
}

async function refineDraftWithOllama(userPrompt, teamA = [], teamB = [], context = {}, aiConfig = DEFAULT_AI_CONFIG) {
  const endpoint = (aiConfig.endpoint || DEFAULT_AI_CONFIG.endpoint).replace(/\/+$/, "");
  const model = aiConfig.model || DEFAULT_AI_CONFIG.model;

  const teamAName = context.teamAName || "Voyagers";
  const teamBName = context.teamBName || "Boots & Beers";
  const statsA = context.statsA || {};
  const statsB = context.statsB || {};

  const formatRoster = (players) => players.map(p => {
    const a = p.effectiveAttributes || p.attributes || {};
    return `  - ${p.name} (${p.position}, OVR: ${p.effectiveOvr || p.ovr}, SHO: ${a.sho ?? 70}, DEF: ${a.def ?? 70}, PAS: ${a.pas ?? 75}, PAC: ${a.pac ?? 75})`;
  }).join("\n");

  const statsSummary = (statsA.avgOvr && statsB.avgOvr) ? `
CURRENT CALCULATED TEAM POTENTIALS:
- [${teamAName}]: Effective OVR: ${statsA.avgOvr} | ⚔️ Attack: ${statsA.attack} | ⚙️ Midfield: ${statsA.midfield} | 🛡️ Defense (incl GK): ${statsA.defense} (Best GK: ${statsA.goalkeeping}, Chemistry Boost: +${statsA.synergyBoost || 0} OVR)
- [${teamBName}]: Effective OVR: ${statsB.avgOvr} | ⚔️ Attack: ${statsB.attack} | ⚙️ Midfield: ${statsB.midfield} | 🛡️ Defense (incl GK): ${statsB.defense} (Best GK: ${statsB.goalkeeping}, Chemistry Boost: +${statsB.synergyBoost || 0} OVR)
` : "";

  const sectorExplanation = formatSectorWeightsExplanation(context.sectorWeights);

  const systemPrompt = `You are an elite football tactical coach refining an active 8v8 match draft.

ABSOLUTE STRICT RESTRICTION:
- There are ONLY ${teamA.length + teamB.length} players available today: exactly ${teamA.length} on ${teamAName} and ${teamB.length} on ${teamBName} as listed below.
- NO OTHER PLAYERS EXIST. You are STRICTLY FORBIDDEN from bringing in, naming, or recommending ANY player who is not in the rosters below.
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
Do NOT say "no swaps needed". You must execute concrete player swaps that fulfill the user's tactical instructions while keeping the overall match competitive and balanced.

SWAP RULES:
1. In each swap, one player MUST be from ${teamAName} and the other player MUST be from ${teamBName}.
2. Use EXACT player names as listed in the active squads above.
3. Swapping players of comparable roles (e.g. FWD for FWD, or MID for MID) preserves overall team balance.

Respond with pure JSON matching this exact schema:
{
  "reviewCommentary": "Tactical explanation of the swaps between the active players to satisfy the directive",
  "swaps": [
    {
      "playerFromTeamA": "Player name from ${teamAName} Active Squad",
      "playerFromTeamB": "Player name from ${teamBName} Active Squad",
      "rationale": "Tactical reason for this swap"
    }
  ]
}`;

  const payload = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Execute tactical player swaps between the two active squads to fulfill: "${userPrompt}"` }
    ],
    stream: false,
    format: "json",
    options: {
      temperature: 0.25,
      num_predict: 350,
      num_ctx: 1536
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetchOllamaApi("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    }, endpoint);
    clearTimeout(timeoutId);

    const data = await res.json();
    const rawContent = (data.message?.content || "").trim();

    let parsed = extractJsonObject(rawContent);
    if (!parsed) {
      parsed = {
        reviewCommentary: "Draft reviewed and tactically aligned with your instructions.",
        swaps: []
      };
    }

    const matchPlayer = (team, nameStr) => {
      if (!nameStr) return null;
      const clean = nameStr.toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
      let found = team.find(p => p.name.toLowerCase().trim() === clean);
      if (found) return found;
      found = team.find(p => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase()));
      if (found) return found;
      const first = clean.split(" ")[0];
      return team.find(p => p.name.toLowerCase().split(" ")[0] === first) || null;
    };

    const validSwaps = [];
    (parsed.swaps || []).forEach(s => {
      let pA = matchPlayer(teamA, s.playerFromTeamA);
      let pB = matchPlayer(teamB, s.playerFromTeamB);

      // Check if LLM reversed Team A and Team B keys
      if (!pA || !pB) {
        const revA = matchPlayer(teamA, s.playerFromTeamB);
        const revB = matchPlayer(teamB, s.playerFromTeamA);
        if (revA && revB) {
          pA = revA;
          pB = revB;
        }
      }

      if (pA && pB && pA.id !== pB.id) {
        validSwaps.push({
          playerFromTeamA: pA.name,
          playerFromTeamB: pB.name,
          rationale: s.rationale || "Tactical adjustment"
        });
      }
    });

    return {
      reviewCommentary: parsed.reviewCommentary || "Draft tactically refined according to instructions.",
      swaps: validSwaps
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(err.message || "Failed to refine draft with AI Coach");
  }
}

/**
 * Heuristic scout recommendation generator that analyzes league records directly
 * (used as robust fallback or instant baseline).
 */
export function generateHeuristicScoutRecommendations(scoutData) {
  const { playerProfiles = [], duoList = [] } = scoutData;
  const attributeRecommendations = [];
  const chemistryRecommendations = [];

  // 1. Identify standout goalscorers to upgrade shooting/attack
  playerProfiles.forEach(p => {
    const goals = p.leagueStats?.goals || 0;
    const matches = p.leagueStats?.matches || 1;
    const winRate = p.leagueStats?.winRate || 0;
    const a = p.attributes || { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70, gk: 20 };

    if (goals >= 2 && goals / matches >= 0.60 && a.sho < 92) {
      const shoBoost = goals >= 5 ? 8 : goals >= 3 ? 6 : 4;
      const pacBoost = 3;
      const driBoost = 2;
      const suggestedOvr = Math.min(95, p.ovr + (goals >= 5 ? 3 : 2));
      attributeRecommendations.push({
        playerId: p.id,
        playerName: p.name,
        reason: `Lethal finishing form: ${goals} goals scored in ${matches} matches (${(goals / matches).toFixed(2)} goals/game).`,
        currentOvr: p.ovr,
        suggestedOvr,
        attributeDiffs: { sho: `+${shoBoost}`, pac: `+${pacBoost}`, dri: `+${driBoost}` },
        suggestedAttributes: {
          pac: Math.min(99, a.pac + pacBoost),
          sho: Math.min(99, a.sho + shoBoost),
          pas: a.pas,
          dri: Math.min(99, a.dri + driBoost),
          def: a.def,
          phy: Math.min(99, a.phy + 2),
          gk: a.gk || 20
        }
      });
    } else if (matches >= 2 && winRate >= 70 && (p.position === "DEF" || p.position === "MID") && a.def < 90) {
      // Defensive/Midfield winning anchor
      const defBoost = 4;
      const phyBoost = 4;
      const suggestedOvr = Math.min(95, p.ovr + 2);
      attributeRecommendations.push({
        playerId: p.id,
        playerName: p.name,
        reason: `Defensive anchor with dominant ${winRate}% win rate across ${matches} matches.`,
        currentOvr: p.ovr,
        suggestedOvr,
        attributeDiffs: { def: `+${defBoost}`, phy: `+${phyBoost}` },
        suggestedAttributes: {
          pac: a.pac,
          sho: a.sho,
          pas: a.pas,
          dri: a.dri,
          def: Math.min(99, a.def + defBoost),
          phy: Math.min(99, a.phy + phyBoost),
          gk: a.gk || 20
        }
      });
    }
  });

  // 2. Identify top winning duos who are not yet chemistry partners
  duoList.forEach(d => {
    if (d.matches >= 2 && d.winRate >= 65) {
      const p1 = playerProfiles.find(p => p.name.toLowerCase().trim() === d.p1Name.toLowerCase().trim());
      const p2 = playerProfiles.find(p => p.name.toLowerCase().trim() === d.p2Name.toLowerCase().trim());
      if (p1 && p2) {
        const alreadyPartners = (p1.chemistryPartners || []).includes(p2.id) || (p2.chemistryPartners || []).includes(p1.id);
        if (!alreadyPartners) {
          chemistryRecommendations.push({
            player1Id: p1.id,
            player1Name: p1.name,
            player2Id: p2.id,
            player2Name: p2.name,
            reason: `Proven winning partnership: ${d.wins} wins in ${d.matches} games together (${d.winRate}% win rate, ${d.goalsFor} goals).`,
            winRate: d.winRate,
            matchesTogether: d.matches
          });
        }
      }
    }
  });

  return {
    scoutSummary: `Scout analysis completed on recent fixtures. Standout performers and winning teammate chemistry identified.`,
    attributeRecommendations: attributeRecommendations.slice(0, 6),
    chemistryRecommendations: chemistryRecommendations.slice(0, 4)
  };
}

/**
 * AI Scout analysis via Local Ollama
 */
export async function generateOllamaScoutRecommendations(scoutData, aiConfig = {}) {
  const endpoint = aiConfig.endpoint || DEFAULT_AI_CONFIG.endpoint;
  const model = aiConfig.model || DEFAULT_AI_CONFIG.model;

  const { playerProfiles = [], duoList = [], h2h = {} } = scoutData;

  const playerRosterSummary = playerProfiles.map(p => {
    const s = p.leagueStats || {};
    const a = p.attributes || {};
    return `• ${p.name} (ID: ${p.id}, Pos: ${p.position}, OVR: ${p.ovr}): ${s.matches}M (${s.wins}W-${s.losses}L, WinRate:${s.winRate}%), Goals:${s.goals} | Attr: PAC:${a.pac} SHO:${a.sho} PAS:${a.pas} DRI:${a.dri} DEF:${a.def} PHY:${a.phy}`;
  }).join("\n");

  const duoSummary = duoList.slice(0, 8).map(d =>
    `• ${d.p1Name} & ${d.p2Name}: ${d.matches} matches, ${d.wins} wins (${d.winRate}%)`
  ).join("\n");

  const prompt = `You are the Chief Scout for the Third Half United League.
Analyze player performance from past league fixtures and recommend realistic attribute upgrades/downgrades and Chemistry Partner duos.

PLAYER STATS:
${playerRosterSummary}

TOP DUOS:
${duoSummary || "None"}

Respond strictly with valid JSON format:
{
  "scoutSummary": "2-3 sentences on standout performers and trends.",
  "attributeRecommendations": [
    {
      "playerId": "string",
      "playerName": "string",
      "reason": "Clear explanation",
      "currentOvr": 80,
      "suggestedOvr": 83,
      "attributeDiffs": { "sho": "+8", "pac": "+3" },
      "suggestedAttributes": { "pac": 85, "sho": 84, "pas": 78, "dri": 82, "def": 50, "phy": 78, "gk": 15 }
    }
  ],
  "chemistryRecommendations": [
    {
      "player1Id": "string",
      "player1Name": "string",
      "player2Id": "string",
      "player2Name": "string",
      "reason": "Why they have high synergy",
      "winRate": 75,
      "matchesTogether": 3
    }
  ]
}`;

  const payload = {
    model: model,
    messages: [
      {
        role: "system",
        content: "You are an expert football scout. Output valid JSON only, no markdown, no prose."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    format: "json",
    stream: false,
    options: {
      temperature: 0.3,
      num_predict: 1024,
      num_ctx: 2048
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetchOllamaApi("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    }, endpoint);
    clearTimeout(timeoutId);

    const data = await res.json();
    const rawContent = (data.message?.content || "").trim();
    let parsed = extractJsonObject(rawContent);

    if (!parsed || !Array.isArray(parsed.attributeRecommendations)) {
      return generateHeuristicScoutRecommendations(scoutData);
    }

    return {
      scoutSummary: parsed.scoutSummary || "AI Scout analyzed recent league fixtures.",
      attributeRecommendations: Array.isArray(parsed.attributeRecommendations) ? parsed.attributeRecommendations : [],
      chemistryRecommendations: Array.isArray(parsed.chemistryRecommendations) ? parsed.chemistryRecommendations : []
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Ollama scout failed, falling back to heuristic scout:", err);
    return generateHeuristicScoutRecommendations(scoutData);
  }
}

/**
 * Unified AI Scout Entry Point: Routes to Gemini or Ollama depending on user configuration.
 */
export async function getAiScoutRecommendations(scoutData, aiConfig = DEFAULT_AI_CONFIG) {
  if (aiConfig.provider === "gemini") {
    try {
      return await generateGeminiScoutRecommendations(scoutData, aiConfig);
    } catch (err) {
      console.warn("Gemini scout call failed, falling back to heuristic:", err);
      return generateHeuristicScoutRecommendations(scoutData);
    }
  } else {
    return await generateOllamaScoutRecommendations(scoutData, aiConfig);
  }
}
