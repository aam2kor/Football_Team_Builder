/**
 * Ollama Client for Football Team Builder
 * Connects to local LLM (qwen2.5-coder:1.5b or any Ollama model)
 * using structured JSON schema.
 */

export const DEFAULT_AI_CONFIG = {
  endpoint: "http://localhost:11434",
  model: "qwen2.5-coder:1.5b",
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
 * Sends natural language coach instructions to Ollama qwen2.5-coder:1.5b
 * and returns structured constraints & tactical briefing.
 * 
 * @param {string} userPrompt - e.g. "Put Abey on Boots & Beers, make Voyagers pacy"
 * @param {Array}  players - Selected players for the match
 * @param {Object} context - { teamAName, teamBName, targetTeamSize }
 * @param {Object} aiConfig - { endpoint, model }
 * @returns {Promise<{ constraints: Object, coachBriefing: string, raw: Object }>}
 */
export async function queryAiCoach(userPrompt, players, context = {}, aiConfig = DEFAULT_AI_CONFIG) {
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

  const systemPrompt = `You are an elite football tactical coach. Analyze the user's instructions and player pool for an 8v8 match between ${teamAName} and ${teamBName}.
Available Players:
${detailedRoster}

Rules:
1. Pinned players: assign specific players to "${teamAName}" or "${teamBName}" ONLY if the user explicitly requested it or implied it strongly.
2. Separated players: if user wants players on opposite teams (e.g. "separate strikers", "put X against Y"), pair them in separatedPairs.
3. Paired players: if user wants players together, pair them in pairedTogether.
4. If the user mentions tactical style (e.g. "counter-attack", "possession", "high pace"), pick key players fitting that profile and pin or pair them accordingly.
5. Provide a 2-sentence pre-match tactical briefing explaining your strategy and highlighting a key player matchup.

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
 * @param {Array} matches - Array of match objects from Third Half Utd API
 * @param {Object} aiConfig - { endpoint, model }
 * @returns {Promise<{ headline: string, summary: string, keyPlayers: string, tacticalTrends: string, prediction: string }>}
 */
export async function queryLeagueInsights(matches = [], aiConfig = DEFAULT_AI_CONFIG) {
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

Provide a concise, specific tactical breakdown.
Respond with pure JSON matching this exact schema:
{
  "headline": "Punchy 1-line headline summarizing the rivalry status",
  "scorersTakeaway": "1-2 sentences on top 3 goal scorers (Vinay with 6 goals, Sreekanth with 4 goals, CP with 4 goals) and their finishing impact",
  "winnersTakeaway": "1-2 sentences on top 3 consistent winners (Anoop, Mathai, Sanjay) and how their presence wins games",
  "losersTakeaway": "1-2 sentences on top 3 consistent losers (Ajith, Akash, Anup) with practical tactical advice on how to secure a win",
  "prediction": "1-sentence score prediction for the next derby"
}
Rules: Be concise, cite exact player names and goal tallies from data, and focus on practical tactics.`;

  const payload = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Analyze top scorers, consistent winners, consistent losers, and next match keys." }
    ],
    stream: false,
    format: "json",
    options: {
      temperature: 0.1,
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
          scorersTakeaway: "Vinay (6G), Sreekanth (4G), and CP (4G) have provided lethal finishing across high-scoring fixtures.",
          winnersTakeaway: "Anoop, Mathai, and Sanjay have provided consistent match-winning cohesion for their sides.",
          losersTakeaway: "Ajith, Akash, and Anup need tighter midfield compactness and quicker defensive transitions.",
          prediction: "A fierce contest expected in the upcoming clash."
        };
      }
    }

    return {
      headline: parsed.headline || "Third Half United Derby Dynamics",
      scorersTakeaway: parsed.scorersTakeaway || "Vinay (6G), Sreekanth (4G), and CP (4G) lead the scoring charts with clinical finishing.",
      winnersTakeaway: parsed.winnersTakeaway || "Anoop, Mathai, and Sanjay have maintained undefeated winning runs through strong midfield control.",
      losersTakeaway: parsed.losersTakeaway || "Ajith, Akash, and Anup must improve defensive discipline and counter-attack finishing to break the streak.",
      prediction: parsed.prediction || "Both teams will aim for tactical balance and quick transitions."
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(err.message || "Failed to generate league insights from local AI");
  }
}

/**
 * Reviews a balanced first draft and suggests tactical player swaps based on user instructions.
 * @param {string} userPrompt
 * @param {Array} teamA
 * @param {Array} teamB
 * @param {Object} context - { teamAName, teamBName, statsA, statsB, leagueSummary }
 * @param {Object} aiConfig - { endpoint, model }
 * @returns {Promise<{ reviewCommentary: string, swaps: Array<{ playerFromTeamA: string, playerFromTeamB: string, rationale: string }> }>}
 */
export async function refineDraftWithAi(userPrompt, teamA = [], teamB = [], context = {}, aiConfig = DEFAULT_AI_CONFIG) {
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
${context.leagueSummary ? `\nActive Squad Form Context:\n${context.leagueSummary}\n` : ""}
USER TACTICAL DIRECTIVE: "${userPrompt}"

YOUR MISSION:
Propose 1 or 2 player swaps between the active squad of ${teamAName} and active squad of ${teamBName} to satisfy: "${userPrompt}".
In your reviewCommentary, ONLY discuss players from the active squads above.
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
