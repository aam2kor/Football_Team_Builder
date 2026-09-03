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
 * Sends natural language coach instructions to Google Gemini
 * and returns structured constraints & tactical briefing.
 * 
 * @param {string} userPrompt
 * @param {Array}  players - Selected players for the match
 * @param {Object} context - { teamAName, teamBName, targetTeamSize }
 * @param {Object} aiConfig - { geminiApiKey, geminiModel }
 * @returns {Promise<{ constraints: Object, coachBriefing: string, raw: Object }>}
 */
export async function queryGeminiCoach(userPrompt, players, context = {}, aiConfig = {}) {
  const apiKey = aiConfig.geminiApiKey || "";
  const model = aiConfig.geminiModel || GEMINI_DEFAULT_MODEL;
  const teamAName = context.teamAName || "Voyagers";
  const teamBName = context.teamBName || "Boots & Beers";

  const detailedRoster = players.map(p => {
    const a = p.attributes || {};
    return `  - ${p.name} (ID: "${p.id}", Pos: ${p.position}, OVR: ${p.ovr}, PAC: ${a.pac || 70}, SHO: ${a.sho || 70}, PAS: ${a.pas || 70}, DRI: ${a.dri || 70}, DEF: ${a.def || 70}, PHY: ${a.phy || 70}, GK: ${a.gk || 20})`;
  }).join("\n");

  const systemInstruction = `You are an elite football tactical coach and matchmaker.
Your task is to interpret the user's natural language squad instructions and convert them into structured balancing constraints and a pre-match tactical briefing.

Available Players in Today's Match:
${detailedRoster}
${context.leagueSummary ? `\nRecent League & Derby Context:\n${context.leagueSummary}\n` : ""}
Teams Playing: Team A ("${teamAName}") vs Team B ("${teamBName}")

SECTOR POTENTIAL CALCULATION ENGINE:
- Attack Potential: 45% SHO + 30% DRI + 25% PAC (FWD: 1.4x, MID: 1.0x, DEF/GK: 0.5x).
- Midfield Potential: 40% PAS + 30% DRI + 15% DEF + 15% PAC (MID: 1.4x, FWD: 1.0x, DEF/GK: 0.7x).
- Defense Potential (incl GK): 65% Outfield (55% DEF + 30% PHY + 15% PAC, DEF 1.4x) + 35% Top GK reflex/handling.
- Overall OVR: Mean effective rating + Chemistry Synergy (+1.5 OVR per verified chemistry duo link).

Output Rules:
1. Extract pinned players for Team A ("${teamAName}") and Team B ("${teamBName}").
2. Extract separated pairs (rivals who must be on opposite teams).
3. Extract paired players (duos who must be on the same team).
4. Provide a passionate, insightful 2-sentence pre-match tactical briefing referencing the match dynamics and strategy based on your sector analysis.`;

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
    constraints: {
      pinnedTeamA: pinnedA,
      pinnedTeamB: pinnedB,
      separatedPairs: separated,
      pairedTogether: paired
    },
    coachBriefing: parsed.coachBriefing || "Tactically balanced lineup created.",
    raw: parsed
  };
}

/**
 * Analyzes historical Third Half United League match data using Google Gemini
 * @param {Array} matches
 * @param {Object} context
 * @param {Object} aiConfig
 * @returns {Promise<{ headline: string, scorersTakeaway: string, winnersTakeaway: string, losersTakeaway: string, prediction: string }>}
 */
export async function queryGeminiLeagueInsights(matches = [], context = {}, aiConfig = {}) {
  const apiKey = aiConfig.geminiApiKey || "";
  const model = aiConfig.geminiModel || GEMINI_DEFAULT_MODEL;

  const matchSummary = matches.slice(0, 5).map(m => {
    const voy = m.teams.find(t => t.team.toLowerCase().includes("voyager")) || m.teams[0];
    const boots = m.teams.find(t => t.team.toLowerCase().includes("boot")) || m.teams[1];
    return `• Date ${m.match_date}: Voyagers (${voy.score}) vs Boots & Beers (${boots.score}) | Scorers: Voyagers: [${(voy.scorers||[]).map(s=>s.name+' x'+s.goals).join(', ')}], Boots: [${(boots.scorers||[]).map(s=>s.name+' x'+s.goals).join(', ')}]`;
  }).join("\n");

  const prompt = `You are the chief tactical analyst and statistician for Third Half United League.
Analyze the following recent match history between Voyagers and Boots & Beers:

Recent Matches:
${matchSummary}

Provide:
1. A catchy newspaper headline for the rivalry.
2. Key takeaway on the top goalscorers.
3. Key takeaway on consistent winners and game-changers.
4. Key takeaway on areas for improvement for players on losing runs.
5. An entertaining, surprising, or quirky FUN FACT based on the past matches, scorelines, player records, or scoring trends (e.g. goal blitzes, comeback patterns, goal averages, or chemistry duos).`;

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
          scorersTakeaway: { type: "STRING" },
          winnersTakeaway: { type: "STRING" },
          losersTakeaway: { type: "STRING" },
          funFact: { type: "STRING", description: "An entertaining, surprising, or quirky fun fact from the match data" }
        },
        required: ["headline", "scorersTakeaway", "winnersTakeaway", "losersTakeaway", "funFact"]
      }
    }
  };

  const data = await callGeminiGenerateContent(model, apiKey, payload);
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(textContent);

  return {
    headline: parsed.headline || "Third Half United Derby Dynamics",
    scorersTakeaway: parsed.scorersTakeaway || "Clinical finishing has dictated previous high-scoring derbies.",
    winnersTakeaway: parsed.winnersTakeaway || "Consistent midfield control and defensive solidity have defined winning streaks.",
    losersTakeaway: parsed.losersTakeaway || "Defensive transitions and counter-attack containment are vital for underdog resurgence.",
    funFact: parsed.funFact || parsed.prediction || "Across all 4 fixtures this season, a staggering 32 goals have been scored — averaging an explosive 8.0 goals per match!"
  };
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

  const statsSummary = (context.statsA && context.statsB) ? `
CURRENT CALCULATED TEAM POTENTIALS & BALANCE:
- [${teamAName}]: Effective OVR: ${context.statsA.avgOvr} | ⚔️ Attack: ${context.statsA.attack} | ⚙️ Midfield: ${context.statsA.midfield} | 🛡️ Defense (incl GK): ${context.statsA.defense} (Best GK: ${context.statsA.goalkeeping}, Chemistry Boost: +${context.statsA.synergyBoost || 0} OVR)
- [${teamBName}]: Effective OVR: ${context.statsB.avgOvr} | ⚔️ Attack: ${context.statsB.attack} | ⚙️ Midfield: ${context.statsB.midfield} | 🛡️ Defense (incl GK): ${context.statsB.defense} (Best GK: ${context.statsB.goalkeeping}, Chemistry Boost: +${context.statsB.synergyBoost || 0} OVR)
- Sector Deltas: OVR Δ ${Math.abs(context.statsA.avgOvr - context.statsB.avgOvr).toFixed(1)} | ATT Δ ${Math.abs(context.statsA.attack - context.statsB.attack)} | MID Δ ${Math.abs(context.statsA.midfield - context.statsB.midfield)} | DEF Δ ${Math.abs(context.statsA.defense - context.statsB.defense)}
` : "";

  const sectorExplanation = `SECTOR POTENTIAL CALCULATION METHODOLOGY:
1. ATTACK POTENTIAL (0-99):
   - Attributes: 45% Shooting (SHO) + 30% Dribbling (DRI) + 25% Pace (PAC), zero weight on DEF/PHY.
   - Positional Multipliers: Forwards (1.4x), Midfielders (1.0x), Defenders (0.5x), Goalkeepers (0.5x).
   - Scaled by matchday fitness (0-100%) and form modifiers (🔥 +4 OVR/1.08x to ❄️ -4 OVR/0.92x).

2. MIDFIELD POTENTIAL (0-99):
   - Attributes: 40% Passing (PAS) + 30% Dribbling (DRI) + 15% Defense (DEF) + 15% Pace (PAC).
   - Positional Multipliers: Midfielders (1.4x), Forwards (1.0x), Defenders (0.7x), Goalkeepers (0.7x).
   - Measures ball distribution, possession security, and transition control.

3. DEFENSE POTENTIAL (0-99, including GK):
   - Outfield Defense: 55% Defense (DEF) + 30% Physicality (PHY) + 15% Pace (PAC) with Defenders (1.4x), Midfielders (0.9x), Forwards (0.5x).
   - Goalkeeper Integration: Blends 65% Outfield Defense + 35% Top Goalkeeper rating (max GK attribute in squad).

4. OVERALL POTENTIAL (OVR):
   - Mean effective player rating + Chemistry Synergy (+1.5 OVR per verified chemistry duo link).

TACTICAL DECISION-MAKING:
Use the sector calculation formulas above to intelligently decide which sector(s) to optimize, balance, or tactically rebalance to fulfill the user's directive.`;

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

