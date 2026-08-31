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

  // Compact roster string to minimize token generation latency
  const compactRoster = players.map(p => `${p.name} [${p.position}]`).join(", ");

  const systemPrompt = `You are a football tactics coach balancing two teams: "${teamAName}" and "${teamBName}".
Players available: ${compactRoster}

Respond with pure JSON matching this exact schema:
{
  "pinnedTeamA": [],
  "pinnedTeamB": [],
  "separatedPairs": [],
  "pairedTogether": [],
  "coachBriefing": "2 sentences of tactical pre-match commentary and matchup preview"
}
Rules: Only pin or separate players if explicitly mentioned in the prompt. Use exact player names from the list.`;

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
      msg = "AI Coach request timed out after 15s. Is Ollama running?";
    }
    throw new Error(msg);
  }
}
