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
 * Tests connection to the local Ollama instance
 * @param {string} endpoint - e.g. "http://localhost:11434"
 * @param {string} model - e.g. "qwen2.5-coder:1.5b"
 * @returns {Promise<{ ok: boolean, error?: string, models?: string[] }>}
 */
export async function testOllamaConnection(endpoint = DEFAULT_AI_CONFIG.endpoint, model = DEFAULT_AI_CONFIG.model) {
  const cleanEndpoint = (endpoint || DEFAULT_AI_CONFIG.endpoint).replace(/\/+$/, "");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${cleanEndpoint}/api/tags`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { ok: false, error: `Ollama returned status ${res.status} (${res.statusText})` };
    }

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
      errorMsg = "Cannot connect to Ollama. Make sure Ollama is running and CORS is enabled with OLLAMA_ORIGINS=\"*\"";
    }
    return { ok: false, error: errorMsg };
  }
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

  const leagueBlock = context.leagueSummary ? `\nRecent League History & Head-to-Head Record:\n${context.leagueSummary}\n` : "";

  const systemPrompt = `You are an expert Football Tactics Coach balancing two teams: Team A ("${teamAName}") and Team B ("${teamBName}").
Player Roster with Individual FIFA-style Attributes:
${detailedRoster}
${leagueBlock}
Based on the user's tactical instructions, player stats, and historical league record, output pure JSON matching this exact schema:
{
  "pinnedTeamA": [],
  "pinnedTeamB": [],
  "separatedPairs": [],
  "pairedTogether": [],
  "coachBriefing": "2-3 sentences of tactical pre-match analysis, playstyle breakdown, and marquee player duels (optionally referencing recent match history or form)"
}

Rules:
1. Only pin or separate players if explicitly or tactically requested in the prompt.
2. Use exact player names from the roster.
3. In coachBriefing, highlight key individual strengths, head-to-head battles, or historical league trends.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  const payload = {
    model: model,
    messages: messages,
    stream: false,
    format: "json",
    options: {
      temperature: 0.1,
      num_predict: 400,
      num_ctx: 1024
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for model load/CPU

  try {
    const res = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Ollama API error: HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const content = (data.message?.content || "").trim();
    
    // Robust JSON extractor that handles markdown blocks, trailing tokens, or truncated outputs
    const extractJsonObject = (rawText) => {
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
    };

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
    return `• ${m.match_date} (Season ${m.season}): Voyagers ${voyTeam?.score ?? '?'} - ${bootsTeam?.score ?? '?'} Boots & Beers
  - Voyagers Lineup: ${(voyTeam?.members || []).join(", ")}
  - Boots & Beers Lineup: ${(bootsTeam?.members || []).join(", ")}`;
  }).join("\n");

  const systemPrompt = `You are a sharp football analyst for Third Half United League.
Match History:
${matchSummary}

Provide a concise, specific tactical analysis.
Respond with pure JSON matching this exact schema:
{
  "headline": "Punchy 1-line headline summarizing the rivalry",
  "tacticalTakeaway": "2 concise bullet points explaining why Voyagers/Boots won past games and the tactical key for the next match",
  "prediction": "1-sentence score prediction"
}
Rules: Be extremely concise, specific to player names/stats, and avoid long generic paragraphs.`;

  const payload = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate concise tactical league takeaways." }
    ],
    stream: false,
    format: "json",
    options: {
      temperature: 0.1,
      num_predict: 250,
      num_ctx: 1024
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Ollama API error: HTTP ${res.status} ${res.statusText}`);
    }

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
          tacticalTakeaway: content.replace(/[{}[\]"]/g, "").trim(),
          prediction: "A close tactical battle expected in the next encounter."
        };
      }
    }

    return {
      headline: parsed.headline || "Third Half United Derby Analysis",
      tacticalTakeaway: parsed.tacticalTakeaway || "Voyagers have shown strong tactical cohesion in recent fixtures, while Boots & Beers will look to exploit counter-attacking spaces.",
      prediction: parsed.prediction || "Both teams will aim for tactical balance and quick transitions."
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(err.message || "Failed to generate league insights from local AI");
  }
}
