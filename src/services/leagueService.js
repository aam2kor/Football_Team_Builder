/**
 * League Service for Third Half United League
 * Fetches match history from public API and computes head-to-head records & player stats.
 */

export const LEAGUE_API_URL = "https://thirdhalfutdleague.lovable.app/api/public/matches";
const CACHE_KEY = "ftb_league_matches_cache";

/**
 * Fetches match history from the public API with localStorage caching and offline fallback.
 * @param {boolean} forceRefresh
 * @returns {Promise<{ matches: Array, source: 'api'|'cache'|'fallback', error?: string }>}
 */
export async function fetchLeagueMatches(forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.matches) && parsed.matches.length > 0) {
          // Fetch fresh in background
          fetchFromApiAndCache().catch(e => console.warn("Background match refresh failed:", e));
          return { matches: parsed.matches, source: "cache" };
        }
      }
    } catch (e) {
      console.warn("Could not read match cache:", e);
    }
  }

  return await fetchFromApiAndCache();
}

async function fetchFromApiAndCache() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(LEAGUE_API_URL, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const matches = Array.isArray(data.matches) ? data.matches : [];

    if (matches.length > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ matches, fetchedAt: Date.now() }));
      } catch (e) {
        console.warn("Failed to write matches to localStorage:", e);
      }
    }

    return { matches, source: "api" };
  } catch (err) {
    console.warn("Failed to fetch matches from live API, trying cache fallback:", err);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.matches) {
          return { matches: parsed.matches, source: "cache", error: err.message };
        }
      }
    } catch (e) {}

    // Hardcoded fallback data from API
    const fallbackMatches = [
      {
        match_date: "2026-08-30",
        season: 2026,
        teams: [
          { team: "voyagers", members: ["Anoop", "Mathai", "Pradeep", "Prasanth", "Rajeev", "Ratheesh", "Sanjay", "Vignesh"], score: 3 },
          { team: "bootsandbeers", members: ["Aadi", "Abey", "Ajith", "Akash", "Anup", "Sreekanth", "Tom", "Vinay"], score: 2 }
        ]
      },
      {
        match_date: "2026-08-26",
        season: 2026,
        teams: [
          { team: "voyagers", members: ["Ajith", "Anup", "CP", "Mathai", "Rajeev", "Somu", "Tom", "Varun"], score: 5 },
          { team: "bootsandbeers", members: ["Abey", "Akash", "Anoop", "Pradeep", "Prasanth", "Sreekanth", "Sudhi", "Vinay"], score: 5 }
        ]
      },
      {
        match_date: "2026-08-23",
        season: 2026,
        teams: [
          { team: "voyagers", members: ["Abey", "Anoop", "CP", "Mathai", "Sanjay", "Sreekanth", "Sudhi", "Vinay"], score: 8 },
          { team: "bootsandbeers", members: ["Ajith", "Akash", "Anup", "Mithun", "Pradeep", "Prasanth", "Rajeev", "Tom"], score: 4 }
        ]
      }
    ];

    return { matches: fallbackMatches, source: "fallback", error: err.message };
  }
}

/**
 * Computes Head-to-Head statistical summary between Voyagers and Boots & Beers.
 * @param {Array} matches
 * @returns {Object}
 */
export function computeHeadToHeadSummary(matches = []) {
  let voyagersWins = 0;
  let bootsWins = 0;
  let draws = 0;
  let voyagersGoals = 0;
  let bootsGoals = 0;

  const matchHistory = [];

  matches.forEach(m => {
    const voyTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("voyager"));
    const bootsTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("boot"));

    if (voyTeam && bootsTeam) {
      const vScore = Number(voyTeam.score) || 0;
      const bScore = Number(bootsTeam.score) || 0;

      voyagersGoals += vScore;
      bootsGoals += bScore;

      let result = "draw";
      if (vScore > bScore) {
        voyagersWins++;
        result = "voyagers_win";
      } else if (bScore > vScore) {
        bootsWins++;
        result = "boots_win";
      } else {
        draws++;
      }

      matchHistory.push({
        date: m.match_date,
        season: m.season,
        voyagersScore: vScore,
        bootsScore: bScore,
        result,
        voyagersMembers: voyTeam.members || [],
        bootsMembers: bootsTeam.members || []
      });
    }
  });

  return {
    totalMatches: matchHistory.length,
    voyagersWins,
    bootsWins,
    draws,
    voyagersGoals,
    bootsGoals,
    matchHistory
  };
}

/**
 * Computes individual player win/loss records across historical matches.
 * @param {Array} matches
 * @returns {Object} { [playerName]: { matches, wins, draws, losses, winRate } }
 */
export function computePlayerLeagueStats(matches = []) {
  const stats = {};

  matches.forEach(m => {
    const voyTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("voyager"));
    const bootsTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("boot"));

    if (!voyTeam || !bootsTeam) return;

    const vScore = Number(voyTeam.score) || 0;
    const bScore = Number(bootsTeam.score) || 0;

    const recordPlayer = (name, isVoyagers) => {
      const cleanName = name.trim();
      if (!stats[cleanName]) {
        stats[cleanName] = { name: cleanName, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
      }
      stats[cleanName].matches++;

      if (isVoyagers) {
        stats[cleanName].goalsFor += vScore;
        stats[cleanName].goalsAgainst += bScore;
        if (vScore > bScore) stats[cleanName].wins++;
        else if (vScore < bScore) stats[cleanName].losses++;
        else stats[cleanName].draws++;
      } else {
        stats[cleanName].goalsFor += bScore;
        stats[cleanName].goalsAgainst += vScore;
        if (bScore > vScore) stats[cleanName].wins++;
        else if (bScore < vScore) stats[cleanName].losses++;
        else stats[cleanName].draws++;
      }
    };

    (voyTeam.members || []).forEach(name => recordPlayer(name, true));
    (bootsTeam.members || []).forEach(name => recordPlayer(name, false));
  });

  // Compute win rates
  Object.values(stats).forEach(p => {
    p.winRate = p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : 0;
  });

  return stats;
}

/**
 * Computes Top Winning Chemistries (duos with most joint wins when playing on the same side).
 * @param {Array} matches
 * @returns {Array<{ p1: string, p2: string, wins: number, team: string }>}
 */
export function computeTopWinningChemistries(matches = []) {
  const duoMap = {};

  matches.forEach(m => {
    (m.teams || []).forEach(t => {
      const otherTeam = (m.teams || []).find(ot => ot !== t);
      const isWinner = otherTeam && Number(t.score) > Number(otherTeam.score);
      if (!isWinner) return;

      const members = (t.members || []).map(n => n.trim()).sort();
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = `${members[i]} & ${members[j]}`;
          if (!duoMap[key]) {
            duoMap[key] = { label: key, p1: members[i], p2: members[j], wins: 0, lastTeam: t.team };
          }
          duoMap[key].wins++;
        }
      }
    });
  });

  return Object.values(duoMap)
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 3);
}

/**
 * Computes Top Win Rate Players.
 * @param {Array} matches
 * @param {number} topN
 * @returns {Array}
 */
export function computeTopWinRatePlayers(matches = [], topN = 3) {
  const stats = computePlayerLeagueStats(matches);
  return Object.values(stats)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.matches - a.matches;
    })
    .slice(0, topN);
}

/**
 * Computes Top Goal Scorers from matches (checks for individual scorers or fallback to offensive goals involved).
 * @param {Array} matches
 * @param {number} topN
 * @returns {Array<{ name: string, goals: number, isEstimated?: boolean }>}
 */
export function computeTopGoalScorers(matches = [], topN = 3) {
  const goalMap = {};

  matches.forEach(m => {
    (m.teams || []).forEach(t => {
      // If individual scorers exist in API
      if (Array.isArray(t.scorers)) {
        t.scorers.forEach(s => {
          const name = typeof s === "string" ? s.trim() : (s.name || "").trim();
          const count = typeof s === "object" && s.goals ? Number(s.goals) : 1;
          if (name) {
            goalMap[name] = (goalMap[name] || 0) + count;
          }
        });
      }
    });
  });

  const explicitScorers = Object.entries(goalMap).map(([name, goals]) => ({ name, goals }));
  if (explicitScorers.length > 0) {
    return explicitScorers.sort((a, b) => b.goals - a.goals).slice(0, topN);
  }

  // If individual scorers not separated in API, rank top offensive goal contributions
  const stats = computePlayerLeagueStats(matches);
  return Object.values(stats)
    .sort((a, b) => b.goalsFor - a.goalsFor)
    .slice(0, topN)
    .map(p => ({ name: p.name, goals: p.goalsFor, isEstimated: false }));
}

/**
 * Computes Top Consistent Losers (players seeking a redemption win).
 * @param {Array} matches
 * @param {number} topN
 * @returns {Array}
 */
export function computeTopConsistentLosers(matches = [], topN = 3) {
  const stats = computePlayerLeagueStats(matches);
  return Object.values(stats)
    .sort((a, b) => {
      if (b.losses !== a.losses) return b.losses - a.losses;
      if (a.wins !== b.wins) return a.wins - b.wins; // Fewer wins ranked higher
      return b.matches - a.matches;
    })
    .slice(0, topN);
}

/**
 * Computes Top Goal Impact Players (Team goals scored when playing).
 * @param {Array} matches
 * @param {number} topN
 * @returns {Array}
 */
export function computeTopGoalImpactPlayers(matches = [], topN = 3) {
  const stats = computePlayerLeagueStats(matches);
  return Object.values(stats)
    .sort((a, b) => b.goalsFor - a.goalsFor)
    .slice(0, topN);
}

/**
 * Formats a compact league summary string suitable for passing to the local LLM.
 * @param {Array} matches
 * @returns {string}
 */
export function formatLeagueSummaryForAi(matches = []) {
  const h2h = computeHeadToHeadSummary(matches);
  if (h2h.totalMatches === 0) return "";

  const recentList = h2h.matchHistory.slice(0, 3).map(m => 
    `• ${m.date}: Voyagers ${m.voyagersScore} - ${m.bootsScore} Boots & Beers`
  ).join("\n");

  return `Third Half United League History (Season 2026):
Head-to-Head: Voyagers (${h2h.voyagersWins}W - ${h2h.draws}D - ${h2h.bootsWins}L), Boots & Beers (${h2h.bootsWins}W - ${h2h.draws}D - ${h2h.voyagersWins}L)
Recent Results:
${recentList}`;
}
