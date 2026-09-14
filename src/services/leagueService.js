import { calculateTeamStats, getEffectivePlayerStats } from "../engine/balancer.js";

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
          fetchFromApiAndCache(false).catch(e => console.warn("Background match refresh failed:", e));
          return { matches: parsed.matches, source: "cache" };
        }
      }
    } catch (e) {
      console.warn("Could not read match cache:", e);
    }
  }

  return await fetchFromApiAndCache(forceRefresh);
}

async function fetchFromApiAndCache(forceRefresh = false) {
  const queryParam = forceRefresh ? "?force=true" : "";
  const endpointsToTry = [
    `/api/matches${queryParam}`,
    LEAGUE_API_URL
  ];

  let lastError = null;

  for (const endpoint of endpointsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(endpoint, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const matches = Array.isArray(data.matches) ? data.matches : [];

        if (matches.length > 0) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ matches, fetchedAt: Date.now() }));
          } catch (e) {
            console.warn("Failed to write matches to localStorage:", e);
          }
          return { matches, source: endpoint.startsWith("/api") ? "proxy" : "api" };
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  console.warn("Failed to fetch matches from live API/proxy, trying cache fallback:", lastError);
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.matches) {
        return { matches: parsed.matches, source: "cache", error: lastError?.message };
      }
    }
  } catch (e) {}

  // Hardcoded fallback data matching the live API format (4 matches up to Sept 2026)
  const fallbackMatches = [
    {
      match_date: "2026-09-02",
      season: 2026,
      teams: [
        {
          team: "voyagers",
          members: ["Abey", "Arun", "Jibin", "Mathai", "Pradeep", "Ratheesh", "Varun", "Vignesh"],
          score: 2,
          scorers: [
            { name: "Arun", goals: 1, is_own_goal: false },
            { name: "Varun", goals: 1, is_own_goal: false }
          ]
        },
        {
          team: "bootsandbeers",
          members: ["Ajith", "Akash", "Anoop", "Blesson", "Prasanth", "Rajeev", "Sreekanth", "Vinay"],
          score: 3,
          scorers: [
            { name: "Sreekanth", goals: 1, is_own_goal: false },
            { name: "Vinay", goals: 1, is_own_goal: false },
            { name: "Akash", goals: 1, is_own_goal: false }
          ]
        }
      ]
    },
    {
      match_date: "2026-08-30",
      season: 2026,
      teams: [
        {
          team: "voyagers",
          members: ["Anoop", "Mathai", "Pradeep", "Prasanth", "Rajeev", "Ratheesh", "Sanjay", "Vignesh"],
          score: 3,
          scorers: [
            { name: "Rajeev", goals: 1, is_own_goal: false },
            { name: "Sanjay", goals: 1, is_own_goal: false },
            { name: "Mathai", goals: 1, is_own_goal: false }
          ]
        },
        {
          team: "bootsandbeers",
          members: ["Aadi", "Abey", "Ajith", "Akash", "Anup", "Sreekanth", "Tom", "Vinay"],
          score: 2,
          scorers: [
            { name: "Aadi", goals: 1, is_own_goal: false },
            { name: "Sreekanth", goals: 1, is_own_goal: false }
          ]
        }
      ]
    },
      {
        match_date: "2026-08-26",
        season: 2026,
        teams: [
          {
            team: "voyagers",
            members: ["Ajith", "Anup", "CP", "Mathai", "Rajeev", "Somu", "Tom", "Varun"],
            score: 5,
            scorers: [
              { name: "CP", goals: 3, is_own_goal: false },
              { name: "Mathai", goals: 1, is_own_goal: false },
              { name: "Rajeev", goals: 1, is_own_goal: false }
            ]
          },
          {
            team: "bootsandbeers",
            members: ["Abey", "Akash", "Anoop", "Pradeep", "Prasanth", "Sreekanth", "Sudhi", "Vinay"],
            score: 5,
            scorers: [
              { name: "Vinay", goals: 3, is_own_goal: false },
              { name: "Sreekanth", goals: 2, is_own_goal: false }
            ]
          }
        ]
      },
      {
        match_date: "2026-08-23",
        season: 2026,
        teams: [
          {
            team: "voyagers",
            members: ["Abey", "Anoop", "CP", "Mathai", "Sanjay", "Sreekanth", "Sudhi", "Vinay"],
            score: 8,
            scorers: [
              { name: "Vinay", goals: 3, is_own_goal: false },
              { name: "Sanjay", goals: 2, is_own_goal: false },
              { name: "CP", goals: 1, is_own_goal: false },
              { name: "Sudhi", goals: 1, is_own_goal: false },
              { name: "Sreekanth", goals: 1, is_own_goal: false }
            ]
          },
          {
            team: "bootsandbeers",
            members: ["Ajith", "Akash", "Anup", "Mithun", "Pradeep", "Prasanth", "Rajeev", "Tom"],
            score: 4,
            scorers: [
              { name: "Mithun", goals: 2, is_own_goal: false },
              { name: "Akash", goals: 1, is_own_goal: false },
              { name: "Tom", goals: 1, is_own_goal: false }
            ]
          }
        ]
      }
    ];

    return { matches: fallbackMatches, source: "fallback", error: lastError?.message || "" };
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
        bootsMembers: bootsTeam.members || [],
        voyagersScorers: voyTeam.scorers || [],
        bootsScorers: bootsTeam.scorers || []
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
 * Computes Top Win Rate Players ranked by Bayesian Average (taking into account both win rate and matches played).
 * Bayesian Rating = (C * globalAveragePoints + playerPoints) / (C + playerMatches)
 * where points = wins + 0.5 * draws, and C is the prior confidence weight (default 2).
 *
 * @param {Array} matches
 * @param {number} topN
 * @param {number} C
 * @returns {Array<{ name: string, matches: number, wins: number, draws: number, losses: number, winRate: number, bayesianScore: number }>}
 */
export function computeTopWinRatePlayers(matches = [], topN = 3, C = 2) {
  const stats = computePlayerLeagueStats(matches);
  const playerList = Object.values(stats);
  if (playerList.length === 0) return [];

  const totalPoints = playerList.reduce((sum, p) => sum + p.wins + 0.5 * p.draws, 0);
  const totalMatches = playerList.reduce((sum, p) => sum + p.matches, 0);
  const globalAvg = totalMatches > 0 ? (totalPoints / totalMatches) : 0.5;

  playerList.forEach(p => {
    const pts = p.wins + 0.5 * p.draws;
    p.bayesianScore = (C * globalAvg + pts) / (C + p.matches);
  });

  return playerList
    .sort((a, b) => {
      if (Math.abs(b.bayesianScore - a.bayesianScore) > 0.001) {
        return b.bayesianScore - a.bayesianScore;
      }
      if (b.wins !== a.wins) return b.wins - a.wins;
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
 * Computes direct player-vs-player head-to-head rivalry records across opposing teams.
 * @param {Array} matches
 * @param {number} minMatchups
 * @returns {Array<{ p1: string, p2: string, matches: number, p1Wins: number, p2Wins: number, draws: number, p1Goals: number, p2Goals: number }>}
 */
export function computePlayerH2HRivalries(matches = [], minMatchups = 2) {
  const rivalryMap = {};

  matches.forEach(m => {
    const voyTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("voyager"));
    const bootsTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("boot"));
    if (!voyTeam || !bootsTeam) return;

    const vScore = Number(voyTeam.score) || 0;
    const bScore = Number(bootsTeam.score) || 0;
    const voyMembers = (voyTeam.members || []).map(n => n.trim());
    const bootsMembers = (bootsTeam.members || []).map(n => n.trim());

    voyMembers.forEach(p1 => {
      bootsMembers.forEach(p2 => {
        const [a, b] = p1.localeCompare(p2) < 0 ? [p1, p2] : [p2, p1];
        const key = `${a} vs ${b}`;
        if (!rivalryMap[key]) {
          rivalryMap[key] = {
            p1: a,
            p2: b,
            matches: 0,
            p1Wins: 0,
            p2Wins: 0,
            draws: 0,
            p1Goals: 0,
            p2Goals: 0
          };
        }
        rivalryMap[key].matches++;
        const p1IsVoy = (p1 === a);
        const aScore = p1IsVoy ? vScore : bScore;
        const bScoreVal = p1IsVoy ? bScore : vScore;
        rivalryMap[key].p1Goals += aScore;
        rivalryMap[key].p2Goals += bScoreVal;

        if (aScore > bScoreVal) {
          rivalryMap[key].p1Wins++;
        } else if (bScoreVal > aScore) {
          rivalryMap[key].p2Wins++;
        } else {
          rivalryMap[key].draws++;
        }
      });
    });
  });

  return Object.values(rivalryMap)
    .filter(r => r.matches >= minMatchups)
    .sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      const diffA = Math.abs(a.p1Wins - a.p2Wins);
      const diffB = Math.abs(b.p1Wins - b.p2Wins);
      return diffB - diffA;
    });
}

/**
 * Computes individual player win rates segmented by jersey/team (Voyagers vs Boots & Beers).
 * @param {Array} matches
 * @returns {Array<{ name: string, voyagers: Object, boots: Object, totalMatches: number }>}
 */
export function computePlayerJerseyWinRates(matches = []) {
  const jerseyStats = {};

  matches.forEach(m => {
    const voyTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("voyager"));
    const bootsTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("boot"));
    if (!voyTeam || !bootsTeam) return;

    const vScore = Number(voyTeam.score) || 0;
    const bScore = Number(bootsTeam.score) || 0;

    const recordJersey = (name, isVoyagers) => {
      const cleanName = name.trim();
      if (!jerseyStats[cleanName]) {
        jerseyStats[cleanName] = {
          name: cleanName,
          voyagers: { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
          boots: { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }
        };
      }
      const target = isVoyagers ? jerseyStats[cleanName].voyagers : jerseyStats[cleanName].boots;
      const myScore = isVoyagers ? vScore : bScore;
      const oppScore = isVoyagers ? bScore : vScore;

      target.matches++;
      target.goalsFor += myScore;
      target.goalsAgainst += oppScore;
      if (myScore > oppScore) target.wins++;
      else if (oppScore > myScore) target.losses++;
      else target.draws++;
    };

    (voyTeam.members || []).forEach(name => recordJersey(name, true));
    (bootsTeam.members || []).forEach(name => recordJersey(name, false));
  });

  Object.values(jerseyStats).forEach(p => {
    p.voyagers.winRate = p.voyagers.matches > 0 ? Math.round((p.voyagers.wins / p.voyagers.matches) * 100) : null;
    p.boots.winRate = p.boots.matches > 0 ? Math.round((p.boots.wins / p.boots.matches) * 100) : null;
    p.totalMatches = p.voyagers.matches + p.boots.matches;
  });

  return Object.values(jerseyStats);
}

/**
 * Computes defensive leakage and lockdown metrics per player.
 * @param {Array} matches
 * @param {number} topN
 * @returns {Array<{ name: string, matches: number, goalsAgainst: number, goalsAgainstPerMatch: number, goalDifference: number }>}
 */
export function computeDefensiveLeakageStats(matches = [], topN = 5) {
  const stats = computePlayerLeagueStats(matches);
  return Object.values(stats)
    .filter(p => p.matches >= 2)
    .map(p => ({
      name: p.name,
      matches: p.matches,
      goalsAgainst: p.goalsAgainst,
      goalsAgainstPerMatch: Number((p.goalsAgainst / p.matches).toFixed(1)),
      goalDifference: p.goalsFor - p.goalsAgainst
    }))
    .sort((a, b) => a.goalsAgainstPerMatch - b.goalsAgainstPerMatch || b.goalDifference - a.goalDifference)
    .slice(0, topN);
}

/**
 * Computes clutch goalscoring impact (goals in 1-goal margin games / draws) vs blowout goals and hat-tricks.
 * @param {Array} matches
 * @returns {{ clutchScorers: Array<{ name: string, clutchGoals: number }>, hatTricks: Array<{ name: string, goals: number, date: string, team: string, matchResult: string }> }}
 */
export function computeClutchScorers(matches = []) {
  const clutchGoalMap = {};
  const blowoutGoalMap = {};
  const hatTricks = [];

  matches.forEach(m => {
    const voyTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("voyager"));
    const bootsTeam = (m.teams || []).find(t => t.team?.toLowerCase().includes("boot"));
    if (!voyTeam || !bootsTeam) return;

    const vScore = Number(voyTeam.score) || 0;
    const bScore = Number(bootsTeam.score) || 0;
    const margin = Math.abs(vScore - bScore);
    const isClutchMatch = margin <= 1;

    [voyTeam, bootsTeam].forEach(team => {
      (team.scorers || []).forEach(s => {
        if (s.is_own_goal) return;
        const name = (typeof s === "string" ? s : s.name || "").trim();
        const goals = typeof s === "object" && s.goals ? Number(s.goals) : 1;
        if (!name) return;

        if (isClutchMatch) {
          clutchGoalMap[name] = (clutchGoalMap[name] || 0) + goals;
        } else {
          blowoutGoalMap[name] = (blowoutGoalMap[name] || 0) + goals;
        }

        if (goals >= 3) {
          hatTricks.push({
            name,
            goals,
            date: m.match_date,
            team: team.team,
            matchResult: `${vScore}-${bScore}`
          });
        }
      });
    });
  });

  const clutchScorers = Object.entries(clutchGoalMap)
    .map(([name, goals]) => ({ name, clutchGoals: goals }))
    .sort((a, b) => b.clutchGoals - a.clutchGoals);

  return { clutchScorers, hatTricks };
}

/**
 * Computes overall derby pace, goal averages, and scoring records.
 * @param {Array} matches
 * @returns {Object}
 */
export function computeDerbyTrends(matches = []) {
  const h2h = computeHeadToHeadSummary(matches);
  const totalMatches = matches.length;
  const totalGoals = (h2h.voyagersGoals || 0) + (h2h.bootsGoals || 0);
  const avgGoalsPerMatch = totalMatches > 0 ? Number((totalGoals / totalMatches).toFixed(1)) : 0;

  let highestScoringMatch = null;
  let maxGoals = -1;
  (h2h.matchHistory || []).forEach(m => {
    const sum = m.voyagersScore + m.bootsScore;
    if (sum > maxGoals) {
      maxGoals = sum;
      highestScoringMatch = m;
    }
  });

  return {
    totalMatches,
    totalGoals,
    avgGoalsPerMatch,
    voyagersWins: h2h.voyagersWins,
    bootsWins: h2h.bootsWins,
    draws: h2h.draws,
    voyagersGoals: h2h.voyagersGoals,
    bootsGoals: h2h.bootsGoals,
    highestScoringMatch
  };
}

/**
 * Formats a comprehensive historical league summary string suitable for LLM analysis.
 * Implements the Grounded Hybrid Architecture:
 * Layer 1: Match-by-Match Raw Log (lineups, scorelines, scorers)
 * Layer 2: Player Database Attribute Matrix (OVR, positions, PAC/SHO/PAS/DEF/PHY/GK)
 * Layer 3: Verified Statistical Ground-Truth Anchors (exact H2H, duos, clutch, leakage)
 *
 * @param {Array} matches
 * @param {Array|null} filterPlayers
 * @param {Array|null} playerDb
 * @returns {string}
 */
export function formatLeagueSummaryForAi(matches = [], filterPlayers = null, playerDb = null) {
  const h2h = computeHeadToHeadSummary(matches);
  if (h2h.totalMatches === 0) return "";

  const allowedNames = filterPlayers && filterPlayers.length > 0
    ? new Set(filterPlayers.map(p => (typeof p === "string" ? p : p.name).toLowerCase().trim()))
    : null;

  // Layer 1: Raw Match-by-Match Log
  const rawMatchLines = h2h.matchHistory.map(m => {
    const voyScorers = (m.voyagersScorers || [])
      .filter(s => !s.is_own_goal)
      .map(s => `${s.name}${s.goals > 1 ? ` (${s.goals}G)` : ''}`)
      .join(", ") || "none";
    const bootsScorers = (m.bootsScorers || [])
      .filter(s => !s.is_own_goal)
      .map(s => `${s.name}${s.goals > 1 ? ` (${s.goals}G)` : ''}`)
      .join(", ") || "none";

    return `• Date ${m.date}: Voyagers ${m.voyagersScore} [Scorers: ${voyScorers}] vs ${m.bootsScore} Boots & Beers [Scorers: ${bootsScorers}]
  Voyagers Lineup: ${(m.voyagersMembers || []).join(", ")}
  Boots Lineup: ${(m.bootsMembers || []).join(", ")}`;
  }).join("\n");

  // Layer 2: Player Database Attributes
  let playerAttributesText = "";
  if (Array.isArray(playerDb) && playerDb.length > 0) {
    const playerLines = playerDb
      .filter(p => !allowedNames || allowedNames.has(p.name.toLowerCase().trim()))
      .map(p => {
        const a = p.attributes || {};
        const pos = p.position || "MID";
        const secPos = p.secondaryPosition && p.secondaryPosition !== pos ? ` (Sec: ${p.secondaryPosition})` : "";
        const gkStr = a.gk ? `, GK: ${a.gk}` : "";
        return `• ${p.name}: ${pos}${secPos} | OVR: ${p.ovr || 75} [PAC: ${a.pac ?? 70}, SHO: ${a.sho ?? 70}, PAS: ${a.pas ?? 70}, DRI: ${a.dri ?? 70}, DEF: ${a.def ?? 70}, PHY: ${a.phy ?? 70}${gkStr}]`;
      });
    if (playerLines.length > 0) {
      playerAttributesText = `\n=== PLAYER DATABASE ATTRIBUTE MATRIX ===\n${playerLines.join("\n")}\n`;
    }
  }

  // Layer 3: Verified Statistical Anchors
  const trends = computeDerbyTrends(matches);
  const rivalries = computePlayerH2HRivalries(matches, 2).slice(0, 5);
  const chemistries = computeTopWinningChemistries(matches).slice(0, 4);
  const clutch = computeClutchScorers(matches);
  const defensive = computeDefensiveLeakageStats(matches, 5);
  const jerseyStats = computePlayerJerseyWinRates(matches).filter(p => p.totalMatches >= 2 && p.voyagers.matches > 0 && p.boots.matches > 0).slice(0, 5);

  const allScorers = computeTopGoalScorers(matches, 30);
  const activeScorers = (allowedNames ? allScorers.filter(s => allowedNames.has(s.name.toLowerCase().trim())) : allScorers).slice(0, 5);

  let out = `=== MATCH-BY-MATCH HISTORICAL LOG (Season 2026) ===\n${rawMatchLines}\n`;
  if (playerAttributesText) {
    out += playerAttributesText;
  }
  out += `\n=== VERIFIED STATISTICAL GROUND-TRUTH (CITE THESE EXACT FIGURES) ===\n`;
  out += `• Derby Record: Voyagers ${h2h.voyagersWins}W - ${h2h.draws}D - ${h2h.bootsWins}L Boots & Beers (${trends.totalGoals} total goals, ${trends.avgGoalsPerMatch} goals/match avg).\n`;
  out += `• Top Scorers: ${activeScorers.map(s => `${s.name} (${s.goals}G)`).join(", ")}\n`;
  out += `• Verified Hat-Tricks: ${clutch.hatTricks.map(ht => `${ht.name} (${ht.goals}G on ${ht.date})`).join(", ") || 'None'}\n`;
  out += `• Clutch Scorers (<=1 goal margins/draws): ${clutch.clutchScorers.slice(0, 4).map(c => `${c.name} (${c.clutchGoals} clutch goals)`).join(", ")}\n`;
  out += `• Top Winning Duos: ${chemistries.map(c => `${c.p1} & ${c.p2} (${c.wins} wins)`).join(", ")}\n`;
  out += `• Top Player H2H Rivalries: ${rivalries.map(r => `${r.p1} vs ${r.p2} (${r.matches} matches: ${r.p1} ${r.p1Wins}W - ${r.draws}D - ${r.p2Wins}W ${r.p2})`).join("; ")}\n`;
  out += `• Defensive Leakage (Goals conceded/match): ${defensive.map(d => `${d.name} (${d.goalsAgainstPerMatch} GA/match)`).join(", ")}\n`;
  if (jerseyStats.length > 0) {
    out += `• Jersey Win Rates: ${jerseyStats.map(j => `${j.name} (Voyagers: ${j.voyagers.winRate}% vs Boots: ${j.boots.winRate}%)`).join(", ")}\n`;
  }

  return out;
}

/**
 * Builds structured performance and sector potential data for all players in the database
 * to be analyzed by AI Scout.
 * @param {Array} players - list of players from db.getAll()
 * @param {Array} matches - list of match records from fetchLeagueMatches()
 * @param {Object} sectorWeights - active sector weights
 * @returns {Object} { playerProfiles, topDuoPerformances, leagueOverview }
 */
export function buildScoutAnalysisPayload(players = [], matches = [], sectorWeights = null) {
  const playerStats = computePlayerLeagueStats(matches);
  const topScorers = computeTopGoalScorers(matches, 50);
  const scorerMap = {};
  topScorers.forEach(s => scorerMap[s.name.toLowerCase().trim()] = s.goals);

  // Compute all teammate duos and their combined win records
  const duoMap = {};
  matches.forEach(m => {
    (m.teams || []).forEach(t => {
      const otherTeam = (m.teams || []).find(ot => ot !== t);
      const isWinner = otherTeam && Number(t.score) > Number(otherTeam.score);
      const isDraw = otherTeam && Number(t.score) === Number(otherTeam.score);

      const members = (t.members || []).map(n => n.trim()).sort();
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = `${members[i]}|||${members[j]}`;
          if (!duoMap[key]) {
            duoMap[key] = { p1Name: members[i], p2Name: members[j], matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0 };
          }
          duoMap[key].matches++;
          duoMap[key].goalsFor += Number(t.score) || 0;
          if (isWinner) duoMap[key].wins++;
          else if (isDraw) duoMap[key].draws++;
          else duoMap[key].losses++;
        }
      }
    });
  });

  const duoList = Object.values(duoMap).map(d => ({
    ...d,
    winRate: d.matches > 0 ? Math.round((d.wins / d.matches) * 100) : 0
  })).filter(d => d.matches >= 2); // At least 2 matches together

  // Map each player to their historical performance + current attributes & positions
  const playerProfiles = players.map(p => {
    const cleanName = p.name.trim().toLowerCase();
    const stats = Object.entries(playerStats).find(([k]) => k.toLowerCase() === cleanName)?.[1] || {
      matches: 0, wins: 0, draws: 0, losses: 0, winRate: 0, goalsFor: 0, goalsAgainst: 0
    };
    const goals = scorerMap[cleanName] || 0;
    const a = p.attributes || { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70, gk: 20 };

    return {
      id: p.id,
      name: p.name,
      position: p.position,
      secondaryPosition: p.secondaryPosition || p.position,
      ovr: p.ovr || 75,
      attributes: { ...a },
      chemistryPartners: p.chemistryPartners || [],
      leagueStats: {
        matches: stats.matches,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        winRate: stats.winRate,
        goals: goals,
        goalDifference: stats.goalsFor - stats.goalsAgainst
      }
    };
  });

  return {
    playerProfiles,
    duoList: duoList.sort((a, b) => b.winRate - a.winRate || b.matches - a.matches),
    h2h: computeHeadToHeadSummary(matches)
  };
}

/**
 * AI Matchup Auditor & Scoreline Predictor
 * Evaluates drafted Team A vs Team B using the 3-pillar model:
 * 1. Historical goal production rate (xG)
 * 2. Cross-sector mismatch (ATT_A vs DEF_B and ATT_B vs DEF_A)
 * 3. Pairwise Head-to-Head player clashes
 *
 * @param {Array} teamA - List of players on Team A
 * @param {Array} teamB - List of players on Team B
 * @param {Array} matches - League match records
 * @param {Object} [sectorWeights] - Sector weights (optional)
 * @param {Object} [matchdaySettings] - Matchday settings (fitness/form)
 * @returns {Object|null} Full audit report with predicted scoreline, xG, parity index, and micro-swap recommendation
 */
export function auditTeamMatchup(teamA = [], teamB = [], matches = [], sectorWeights = null, matchdaySettings = {}) {
  if (!teamA || !teamB || teamA.length === 0 || teamB.length === 0) return null;

  // 1. League Baseline Pace
  const trends = computeDerbyTrends(matches);
  const totalMatches = trends.totalMatches || 1;
  const leagueTotalGoals = trends.totalGoals || 32;
  const baselineTeamPace = leagueTotalGoals / (2 * totalMatches); // e.g. 4.0 goals / team / match

  // 2. Extract Player Historical Stats & Goalscoring rates
  const playerStats = computePlayerLeagueStats(matches);
  const topScorers = computeTopGoalScorers(matches, 50);
  const scorerMap = {};
  topScorers.forEach(s => scorerMap[s.name.toLowerCase().trim()] = s.goals);

  // Helper to extract stats for a player
  const getPlayerHistory = (p) => {
    const clean = p.name.trim().toLowerCase();
    const stat = Object.entries(playerStats).find(([k]) => k.toLowerCase() === clean)?.[1] || {
      matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0
    };
    const goals = scorerMap[clean] || 0;
    const gPerMatch = stat.matches > 0 ? (goals / stat.matches) : (p.position === 'FWD' ? 0.7 : p.position === 'MID' ? 0.4 : 0.1);
    const gaPerMatch = stat.matches > 0 ? (stat.goalsAgainst / stat.matches) : 4.0;
    return { ...stat, goals, gPerMatch, gaPerMatch };
  };

  const histA = teamA.map(p => ({ player: p, ...getPlayerHistory(p) }));
  const histB = teamB.map(p => ({ player: p, ...getPlayerHistory(p) }));

  const totalGoalsA = histA.reduce((sum, h) => sum + h.goals, 0);
  const totalGoalsB = histB.reduce((sum, h) => sum + h.goals, 0);

  const squadOffensiveThreatA = histA.reduce((sum, h) => sum + h.gPerMatch, 0);
  const squadOffensiveThreatB = histB.reduce((sum, h) => sum + h.gPerMatch, 0);

  const squadDefensiveLeakageA = histA.reduce((sum, h) => sum + h.gaPerMatch, 0) / histA.length;
  const squadDefensiveLeakageB = histB.reduce((sum, h) => sum + h.gaPerMatch, 0) / histB.length;

  // 3. Sector Potential & Attribute Cross-Factor
  const statsA = calculateTeamStats(teamA, matchdaySettings, sectorWeights);
  const statsB = calculateTeamStats(teamB, matchdaySettings, sectorWeights);

  const attA = statsA.attack || 75;
  const defA = statsA.defense || 75;
  const attB = statsB.attack || 75;
  const defB = statsB.defense || 75;

  const crossRatioA = Math.max(0.6, Math.min(1.5, attA / (defB || 75)));
  const crossRatioB = Math.max(0.6, Math.min(1.5, attB / (defA || 75)));

  // 4. Expected Goals (xG) Calculation
  const baselineSquadOffense = 4.0; // standard 8v8 expected squad finishing rate
  const normThreatA = squadOffensiveThreatA / baselineSquadOffense;
  const normThreatB = squadOffensiveThreatB / baselineSquadOffense;
  const normLeakageA = squadDefensiveLeakageA / 4.0;
  const normLeakageB = squadDefensiveLeakageB / 4.0;

  // xG Formula: combines historical finishing against opposing leakage (55%) with attribute cross-delta (45%)
  let xGA = baselineTeamPace * (0.55 * normThreatA * normLeakageB + 0.45 * crossRatioA);
  let xGB = baselineTeamPace * (0.55 * normThreatB * normLeakageA + 0.45 * crossRatioB);

  // Clamp within reasonable recreational football bounds (1.5 to 7.5 goals)
  xGA = Math.max(1.5, Math.min(7.5, Number(xGA.toFixed(1))));
  xGB = Math.max(1.5, Math.min(7.5, Number(xGB.toFixed(1))));

  const scoreA = Math.round(xGA);
  const scoreB = Math.round(xGB);
  const goalDelta = Number((xGA - xGB).toFixed(1));

  // 5. Parity Index (0 - 100%)
  const ovrDelta = Math.abs((statsA.overall || 75) - (statsB.overall || 75));
  const sectorDelta = Math.abs(attA - attB) + Math.abs(defA - defB);
  const parityIndex = Math.max(0, Math.min(100, Math.round(100 - (Math.abs(goalDelta) * 28 + ovrDelta * 2 + sectorDelta * 1.5))));

  let status = "golden_balance";
  let statusLabel = "High Parity (Golden Balance)";
  let statusColor = "emerald";
  if (parityIndex >= 88) {
    status = "golden_balance";
    statusLabel = "High Parity (Golden Balance)";
    statusColor = "emerald";
  } else if (parityIndex >= 72) {
    status = "competitive";
    statusLabel = "Competitive Matchup (Slight Edge)";
    statusColor = "amber";
  } else {
    status = "blowout_risk";
    statusLabel = "Asymmetric Matchup (Blowout Risk)";
    statusColor = "rose";
  }

  // 6. Tactical Audit Bullet Points
  const tacticalObservations = [];
  
  // Firepower comparison
  const topFinisherA = [...histA].sort((a, b) => b.goals - a.goals)[0];
  const topFinisherB = [...histB].sort((a, b) => b.goals - a.goals)[0];
  if (topFinisherA && topFinisherB) {
    const shoA = topFinisherA.player.effectiveAttributes?.sho ?? topFinisherA.player.attributes?.sho ?? 75;
    const shoB = topFinisherB.player.effectiveAttributes?.sho ?? topFinisherB.player.attributes?.sho ?? 75;
    tacticalObservations.push({
      icon: "⚽",
      title: "Finisher Showdown",
      text: `${topFinisherA.player.name} (${topFinisherA.goals}G, ${shoA} SHO) vs ${topFinisherB.player.name} (${topFinisherB.goals}G, ${shoB} SHO)`
    });
  }

  // Defensive Resistance
  tacticalObservations.push({
    icon: "🛡️",
    title: "Defensive Resistance",
    text: `Team A Defense (${defA} DEF, ${squadDefensiveLeakageA.toFixed(1)} GA/M) vs Team B Attack (${attB} ATT) • Team B Defense (${defB} DEF, ${squadDefensiveLeakageB.toFixed(1)} GA/M) vs Team A Attack (${attA} ATT)`
  });

  // Goal Threat Share
  const totalThreat = (squadOffensiveThreatA + squadOffensiveThreatB) || 1;
  const threatShareA = Math.round((squadOffensiveThreatA / totalThreat) * 100);
  const threatShareB = 100 - threatShareA;
  tacticalObservations.push({
    icon: "⚖️",
    title: "Historical Firepower Share",
    text: `Team A holds ${threatShareA}% (${totalGoalsA} historical goals) vs Team B with ${threatShareB}% (${totalGoalsB} historical goals)`
  });

  // 7. Micro-Swap Recommendation (if blowout risk or noticeable imbalance)
  let suggestedSwap = null;
  if (parityIndex < 88 || Math.abs(goalDelta) > 0.8) {
    let bestSwap = null;
    let minDiff = Math.abs(goalDelta);

    for (const pA of teamA) {
      for (const pB of teamB) {
        // Test swapped rosters
        const swappedA = teamA.map(p => p.id === pA.id ? pB : p);
        const swappedB = teamB.map(p => p.id === pB.id ? pA : p);

        // Fast evaluate
        const sHistA = swappedA.map(p => ({ player: p, ...getPlayerHistory(p) }));
        const sHistB = swappedB.map(p => ({ player: p, ...getPlayerHistory(p) }));
        const sThreatA = sHistA.reduce((sum, h) => sum + h.gPerMatch, 0);
        const sThreatB = sHistB.reduce((sum, h) => sum + h.gPerMatch, 0);
        const sStatsA = calculateTeamStats(swappedA, matchdaySettings, sectorWeights);
        const sStatsB = calculateTeamStats(swappedB, matchdaySettings, sectorWeights);

        const sXGA = baselineTeamPace * (0.55 * (sThreatA / baselineSquadOffense) + 0.45 * (sStatsA.attack / (sStatsB.defense || 75)));
        const sXGB = baselineTeamPace * (0.55 * (sThreatB / baselineSquadOffense) + 0.45 * (sStatsB.attack / (sStatsA.defense || 75)));
        const diff = Math.abs(sXGA - sXGB);

        // Positional compatibility bonus
        const posMatch = (pA.position === pB.position) ? 0.2 : 0;
        const scoreVal = diff - posMatch;

        if (scoreVal < minDiff) {
          minDiff = scoreVal;
          const newParity = Math.max(0, Math.min(100, Math.round(100 - (diff * 28 + Math.abs(sStatsA.overall - sStatsB.overall) * 2))));
          bestSwap = {
            playerA: pA,
            playerB: pB,
            newXGA: Number(sXGA.toFixed(1)),
            newXGB: Number(sXGB.toFixed(1)),
            newScoreline: `${Math.round(sXGA)} - ${Math.round(sXGB)}`,
            newParityIndex: newParity,
            rationale: `Swapping ${pA.name} (${pA.position}) for ${pB.name} (${pB.position}) shifts predicted score to ${Math.round(sXGA)} - ${Math.round(sXGB)} (${newParity}% Parity)`
          };
        }
      }
    }
    suggestedSwap = bestSwap;
  }

  return {
    xGA,
    xGB,
    scoreA,
    scoreB,
    predictedScoreline: `${scoreA} - ${scoreB}`,
    goalDelta,
    parityIndex,
    status,
    statusLabel,
    statusColor,
    threatShareA,
    threatShareB,
    totalGoalsA,
    totalGoalsB,
    tacticalObservations,
    suggestedSwap,
    statsA,
    statsB
  };
}
