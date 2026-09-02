import { PlayerDatabase, calculateOvr } from "./storage/db.js";
import { buildBalancedTeams, calculateTeamStats, FORM_MODIFIERS, getEffectivePlayerStats, DEFAULT_SECTOR_WEIGHTS, cloneSectorWeights, getPlayerMetricScore } from "./engine/balancer.js";
import { FORMATIONS, getFormationsForSize, assignPlayersToFormation } from "./engine/formations.js";
import { loadAiConfig, saveAiConfig, testOllamaConnection, queryAiCoach, queryLeagueInsights, refineDraftWithAi } from "./ai/ollamaClient.js";
import { fetchLeagueMatches, computeHeadToHeadSummary, formatLeagueSummaryForAi, computeTopWinRatePlayers, computeTopWinningChemistries, computeTopGoalScorers, computeTopConsistentLosers } from "./services/leagueService.js";

// Initialize Database instance
const db = new PlayerDatabase();

// ============================================================
// Sector Weights — Load from localStorage or use defaults
// ============================================================
function loadSectorWeights() {
  try {
    const saved = localStorage.getItem("ftb_sector_weights");
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return cloneSectorWeights(DEFAULT_SECTOR_WEIGHTS);
}

function saveSectorWeights(weights) {
  try {
    localStorage.setItem("ftb_sector_weights", JSON.stringify(weights));
  } catch (e) { /* ignore */ }
}

// Application State
const state = {
  currentTab: "generator",
  targetTeamSize: 8,
  gkMode: "fixed",
  selectedPlayerIds: new Set(),
  matchdaySettings: {},
  filterPosition: "ALL",
  searchQuery: "",
  sortBy: "ovr_desc",

  // Generator State
  generatedSolutions: [],
  currentSolutionIndex: 0,
  activeTeamA: [],
  activeTeamB: [],
  formationTeamA: "1-3-3-1",
  formationTeamB: "1-3-3-1",
  teamAName: "Voyagers",
  teamBName: "Boots & Beers",
  balanceMode: "balanced",
  teamAColor: "blue",   // jersey colour: blue | red | yellow | black | white
  teamBColor: "red",
  assignedSlotsA: [],
  assignedSlotsB: [],

  // Configurable Sector Weights
  sectorWeights: loadSectorWeights(),

  // AI Coach State
  aiConfig: loadAiConfig(),
  aiCoachBriefing: null,
  aiConstraints: null,
  aiRefineSwaps: [],
  isAiLoading: false,

  // Live League History State
  leagueMatches: [],
  leagueH2H: null,
  leagueSummaryText: "",
  isLeagueLoading: false,

  // Swap State
  selectedSwapPlayerId: null,
  selectedSwapTeam: null,

  // Modal State
  editingPlayerId: null,

  // Stat Breakdown Accordion State
  expandedMetrics: new Set()
};


// ============================================================
// Initialization & Event Listeners
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // Pre-select first 16 players on initial load for instant match builder experience
  const allPlayers = db.getAll();
  allPlayers.forEach(p => {
    state.matchdaySettings[p.id] = { fitness: 100, form: "neutral" };
  });

  if (allPlayers.length >= 16) {
    allPlayers.slice(0, 16).forEach(p => state.selectedPlayerIds.add(p.id));
  } else {
    allPlayers.forEach(p => state.selectedPlayerIds.add(p.id));
  }

  setupNavigation();
  setupGeneratorEvents();
  setupLeagueEvents();
  setupAiEvents();
  setupRosterEvents();
  setupBackupEvents();
  setupPlayerModalEvents();

  // Initial render
  renderApp();
  updateColorSwatchActiveState("A", state.teamAColor);
  updateColorSwatchActiveState("B", state.teamBColor);
});

// ============================================================
// Navigation Tabs
// ============================================================
function setupNavigation() {
  document.querySelectorAll("[data-tab-target]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.currentTab = btn.dataset.tabTarget;
      updateActiveTabUI();
    });
  });
}

function updateActiveTabUI() {
  document.querySelectorAll("[data-tab-target]").forEach(btn => {
    const isTarget = btn.dataset.tabTarget === state.currentTab;
    if (isTarget) {
      btn.className = "flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-all";
    } else {
      btn.className = "flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg text-slate-300 hover:bg-slate-800/80 transition-all";
    }
  });

  document.querySelectorAll(".tab-view").forEach(view => {
    view.classList.toggle("hidden", view.id !== `view-${state.currentTab}`);
  });

  if (state.currentTab === "generator") {
    renderGeneratorView();
  } else if (state.currentTab === "roster") {
    renderRosterView();
  }
}

// ============================================================
// Generator Tab Logic
// ============================================================
function setupGeneratorEvents() {
  // Target Team Size change (5v5 to 11v11)
  const sizeSelect = document.getElementById("team-size-select");
  if (sizeSelect) {
    sizeSelect.addEventListener("change", (e) => {
      state.targetTeamSize = parseInt(e.target.value, 10);
      updateFormationOptions();
      renderGeneratorView();
    });
  }

  // GK Mode Selector (Fixed vs Rotating)
  const gkSelect = document.getElementById("gk-mode-select");
  if (gkSelect) {
    gkSelect.addEventListener("change", (e) => {
      state.gkMode = e.target.value;
      if (state.gkMode === "rotating") {
        showToast("🔄 Rotating GK Mode: Players will take turns in goal. Balancing considers overall outfield depth and team defensive floor.", "info");
      } else {
        showToast("🧤 Fixed GK Mode: Dedicated GKs will be split equally between teams.", "info");
      }
    });
  }

  // Quick Select Actions
  document.getElementById("btn-quick-select-target")?.addEventListener("click", () => {
    const required = state.targetTeamSize * 2;
    const all = db.getAll();
    state.selectedPlayerIds.clear();
    
    if (state.gkMode === "fixed") {
      const gks = all.filter(p => p.position === "GK");
      gks.slice(0, 2).forEach(p => state.selectedPlayerIds.add(p.id));
    }
    
    const remainingNeeded = required - state.selectedPlayerIds.size;
    const pool = all.filter(p => !state.selectedPlayerIds.has(p.id)).sort((a, b) => b.ovr - a.ovr);
    for (const p of pool) {
      if (state.selectedPlayerIds.size >= required) break;
      state.selectedPlayerIds.add(p.id);
    }
    renderGeneratorView();
  });

  document.getElementById("btn-clear-selection")?.addEventListener("click", () => {
    state.selectedPlayerIds.clear();
    renderGeneratorView();
  });

  document.getElementById("btn-random-select")?.addEventListener("click", () => {
    const required = state.targetTeamSize * 2;
    const all = db.getAll().sort(() => Math.random() - 0.5);
    state.selectedPlayerIds.clear();
    all.slice(0, required).forEach(p => state.selectedPlayerIds.add(p.id));
    renderGeneratorView();
  });

  // Generator Mode
  document.getElementById("balance-mode-select")?.addEventListener("change", (e) => {
    state.balanceMode = e.target.value;
  });

  // Build Teams Button
  document.getElementById("btn-build-teams")?.addEventListener("click", () => {
    handleBuildTeams();
  });

  // Formations Change
  document.getElementById("formation-team-a")?.addEventListener("change", (e) => {
    state.formationTeamA = e.target.value;
    const sizeKey = `${state.targetTeamSize}v${state.targetTeamSize}`;
    const formations = getFormationsForSize(sizeKey);
    const formA = formations[state.formationTeamA] || formations[Object.keys(formations)[0]];
    state.assignedSlotsA = assignPlayersToFormation(state.activeTeamA, formA);
    syncMatchdayPositions();
    renderPitch();
    renderTeamComparison();
  });

  document.getElementById("formation-team-b")?.addEventListener("change", (e) => {
    state.formationTeamB = e.target.value;
    const sizeKey = `${state.targetTeamSize}v${state.targetTeamSize}`;
    const formations = getFormationsForSize(sizeKey);
    const formB = formations[state.formationTeamB] || formations[Object.keys(formations)[0]];
    state.assignedSlotsB = assignPlayersToFormation(state.activeTeamB, formB);
    syncMatchdayPositions();
    renderPitch();
    renderTeamComparison();
  });

  // Team Names
  document.getElementById("team-a-name-input")?.addEventListener("input", (e) => {
    state.teamAName = e.target.value || "Voyagers";
    document.querySelectorAll(".team-a-name-label").forEach(el => el.textContent = state.teamAName);
  });

  document.getElementById("team-b-name-input")?.addEventListener("input", (e) => {
    state.teamBName = e.target.value || "Boots & Beers";
    document.querySelectorAll(".team-b-name-label").forEach(el => el.textContent = state.teamBName);
  });

  // Share Actions
  document.getElementById("btn-copy-whatsapp")?.addEventListener("click", copyWhatsAppLineup);
  document.getElementById("btn-export-image")?.addEventListener("click", exportPitchAsImage);
  document.getElementById("btn-coin-toss")?.addEventListener("click", triggerCoinToss);
  document.getElementById("btn-random-captains")?.addEventListener("click", assignRandomCaptains);

  // ── Jersey Colour Swatches ────────────────────────────────────
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-team-color-target]");
    if (!btn) return;
    const teamTarget = btn.dataset.teamColorTarget; // "A" or "B"
    const color      = btn.dataset.color;           // blue|red|yellow|black|white

    if (teamTarget === "A") {
      state.teamAColor = color;
      updateColorSwatchActiveState("A", color);
    } else {
      state.teamBColor = color;
      updateColorSwatchActiveState("B", color);
    }
    renderPitch();
  });

  // ── Sector Weights Panel ──────────────────────────────────────
  initSectorWeightsPanel();
}

// ============================================================
// Third Half United League Service & Live History
// ============================================================
function setupLeagueEvents() {
  loadLeagueData(false);

  // Sync / Refresh API button
  document.getElementById("btn-refresh-league")?.addEventListener("click", () => {
    loadLeagueData(true);
  });

  // Open / Close AI League Insights Modal
  document.getElementById("btn-open-league-insights")?.addEventListener("click", () => {
    openLeagueInsightsModal();
  });
  document.getElementById("btn-close-league-insights")?.addEventListener("click", () => {
    document.getElementById("modal-league-insights")?.classList.add("hidden");
  });
  document.getElementById("btn-refresh-league-insights")?.addEventListener("click", () => {
    handleGenerateLeagueInsights();
  });
}

async function loadLeagueData(forceRefresh = false) {
  const refreshIcon = document.getElementById("league-refresh-icon");
  if (refreshIcon) refreshIcon.classList.add("animate-spin");

  try {
    const res = await fetchLeagueMatches(forceRefresh);
    state.leagueMatches = res.matches || [];
    state.leagueH2H = computeHeadToHeadSummary(state.leagueMatches);
    state.leagueSummaryText = formatLeagueSummaryForAi(state.leagueMatches);

    renderLeagueHistoryUI();
    if (forceRefresh) {
      showToast(`🔄 Synced ${state.leagueMatches.length} matches from Third Half Utd API!`, "success");
    }
  } catch (err) {
    console.warn("Failed to load league data:", err);
    if (forceRefresh) {
      showToast("Could not sync with live league API. Using cached match data.", "warning");
    }
  } finally {
    if (refreshIcon) refreshIcon.classList.remove("animate-spin");
  }
}

function renderLeagueHistoryUI() {
  const h2h = state.leagueH2H;
  if (!h2h) return;

  const voyWinsEl = document.getElementById("h2h-voyagers-wins");
  const drawsEl = document.getElementById("h2h-draws-count");
  const bootsWinsEl = document.getElementById("h2h-boots-wins");
  const listEl = document.getElementById("league-recent-matches-list");

  if (voyWinsEl) voyWinsEl.textContent = `${h2h.voyagersWins}W (${h2h.voyagersGoals}G)`;
  if (drawsEl) drawsEl.textContent = `${h2h.draws}D`;
  if (bootsWinsEl) bootsWinsEl.textContent = `${h2h.bootsWins}W (${h2h.bootsGoals}G)`;

  if (listEl) {
    if (h2h.matchHistory.length === 0) {
      listEl.innerHTML = `<span class="text-[11px] text-slate-500">No match records found.</span>`;
      return;
    }

    listEl.innerHTML = h2h.matchHistory.map(m => {
      let badgeBg = "bg-slate-800 text-slate-300 border-slate-700";
      if (m.result === "voyagers_win") badgeBg = "bg-blue-950/70 text-blue-300 border-blue-500/40";
      else if (m.result === "boots_win") badgeBg = "bg-red-950/70 text-red-300 border-red-500/40";
      else badgeBg = "bg-amber-950/70 text-amber-300 border-amber-500/40";

      return `
        <div class="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap ${badgeBg}" title="${m.date} - Voyagers: ${m.voyagersMembers.join(', ')} vs Boots: ${m.bootsMembers.join(', ')}">
          <span class="text-[10px] text-slate-400 font-mono">${m.date.slice(5)}</span>
          <span class="font-black text-blue-400">V ${m.voyagersScore}</span>
          <span class="text-slate-500 font-mono">:</span>
          <span class="font-black text-red-400">${m.bootsScore} B</span>
        </div>
      `;
    }).join("");
  }
}

async function openLeagueInsightsModal() {
  const modal = document.getElementById("modal-league-insights");
  if (!modal) return;
  modal.classList.remove("hidden");

  const contentEl = document.getElementById("league-insights-content");
  if (!contentEl || contentEl.innerHTML.trim() === "") {
    handleGenerateLeagueInsights();
  }
}

async function handleGenerateLeagueInsights() {
  const loadingEl = document.getElementById("league-insights-loading");
  const contentEl = document.getElementById("league-insights-content");
  const refreshBtn = document.getElementById("btn-refresh-league-insights");

  if (loadingEl) loadingEl.classList.remove("hidden");
  if (contentEl) contentEl.classList.add("hidden");
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const topScorers = computeTopGoalScorers(state.leagueMatches, 3);
    const topWinners = computeTopWinRatePlayers(state.leagueMatches, 3);
    const topLosers = computeTopConsistentLosers(state.leagueMatches, 3);
    const topChemistries = computeTopWinningChemistries(state.leagueMatches);

    // Call local LLM for concise tactical takeaway
    const insights = await queryLeagueInsights(state.leagueMatches, state.aiConfig);

    if (contentEl) {
      contentEl.innerHTML = `
        <!-- 1. Pundit Headline -->
        <div class="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/80 to-purple-950/60 border border-indigo-500/40 space-y-1">
          <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">🎙️ League Headline</span>
          <h4 class="text-sm font-black text-white">${insights.headline}</h4>
        </div>

        <!-- 2. Specific Stat Leaderboards (3-Column Grid) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          <!-- Top 3 Goal Scorers -->
          <div class="p-3 rounded-xl bg-slate-900/90 border border-blue-500/30 space-y-2">
            <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span class="text-[11px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1">
                <span>⚽</span>
                <span>Top 3 Goal Scorers</span>
              </span>
            </div>
            <div class="space-y-1.5">
              ${topScorers.map((p, idx) => `
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-bold text-slate-200">#${idx + 1} ${p.name}</span>
                  <span class="font-mono text-blue-300 font-bold">${p.goals} Goals</span>
                </div>
              `).join("") || '<span class="text-slate-500">No data</span>'}
            </div>
          </div>

          <!-- Top 3 Consistent Winners -->
          <div class="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-2">
            <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span class="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <span>🏆</span>
                <span>Top 3 Winners</span>
              </span>
            </div>
            <div class="space-y-1.5">
              ${topWinners.map((p, idx) => `
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-bold text-slate-200">#${idx + 1} ${p.name}</span>
                  <span class="font-mono text-emerald-300 font-bold">${p.wins}W <span class="text-[10px] text-slate-500">(${p.draws}D-${p.losses}L)</span></span>
                </div>
              `).join("") || '<span class="text-slate-500">No data</span>'}
            </div>
          </div>

          <!-- Top 3 Consistent Losers -->
          <div class="p-3 rounded-xl bg-slate-900/90 border border-red-500/30 space-y-2">
            <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span class="text-[11px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1">
                <span>⚠️</span>
                <span>Top 3 Underdogs</span>
              </span>
            </div>
            <div class="space-y-1.5">
              ${topLosers.map((p, idx) => `
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-bold text-slate-200">#${idx + 1} ${p.name}</span>
                  <span class="font-mono text-red-300 font-bold">${p.losses}L <span class="text-[10px] text-slate-500">(${p.draws}D-${p.wins}W)</span></span>
                </div>
              `).join("") || '<span class="text-slate-500">No data</span>'}
            </div>
          </div>

        </div>

        <!-- 3. Best Winning Chemistries -->
        <div class="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2">
          <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span class="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span>🤝</span>
              <span>Best Winning Chemistries (Top Duos)</span>
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            ${topChemistries.map((duo, idx) => `
              <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px]">
                <span class="font-bold text-slate-200 truncate pr-1">#${idx + 1} ${duo.p1} &amp; ${duo.p2}</span>
                <span class="font-mono text-amber-300 font-bold whitespace-nowrap">${duo.wins} Wins</span>
              </div>
            `).join("") || '<span class="text-slate-500">No data</span>'}
          </div>
        </div>

        <!-- 4. AI Tactical Takeaways (Top Scorers, Winners & Losers) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-slate-900 border border-blue-500/20 space-y-1">
            <span class="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <span>⚽</span>
              <span>Top Scorers Impact</span>
            </span>
            <p class="text-xs leading-relaxed text-slate-200 font-medium">${insights.scorersTakeaway}</p>
          </div>

          <div class="p-3 rounded-xl bg-slate-900 border border-emerald-500/20 space-y-1">
            <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <span>🌟</span>
              <span>Why Top Winners Dominate</span>
            </span>
            <p class="text-xs leading-relaxed text-slate-200 font-medium">${insights.winnersTakeaway}</p>
          </div>

          <div class="p-3 rounded-xl bg-slate-900 border border-red-500/20 space-y-1">
            <span class="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
              <span>🛡️</span>
              <span>Advice for Underdogs</span>
            </span>
            <p class="text-xs leading-relaxed text-slate-200 font-medium">${insights.losersTakeaway}</p>
          </div>
        </div>

        <!-- 5. Next Matchday Prediction -->
        <div class="p-3 rounded-xl bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/50 border border-purple-500/30 space-y-1">
          <span class="text-[10px] font-bold text-purple-300 uppercase tracking-wider">🔮 Next Matchday Prediction</span>
          <p class="text-xs leading-relaxed text-slate-200 italic">"${insights.prediction}"</p>
        </div>
      `;
      contentEl.classList.remove("hidden");
    }
  } catch (err) {
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="p-4 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 space-y-2">
          <p class="font-bold">Could not generate AI insights:</p>
          <p class="text-xs font-mono">${err.message}</p>
          <p class="text-[11px] text-slate-400">Make sure Ollama is running and qwen2.5-coder:1.5b is available.</p>
        </div>
      `;
      contentEl.classList.remove("hidden");
    }
  } finally {
    if (loadingEl) loadingEl.classList.add("hidden");
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

// ============================================================
// AI Coach (Local LLM - qwen2.5-coder:1.5b via Ollama)
// ============================================================
function setupAiEvents() {
  // Check connection on load
  checkAiConnection(false);

  // Build with AI Coach button (Constraint-first)
  document.getElementById("btn-build-ai-teams")?.addEventListener("click", handleBuildAiTeams);

  // Review & Refine Draft with AI button (Draft-first)
  document.getElementById("btn-refine-ai-draft")?.addEventListener("click", handleRefineDraftWithAi);

  // Clear prompt button
  const promptInput = document.getElementById("ai-coach-prompt-input");
  const clearBtn = document.getElementById("btn-clear-ai-prompt");
  if (promptInput && clearBtn) {
    promptInput.addEventListener("input", () => {
      clearBtn.classList.toggle("hidden", !promptInput.value);
    });
    clearBtn.addEventListener("click", () => {
      promptInput.value = "";
      clearBtn.classList.add("hidden");
      promptInput.focus();
    });
  }

  // Quick suggestion chips
  document.querySelectorAll("[data-ai-prompt-chip]").forEach(chip => {
    chip.addEventListener("click", () => {
      if (promptInput) {
        promptInput.value = chip.dataset.aiPromptChip;
        clearBtn?.classList.remove("hidden");
        promptInput.focus();
      }
    });
  });

  // Open / Close Settings Modal
  document.getElementById("btn-open-ai-settings")?.addEventListener("click", openAiSettingsModal);
  document.getElementById("btn-close-ai-settings")?.addEventListener("click", closeAiSettingsModal);

  // Test Connection in Modal
  document.getElementById("btn-test-ai-connection")?.addEventListener("click", async () => {
    const endpoint = document.getElementById("ai-settings-endpoint")?.value?.trim() || "";
    const model = document.getElementById("ai-settings-model")?.value?.trim() || "";
    const resultBox = document.getElementById("ai-test-connection-result");

    if (resultBox) {
      resultBox.className = "p-2.5 rounded-xl text-[11px] font-mono bg-slate-900 border border-slate-700 text-slate-300";
      resultBox.textContent = "Connecting to Ollama...";
      resultBox.classList.remove("hidden");
    }

    const testRes = await testOllamaConnection(endpoint, model);
    if (resultBox) {
      if (testRes.ok) {
        resultBox.className = "p-2.5 rounded-xl text-[11px] font-mono bg-emerald-950/60 border border-emerald-500/50 text-emerald-300";
        resultBox.innerHTML = `✅ Connected to Ollama!<br>Available models: ${testRes.models.join(", ") || "None"}<br>${testRes.hasTargetModel ? "🎯 Target model '" + model + "' is ready!" : "⚠️ Note: Target model '" + model + "' not found in list."}`;
      } else {
        resultBox.className = "p-2.5 rounded-xl text-[11px] font-mono bg-red-950/60 border border-red-500/50 text-red-300";
        resultBox.innerHTML = `❌ Connection failed: ${testRes.error}`;
      }
    }
  });

  // Save AI Settings
  document.getElementById("btn-save-ai-settings")?.addEventListener("click", () => {
    const endpoint = document.getElementById("ai-settings-endpoint")?.value?.trim() || "http://localhost:11434";
    const model = document.getElementById("ai-settings-model")?.value?.trim() || "qwen2.5-coder:1.5b";

    state.aiConfig.endpoint = endpoint;
    state.aiConfig.model = model;
    saveAiConfig(state.aiConfig);

    closeAiSettingsModal();
    checkAiConnection(true);
    showToast("⚙️ AI Configuration saved!", "success");
  });

  // Dismiss AI Briefing Card
  document.getElementById("btn-dismiss-ai-briefing")?.addEventListener("click", () => {
    document.getElementById("ai-coach-briefing-card")?.classList.add("hidden");
  });
}

async function checkAiConnection(notifyIfOnline = false) {
  const badge = document.getElementById("ai-status-badge");
  const dot = document.getElementById("ai-status-dot");
  const text = document.getElementById("ai-status-text");

  if (!badge) return;

  const result = await testOllamaConnection(state.aiConfig.endpoint, state.aiConfig.model);
  if (result.ok) {
    if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse";
    if (text) text.textContent = `${state.aiConfig.model} (Online)`;
    badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 cursor-pointer";
    badge.onclick = () => openAiSettingsModal();
    if (notifyIfOnline) showToast(`🟢 Connected to Ollama (${state.aiConfig.model})`, "success");
  } else {
    if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-slate-500";
    if (text) text.textContent = "Ollama Offline (Click ⚙️)";
    badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5 cursor-pointer";
    badge.onclick = () => openAiSettingsModal();
  }
}

async function handleBuildAiTeams() {
  const promptInput = document.getElementById("ai-coach-prompt-input");
  const prompt = promptInput?.value?.trim() || "";

  const requiredCount = state.targetTeamSize * 2;
  const selected = db.getAll().filter(p => state.selectedPlayerIds.has(p.id));

  if (selected.length !== requiredCount) {
    showToast(`⚠️ Please select exactly ${requiredCount} players (currently ${selected.length} selected).`, "warning");
    return;
  }

  if (!prompt) {
    showToast("ℹ️ Please enter instructions for the AI Coach (or click a quick prompt chip)!", "info");
    promptInput?.focus();
    return;
  }

  const btn = document.getElementById("btn-build-ai-teams");
  const btnIcon = document.getElementById("ai-btn-icon");
  const btnText = document.getElementById("ai-btn-text");

  state.isAiLoading = true;
  if (btn) btn.disabled = true;
  if (btnIcon) btnIcon.textContent = "⏳";
  if (btnText) btnText.textContent = "AI Coach Analyzing...";

  showToast(`🤖 Consulting AI Coach (${state.aiConfig.model})...`, "info");

  try {
    const aiResult = await queryAiCoach(prompt, selected, {
      teamAName: state.teamAName,
      teamBName: state.teamBName,
      targetTeamSize: state.targetTeamSize,
      leagueSummary: state.leagueSummaryText
    }, state.aiConfig);

    state.aiCoachBriefing = aiResult.coachBriefing;
    state.aiConstraints = aiResult.constraints;

    // Run balancer with AI constraints
    const solutions = buildBalancedTeams(selected, {
      mode: state.balanceMode,
      gkMode: state.gkMode,
      matchdaySettingsMap: state.matchdaySettings,
      sectorWeights: state.sectorWeights,
      constraints: aiResult.constraints,
      topK: 3
    });

    if (!solutions || solutions.length === 0) {
      showToast("Could not generate balanced teams with constraints. Please try relaxing your prompt.", "warning");
      return;
    }

    state.generatedSolutions = solutions;
    state.currentSolutionIndex = 0;
    applySolution(solutions[0]);

    state.aiRefineSwaps = []; // Clear refine swaps if any
    renderAiCoachBriefing();

    // Scroll to pitch section smoothly
    document.getElementById("match-results-section")?.classList.remove("hidden");
    document.getElementById("match-results-section")?.scrollIntoView({ behavior: "smooth" });
    showToast("🎉 AI Coach generated and balanced your matchday lineup!", "success");
  } catch (err) {
    showToast(`AI Coach Error: ${err.message}`, "error");
    console.error("AI Coach Error:", err);
  } finally {
    state.isAiLoading = false;
    if (btn) btn.disabled = false;
    if (btnIcon) btnIcon.textContent = "🧠";
    if (btnText) btnText.textContent = "Build with AI Rules";
  }
}

async function handleRefineDraftWithAi() {
  const promptInput = document.getElementById("ai-coach-prompt-input");
  const prompt = promptInput?.value?.trim() || "";

  const requiredCount = state.targetTeamSize * 2;
  const selected = db.getAll().filter(p => state.selectedPlayerIds.has(p.id));

  if (selected.length !== requiredCount) {
    showToast(`⚠️ Please select exactly ${requiredCount} players (currently ${selected.length} selected).`, "warning");
    return;
  }

  if (!prompt) {
    showToast("ℹ️ Please enter tactical instructions for refining the draft!", "info");
    promptInput?.focus();
    return;
  }

  // Step 1: Ensure we have a balanced first draft baseline
  if (!state.activeTeamA || state.activeTeamA.length === 0 || !state.activeTeamB || state.activeTeamB.length === 0) {
    const initialSolutions = buildBalancedTeams(selected, {
      mode: state.balanceMode,
      gkMode: state.gkMode,
      matchdaySettingsMap: state.matchdaySettings,
      sectorWeights: state.sectorWeights,
      topK: 1
    });
    if (!initialSolutions || initialSolutions.length === 0) {
      showToast("Could not generate initial mathematical draft.", "error");
      return;
    }
    state.generatedSolutions = initialSolutions;
    state.currentSolutionIndex = 0;
    applySolution(initialSolutions[0]);
  }

  const btn = document.getElementById("btn-refine-ai-draft");
  const btnIcon = document.getElementById("ai-refine-btn-icon");
  const btnText = document.getElementById("ai-refine-btn-text");

  state.isAiLoading = true;
  if (btn) btn.disabled = true;
  if (btnIcon) btnIcon.textContent = "⏳";
  if (btnText) btnText.textContent = "AI Reviewing Draft...";

  showToast(`🔍 AI Coach reviewing mathematical draft (${state.aiConfig.model})...`, "info");

  try {
    const statsA = calculateTeamStats(state.activeTeamA, state.matchdaySettings, state.sectorWeights);
    const statsB = calculateTeamStats(state.activeTeamB, state.matchdaySettings, state.sectorWeights);

    const aiResult = await refineDraftWithAi(prompt, state.activeTeamA, state.activeTeamB, {
      teamAName: state.teamAName,
      teamBName: state.teamBName,
      statsA,
      statsB,
      leagueSummary: state.leagueSummaryText
    }, state.aiConfig);

    const appliedSwaps = [];

    // Step 2: Apply valid tactical swaps proposed by AI
    (aiResult.swaps || []).forEach(swap => {
      const nameA = (swap.playerFromTeamA || "").toLowerCase().trim();
      const nameB = (swap.playerFromTeamB || "").toLowerCase().trim();

      const idxA = state.activeTeamA.findIndex(p => p.name.toLowerCase().trim() === nameA);
      const idxB = state.activeTeamB.findIndex(p => p.name.toLowerCase().trim() === nameB);

      if (idxA !== -1 && idxB !== -1) {
        const playerA = state.activeTeamA[idxA];
        const playerB = state.activeTeamB[idxB];

        // Swap players
        state.activeTeamA[idxA] = playerB;
        state.activeTeamB[idxB] = playerA;

        appliedSwaps.push({
          playerA: playerA.name,
          playerB: playerB.name,
          rationale: swap.rationale || "Tactical balance adjustment"
        });
      }
    });

    // Step 3: Reassign formations and recalculate
    state.assignedSlotsA = assignPlayersToFormation(state.activeTeamA, state.formationTeamA);
    state.assignedSlotsB = assignPlayersToFormation(state.activeTeamB, state.formationTeamB);

    state.aiCoachBriefing = aiResult.reviewCommentary;
    state.aiRefineSwaps = appliedSwaps;

    // Render results
    renderPitch();
    renderTeamComparison();
    renderAiCoachBriefing();

    document.getElementById("match-results-section")?.classList.remove("hidden");
    document.getElementById("match-results-section")?.scrollIntoView({ behavior: "smooth" });

    if (appliedSwaps.length > 0) {
      showToast(`🎯 AI Coach refined draft with ${appliedSwaps.length} tactical swap(s)!`, "success");
    } else {
      showToast("🎯 AI Coach reviewed draft: teams are already tactically optimal!", "info");
    }
  } catch (err) {
    showToast(`AI Refine Error: ${err.message}`, "error");
    console.error("AI Refine Error:", err);
  } finally {
    state.isAiLoading = false;
    if (btn) btn.disabled = false;
    if (btnIcon) btnIcon.textContent = "🔍";
    if (btnText) btnText.textContent = "Review & Refine Draft with AI";
  }
}

function renderAiCoachBriefing() {
  const card = document.getElementById("ai-coach-briefing-card");
  const textEl = document.getElementById("ai-coach-briefing-text");
  const labelEl = document.getElementById("ai-briefing-model-label");
  const swapsContainer = document.getElementById("ai-refine-swaps-container");
  const swapsList = document.getElementById("ai-refine-swaps-list");

  if (!card || !textEl) return;

  if (state.aiCoachBriefing) {
    textEl.textContent = `"${state.aiCoachBriefing}"`;
    if (labelEl) labelEl.textContent = `Model: ${state.aiConfig.model}`;

    if (swapsContainer && swapsList) {
      if (state.aiRefineSwaps && state.aiRefineSwaps.length > 0) {
        swapsList.innerHTML = state.aiRefineSwaps.map(s => `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-amber-500/30 gap-1">
            <div class="flex items-center gap-2 font-bold">
              <span class="text-blue-400 font-mono">${s.playerA} (${state.teamAName})</span>
              <span class="text-amber-400">⇄</span>
              <span class="text-red-400 font-mono">${s.playerB} (${state.teamBName})</span>
            </div>
            <span class="text-[11px] text-slate-300 italic">${s.rationale}</span>
          </div>
        `).join("");
        swapsContainer.classList.remove("hidden");
      } else {
        swapsContainer.classList.add("hidden");
      }
    }

    card.classList.remove("hidden");
  } else {
    card.classList.add("hidden");
  }
}

function openAiSettingsModal() {
  const modal = document.getElementById("modal-ai-settings");
  const endpointInput = document.getElementById("ai-settings-endpoint");
  const modelInput = document.getElementById("ai-settings-model");
  const resultBox = document.getElementById("ai-test-connection-result");

  if (endpointInput) endpointInput.value = state.aiConfig.endpoint;
  if (modelInput) modelInput.value = state.aiConfig.model;
  if (resultBox) resultBox.classList.add("hidden");

  modal?.classList.remove("hidden");
}

function closeAiSettingsModal() {
  document.getElementById("modal-ai-settings")?.classList.add("hidden");
}

// ============================================================
// Sector Weights Panel
// ============================================================

/** Populates all sliders from state.sectorWeights and wires up all events */
// ============================================================
// Jersey Colour Swatch Helper
// ============================================================

/** Updates the ring/border on colour swatches to indicate the active choice */
function updateColorSwatchActiveState(team, activeColor) {
  document.querySelectorAll(`[data-team-color-target="${team}"]`).forEach(btn => {
    const btnColor = btn.dataset.color;
    if (btnColor === activeColor) {
      btn.style.outline = "2px solid #facc15";
      btn.style.outlineOffset = "2px";
      btn.style.transform = "scale(1.2)";
      btn.style.borderColor = "#ffffff";
      btn.style.opacity = "1";
    } else {
      btn.style.outline = "none";
      btn.style.outlineOffset = "0";
      btn.style.transform = "scale(1)";
      btn.style.borderColor = "#475569";
      btn.style.opacity = "0.75";
    }
  });
}

function initSectorWeightsPanel() {
  // Toggle collapse
  const toggleBtn = document.getElementById("sector-weights-toggle");
  const panel     = document.getElementById("sector-weights-panel");
  if (toggleBtn && panel) {
    toggleBtn.addEventListener("click", () => {
      const hidden = panel.classList.toggle("hidden");
      toggleBtn.querySelector(".sw-toggle-icon").textContent = hidden ? "▼" : "▲";
    });
  }

  // Populate sliders from current state
  populateSectorSliders();

  // Wire per-slider input events via delegation
  document.getElementById("sector-weights-panel")?.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.matches("[data-sw-sector][data-sw-group][data-sw-key]")) return;

    const sector = el.dataset.swSector;   // "attack" | "midfield" | "defense" | "overall"
    const group  = el.dataset.swGroup;    // "attributes" | "positions" | "gkBlend" | "penaltyMult"
    const key    = el.dataset.swKey;      // e.g. "sho" | "FWD" | "value"
    const val    = parseFloat(el.value);

    if (group === "gkBlend" || group === "penaltyMult") {
      state.sectorWeights[sector][group] = val;
    } else {
      state.sectorWeights[sector][group][key] = val;
    }

    // Update readout
    const readout = document.getElementById(`sw-readout-${sector}-${group}-${key}`);
    if (readout) readout.textContent = val.toFixed(2);

    saveSectorWeights(state.sectorWeights);
    if (state.activeTeamA && state.activeTeamA.length > 0) {
      renderTeamComparison();
    }
  });

  // Per-sector reset buttons
  document.getElementById("sector-weights-panel")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sw-reset-sector]");
    if (!btn) return;
    const sector = btn.dataset.swResetSector;
    state.sectorWeights[sector] = cloneSectorWeights(DEFAULT_SECTOR_WEIGHTS)[sector];
    saveSectorWeights(state.sectorWeights);
    populateSectorSliders();
    if (state.activeTeamA && state.activeTeamA.length > 0) {
      renderTeamComparison();
    }
    showToast(`↺ ${sector.charAt(0).toUpperCase() + sector.slice(1)} weights reset to defaults`, "info");
  });

  // Global reset button
  document.getElementById("btn-reset-all-sector-weights")?.addEventListener("click", () => {
    state.sectorWeights = cloneSectorWeights(DEFAULT_SECTOR_WEIGHTS);
    saveSectorWeights(state.sectorWeights);
    populateSectorSliders();
    if (state.activeTeamA && state.activeTeamA.length > 0) {
      renderTeamComparison();
    }
    showToast("↺ All sector weights reset to defaults", "info");
  });
}

/** Reads state.sectorWeights and sets all slider values + readouts */
function populateSectorSliders() {
  const sw = state.sectorWeights;

  function setSlider(sector, group, key, value) {
    const el = document.querySelector(`[data-sw-sector="${sector}"][data-sw-group="${group}"][data-sw-key="${key}"]`);
    if (el) el.value = value;
    const readout = document.getElementById(`sw-readout-${sector}-${group}-${key}`);
    if (readout) readout.textContent = parseFloat(value).toFixed(2);
  }

  // Attack
  ["sho","dri","pac","pas","def","phy"].forEach(k => setSlider("attack", "attributes", k, sw.attack.attributes[k] ?? 0));
  ["GK","DEF","MID","FWD"].forEach(k  => setSlider("attack", "positions", k, sw.attack.positions[k] ?? 1));
  setSlider("attack", "penaltyMult", "value", sw.attack.penaltyMult ?? 8.0);

  // Midfield
  ["sho","dri","pac","pas","def","phy"].forEach(k => setSlider("midfield", "attributes", k, sw.midfield.attributes[k] ?? 0));
  ["GK","DEF","MID","FWD"].forEach(k  => setSlider("midfield", "positions", k, sw.midfield.positions[k] ?? 1));
  setSlider("midfield", "penaltyMult", "value", sw.midfield.penaltyMult ?? 7.0);

  // Defense
  ["sho","dri","pac","pas","def","phy"].forEach(k => setSlider("defense", "attributes", k, sw.defense.attributes[k] ?? 0));
  ["GK","DEF","MID","FWD"].forEach(k  => setSlider("defense", "positions", k, sw.defense.positions[k] ?? 1));
  setSlider("defense", "gkBlend",      "value", sw.defense.gkBlend ?? 0.35);
  setSlider("defense", "penaltyMult",  "value", sw.defense.penaltyMult ?? 9.0);

  // Overall
  setSlider("overall", "penaltyMult", "value", sw.overall?.penaltyMult ?? 22.0);
}

function updateFormationOptions() {
  const sizeKey = `${state.targetTeamSize}v${state.targetTeamSize}`;
  const formations = getFormationsForSize(sizeKey);
  const keys = Object.keys(formations);

  const selA = document.getElementById("formation-team-a");
  const selB = document.getElementById("formation-team-b");
  if (!selA || !selB) return;

  selA.innerHTML = keys.map(k => `<option value="${k}">${formations[k].name}</option>`).join("");
  selB.innerHTML = keys.map(k => `<option value="${k}">${formations[k].name}</option>`).join("");

  state.formationTeamA = keys[0] || "1-3-3-1";
  state.formationTeamB = keys[0] || "1-3-3-1";
}

function handleBuildTeams() {
  const requiredCount = state.targetTeamSize * 2;
  const selected = db.getAll().filter(p => state.selectedPlayerIds.has(p.id));

  if (selected.length !== requiredCount) {
    showToast(`⚠️ Please select exactly ${requiredCount} players (currently ${selected.length} selected).`, "warning");
    return;
  }

  try {
    const solutions = buildBalancedTeams(selected, {
      mode: state.balanceMode,
      gkMode: state.gkMode,
      matchdaySettingsMap: state.matchdaySettings,
      sectorWeights: state.sectorWeights,
      topK: 3
    });

    if (!solutions || solutions.length === 0) {
      showToast("Could not generate balanced teams. Please try selecting different players.", "error");
      return;
    }

    state.generatedSolutions = solutions;
    state.currentSolutionIndex = 0;
    applySolution(solutions[0]);

    // Scroll to pitch section smoothly
    document.getElementById("match-results-section")?.classList.remove("hidden");
    document.getElementById("match-results-section")?.scrollIntoView({ behavior: "smooth" });
    showToast("🎉 Perfectly balanced teams generated with Matchday Form & Synergies!", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

/**
 * Synchronizes active players' on-pitch matchday positions and tactical roles
 * from their currently assigned formation slots.
 */
function syncMatchdayPositions() {
  if (state.assignedSlotsA && state.assignedSlotsA.length > 0) {
    state.assignedSlotsA.forEach(({ slot, player }) => {
      if (player && slot) {
        player.matchdayPosition = slot.pos;
        player.matchdayRole = slot.role || slot.label;
      }
    });
    state.activeTeamA = state.assignedSlotsA.map(s => s.player);
  }
  if (state.assignedSlotsB && state.assignedSlotsB.length > 0) {
    state.assignedSlotsB.forEach(({ slot, player }) => {
      if (player && slot) {
        player.matchdayPosition = slot.pos;
        player.matchdayRole = slot.role || slot.label;
      }
    });
    state.activeTeamB = state.assignedSlotsB.map(s => s.player);
  }
}

function applySolution(solution) {
  state.activeTeamA = [...solution.teamA];
  state.activeTeamB = [...solution.teamB];
  state.selectedSwapPlayerId = null;
  state.selectedSwapTeam = null;

  const sizeKey = `${state.targetTeamSize}v${state.targetTeamSize}`;
  const formations = getFormationsForSize(sizeKey);
  const formA = formations[state.formationTeamA] || formations[Object.keys(formations)[0]];
  const formB = formations[state.formationTeamB] || formations[Object.keys(formations)[0]];

  state.assignedSlotsA = assignPlayersToFormation(state.activeTeamA, formA);
  state.assignedSlotsB = assignPlayersToFormation(state.activeTeamB, formB);
  syncMatchdayPositions();

  renderPitch();
  renderTeamComparison();
  renderSolutionPicker();
  renderSynergyBanner(solution);
}

function renderSolutionPicker() {
  const container = document.getElementById("solution-picker-container");
  if (!container) return;

  if (state.generatedSolutions.length <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Balanced Options:</span>
      ${state.generatedSolutions.map((sol, idx) => `
        <button class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          state.currentSolutionIndex === idx
            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
        }" data-solution-idx="${idx}">
          Option ${idx + 1} (${sol.fairnessScore}% Match)
        </button>
      `).join("")}
    </div>
  `;

  container.querySelectorAll("[data-solution-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.solutionIdx, 10);
      state.currentSolutionIndex = idx;
      applySolution(state.generatedSolutions[idx]);
    });
  });
}

function renderSynergyBanner(solution) {
  const banner = document.getElementById("synergy-status-banner");
  if (!banner) return;

  const statsA = calculateTeamStats(state.activeTeamA, state.matchdaySettings);
  const statsB = calculateTeamStats(state.activeTeamB, state.matchdaySettings);

  const duosA = statsA.activeDuos || [];
  const duosB = statsB.activeDuos || [];

  if (duosA.length === 0 && duosB.length === 0) {
    banner.innerHTML = `
      <div class="flex items-center gap-2 text-slate-400">
        <span>⚡</span>
        <span>No active chemistry partner duos on current lineup. Edit players in Database to define chemistry synergies!</span>
      </div>
    `;
    return;
  }

  banner.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-bold text-amber-400 flex items-center gap-1">
          <span>⚡ Active Chemistry Duos:</span>
        </span>
        ${duosA.map(d => `
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-950 border border-blue-500/40 text-blue-300">
            🔵 ${d.label} (+1.5 OVR)
          </span>
        `).join("")}
        ${duosB.map(d => `
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-950 border border-red-500/40 text-red-300">
            🔴 ${d.label} (+1.5 OVR)
          </span>
        `).join("")}
      </div>
      <div class="text-[11px] text-slate-400 italic">
        ${state.gkMode === "rotating" ? "🔄 Rotating Goalkeepers Active" : "🧤 Fixed Dedicated GK Active"}
      </div>
    </div>
  `;
}

// ============================================================
// Matchday Roster Selection View
// ============================================================
function renderGeneratorView() {
  const allPlayers = db.getAll();
  const requiredCount = state.targetTeamSize * 2;
  const currentCount = state.selectedPlayerIds.size;

  // Update Status Banner & Badge
  const badge = document.getElementById("selection-count-badge");
  const countText = document.getElementById("selection-count-text");
  if (badge && countText) {
    countText.textContent = `${currentCount} / ${requiredCount}`;
    if (currentCount === requiredCount) {
      badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5";
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Ready to Build (${currentCount}/${requiredCount})`;
    } else if (currentCount > requiredCount) {
      badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5";
      badge.innerHTML = `⚠️ ${currentCount - requiredCount} Too Many (${currentCount}/${requiredCount})`;
    } else {
      badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5";
      badge.innerHTML = `Need ${requiredCount - currentCount} more (${currentCount}/${requiredCount})`;
    }
  }

  // Render Selection Grid
  const grid = document.getElementById("matchday-player-grid");
  if (!grid) return;

  // Filter selection cards
  let filtered = allPlayers;
  if (state.filterPosition !== "ALL") {
    filtered = filtered.filter(p => p.position === state.filterPosition);
  }

  filtered.sort((a, b) => b.ovr - a.ovr);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <p class="text-lg">No players found in this category.</p>
        <button id="btn-add-player-empty" class="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg">Add New Player</button>
      </div>
    `;
    document.getElementById("btn-add-player-empty")?.addEventListener("click", () => openPlayerModal());
    return;
  }

  grid.innerHTML = filtered.map(player => {
    const isSelected = state.selectedPlayerIds.has(player.id);
    const mSetting = state.matchdaySettings[player.id] || { fitness: 100, form: "neutral" };
    const effective = getEffectivePlayerStats(player, mSetting);
    const cardClass = getFifaCardTierClass(effective.effectiveOvr);
    const formInfo = effective.formMod;

    // Diff indicator
    const ovrDiff = effective.effectiveOvr - player.ovr;
    const diffTag = ovrDiff > 0 ? `<span class="text-[10px] text-emerald-400 font-bold ml-1">(+${ovrDiff})</span>`
      : ovrDiff < 0 ? `<span class="text-[10px] text-red-400 font-bold ml-1">(${ovrDiff})</span>`
      : '';

    // Partner chips
    const partnerCount = (player.chemistryPartners || []).length;

    return `
      <div class="relative p-3 rounded-2xl transition-all duration-200 border flex flex-col justify-between ${
        isSelected
          ? "bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/20"
          : "glass-card border-slate-800/80 hover:border-slate-700"
      }" data-player-card-id="${player.id}">
        
        <div>
          <!-- Top Row: Card header, selection trigger & form -->
          <div class="flex items-start justify-between gap-2">
            
            <!-- Clickable Player Info to toggle selection -->
            <div class="flex items-center gap-2.5 flex-1 cursor-pointer select-none" data-player-select-id="${player.id}">
              <div class="w-11 h-11 rounded-xl flex items-center justify-center font-black text-base ${cardClass} shadow-md flex-shrink-0">
                ${effective.effectiveOvr}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1">
                  <span class="text-xs font-black text-white truncate">${player.name}</span>
                  ${diffTag}
                </div>
                <div class="flex items-center gap-1 mt-0.5">
                  <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${getPositionBadgeClass(player.position)}">
                    ${player.position}
                  </span>
                  ${partnerCount > 0 ? `
                    <span class="px-1 py-0.2 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30" title="Has ${partnerCount} chemistry duos">
                      ⚡ ${partnerCount}
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- Checkbox & Form Cycle Button -->
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <!-- Form toggle button -->
              <button class="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs transition-all" title="Current Form: ${formInfo.label} (Click to change)" data-cycle-form-id="${player.id}">
                ${formInfo.icon}
              </button>

              <!-- Checkbox -->
              <div class="w-5 h-5 rounded-md flex items-center justify-center border cursor-pointer transition-all ${
                isSelected
                  ? "bg-blue-600 border-blue-400 text-white"
                  : "bg-slate-800/80 border-slate-600 text-transparent"
              }" data-player-select-id="${player.id}">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                </svg>
              </div>
            </div>

          </div>

          <!-- Bottom: Matchday Fitness Slider (Always accessible) -->
          <div class="mt-2.5 pt-2 border-t border-slate-800/60">
            <div class="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1">
              <span class="flex items-center gap-1">
                <span>🔋 Matchday Fitness:</span>
                <span class="font-mono ${mSetting.fitness < 70 ? 'text-amber-400 font-bold' : 'text-emerald-400'}">${mSetting.fitness}%</span>
              </span>
              <div class="flex items-center gap-1">
                <button class="px-1 py-0.2 rounded text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300" data-set-fitness="${player.id}" data-val="100">100%</button>
                <button class="px-1 py-0.2 rounded text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300" data-set-fitness="${player.id}" data-val="75">75%</button>
                <button class="px-1 py-0.2 rounded text-[8px] bg-slate-800 hover:bg-slate-700 text-slate-300" data-set-fitness="${player.id}" data-val="50">50%</button>
              </div>
            </div>
            <input type="range" min="20" max="100" step="5" value="${mSetting.fitness}" class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" data-fitness-slider-id="${player.id}">
          </div>

        </div>

      </div>
    `;
  }).join("");

  // Attach card toggle listeners
  grid.querySelectorAll("[data-player-select-id]").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.playerSelectId;
      if (state.selectedPlayerIds.has(id)) {
        state.selectedPlayerIds.delete(id);
      } else {
        state.selectedPlayerIds.add(id);
      }
      renderGeneratorView();
    });
  });

  // Attach Form cycle listeners (Hot -> Good -> Neutral -> Cold -> Terrible -> Hot)
  grid.querySelectorAll("[data-cycle-form-id]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.cycleFormId;
      const formOrder = ["neutral", "good", "hot", "cold", "terrible"];
      const current = state.matchdaySettings[id]?.form || "neutral";
      const nextIdx = (formOrder.indexOf(current) + 1) % formOrder.length;
      const nextForm = formOrder[nextIdx];
      
      if (!state.matchdaySettings[id]) state.matchdaySettings[id] = { fitness: 100, form: "neutral" };
      state.matchdaySettings[id].form = nextForm;
      renderGeneratorView();
    });
  });

  // Attach Fitness slider listeners
  grid.querySelectorAll("[data-fitness-slider-id]").forEach(slider => {
    slider.addEventListener("input", (e) => {
      const id = slider.dataset.fitnessSliderId;
      const val = parseInt(e.target.value, 10);
      if (!state.matchdaySettings[id]) state.matchdaySettings[id] = { fitness: 100, form: "neutral" };
      state.matchdaySettings[id].fitness = val;
    });
    slider.addEventListener("change", () => {
      renderGeneratorView();
    });
  });

  // Preset fitness buttons
  grid.querySelectorAll("[data-set-fitness]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.setFitness;
      const val = parseInt(btn.dataset.val, 10);
      if (!state.matchdaySettings[id]) state.matchdaySettings[id] = { fitness: 100, form: "neutral" };
      state.matchdaySettings[id].fitness = val;
      renderGeneratorView();
    });
  });

  // Filter Buttons in Generator
  document.querySelectorAll("[data-filter-pos-gen]").forEach(btn => {
    const pos = btn.dataset.filterPosGen;
    const isActive = state.filterPosition === pos;
    btn.className = `px-3 py-1 rounded-lg text-xs font-bold transition-all ${
      isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
    }`;
    btn.onclick = () => {
      state.filterPosition = pos;
      renderGeneratorView();
    };
  });
}

// ============================================================
// Interactive Pitch Rendering & Tactical View
// ============================================================
function renderPitch() {
  const pitchContainer = document.getElementById("soccer-pitch");
  if (!pitchContainer) return;

  const sizeKey = `${state.targetTeamSize}v${state.targetTeamSize}`;
  const formations = getFormationsForSize(sizeKey);
  const formA = formations[state.formationTeamA] || formations[Object.keys(formations)[0]];
  const formB = formations[state.formationTeamB] || formations[Object.keys(formations)[0]];

  // Initialize slot assignments if missing or size changed
  if (!state.assignedSlotsA || state.assignedSlotsA.length !== state.activeTeamA.length) {
    state.assignedSlotsA = assignPlayersToFormation(state.activeTeamA, formA);
  }
  if (!state.assignedSlotsB || state.assignedSlotsB.length !== state.activeTeamB.length) {
    state.assignedSlotsB = assignPlayersToFormation(state.activeTeamB, formB);
  }

  // Clear existing player tokens and watermarks while keeping pitch markings
  pitchContainer.querySelectorAll(".player-token, .pitch-team-watermark").forEach(el => el.remove());

  // ── Team Side Watermark Badges ─────────────────────────────
  // Left Side Team (Team A / Voyagers)
  const watermarkLeft = document.createElement("div");
  watermarkLeft.className = "pitch-team-watermark left";
  watermarkLeft.innerHTML = `<span class="w-2.5 h-2.5 rounded-full inline-block jersey-${state.teamAColor}"></span> <span>${state.teamAName}</span>`;
  pitchContainer.appendChild(watermarkLeft);

  // Right Side Team (Team B / Boots & Beers)
  const watermarkRight = document.createElement("div");
  watermarkRight.className = "pitch-team-watermark right";
  watermarkRight.innerHTML = `<span>${state.teamBName}</span> <span class="w-2.5 h-2.5 rounded-full inline-block jersey-${state.teamBColor}"></span>`;
  pitchContainer.appendChild(watermarkRight);

  // Render Team A (Left Half of Pitch: x: 0% -> 48%)
  state.assignedSlotsA.forEach(({ slot, player }) => {
    const posX = 4 + (slot.y / 100) * 42;
    const posY = slot.x;
    const token = createPlayerToken(player, "A", posX, posY, slot.label);
    pitchContainer.appendChild(token);
  });

  // Render Team B (Right Half of Pitch: x: 52% -> 96%)
  state.assignedSlotsB.forEach(({ slot, player }) => {
    const posX = 96 - (slot.y / 100) * 42;
    const posY = slot.x;
    const token = createPlayerToken(player, "B", posX, posY, slot.label);
    pitchContainer.appendChild(token);
  });
}

const JERSEY_COLOR_MAP = {
  blue: {
    bg: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    shadow: "0 0 12px rgba(37, 99, 235, 0.7)",
    color: "#ffffff",
    border: "2px solid #ffffff"
  },
  red: {
    bg: "linear-gradient(135deg, #dc2626, #b91c1c)",
    shadow: "0 0 12px rgba(220, 38, 38, 0.7)",
    color: "#ffffff",
    border: "2px solid #ffffff"
  },
  yellow: {
    bg: "linear-gradient(135deg, #eab308, #ca8a04)",
    shadow: "0 0 12px rgba(234, 179, 8, 0.7)",
    color: "#1e1e1e",
    border: "2px solid #fef08a"
  },
  black: {
    bg: "linear-gradient(135deg, #1f2937, #111827)",
    shadow: "0 0 12px rgba(0, 0, 0, 0.8)",
    color: "#ffffff",
    border: "2px solid #6b7280"
  },
  white: {
    bg: "linear-gradient(135deg, #ffffff, #e2e8f0)",
    shadow: "0 0 12px rgba(255, 255, 255, 0.5)",
    color: "#0f172a",
    border: "2px solid #94a3b8"
  },
  gk: {
    bg: "linear-gradient(135deg, #059669, #047857)",
    shadow: "0 0 12px rgba(5, 150, 105, 0.8)",
    color: "#ffffff",
    border: "2px solid #ffffff"
  }
};

function createPlayerToken(player, team, posX, posY, slotLabel) {
  const token = document.createElement("div");
  const isSelected = state.selectedSwapPlayerId === player.id;
  const isGk = player.position === "GK" || slotLabel === "GK";

  const mSetting = state.matchdaySettings[player.id] || { fitness: 100, form: "neutral" };
  const effective = getEffectivePlayerStats(player, mSetting);

  token.className = `player-token ${isSelected ? "selected-swap" : ""}`;
  token.style.left = `${posX}%`;
  token.style.top  = `${posY}%`;
  token.dataset.playerId = player.id;
  token.dataset.team     = team;

  // Abbreviated name: first name only (max 9 chars)
  const displayName = player.name.split(" ")[0].substring(0, 9);

  // Build jersey div with explicit team color class and inline style fallback
  const jersey = document.createElement("div");
  const color = team === "A" ? state.teamAColor : state.teamBColor;
  jersey.className = `token-jersey jersey-${color}`;

  const styleConfig = JERSEY_COLOR_MAP[color] || JERSEY_COLOR_MAP.blue;
  jersey.style.background = styleConfig.bg;
  jersey.style.boxShadow = styleConfig.shadow;
  jersey.style.color = styleConfig.color;
  jersey.style.border = styleConfig.border;

  // Form icon inside jersey
  const formBadge = document.createElement("span");
  formBadge.className = "token-form-badge";
  formBadge.textContent = effective.formMod.icon;
  jersey.appendChild(formBadge);

  // Name badge below jersey
  const nameBadge = document.createElement("div");
  nameBadge.className = "token-name-badge";
  nameBadge.textContent = displayName;

  token.appendChild(jersey);
  token.appendChild(nameBadge);

  // Player Swap click listener directly on token
  token.addEventListener("click", (e) => {
    e.stopPropagation();
    handlePlayerSwapClick(player, team);
  });

  return token;
}

function handlePlayerSwapClick(player, team) {
  if (!state.selectedSwapPlayerId) {
    // First click — select player
    state.selectedSwapPlayerId = player.id;
    state.selectedSwapTeam = team;
    const teamName = team === "A" ? state.teamAName : state.teamBName;
    showToast(`Selected ${player.name} (${teamName}). Click another player on either team to swap!`, "info");
    renderPitch();
    return;
  }

  // Second click on the exact same player — deselect
  if (state.selectedSwapPlayerId === player.id) {
    state.selectedSwapPlayerId = null;
    state.selectedSwapTeam = null;
    showToast("Deselected player.", "info");
    renderPitch();
    return;
  }

  const firstId   = state.selectedSwapPlayerId;
  const firstTeam = state.selectedSwapTeam;

  if (firstTeam === "A" && team === "A") {
    // ── WITHIN TEAM A POSITION SWAP ──────────────────────────────
    const idx1 = state.assignedSlotsA.findIndex(s => s.player.id === firstId);
    const idx2 = state.assignedSlotsA.findIndex(s => s.player.id === player.id);

    if (idx1 !== -1 && idx2 !== -1) {
      const p1 = state.assignedSlotsA[idx1].player;
      state.assignedSlotsA[idx1].player = state.assignedSlotsA[idx2].player;
      state.assignedSlotsA[idx2].player = p1;
      syncMatchdayPositions();
      showToast(`↕️ Position swap: ${state.assignedSlotsA[idx2].player.name} ↔ ${state.assignedSlotsA[idx1].player.name} (${state.teamAName})`, "success");
    }
  } else if (firstTeam === "B" && team === "B") {
    // ── WITHIN TEAM B POSITION SWAP ──────────────────────────────
    const idx1 = state.assignedSlotsB.findIndex(s => s.player.id === firstId);
    const idx2 = state.assignedSlotsB.findIndex(s => s.player.id === player.id);

    if (idx1 !== -1 && idx2 !== -1) {
      const p1 = state.assignedSlotsB[idx1].player;
      state.assignedSlotsB[idx1].player = state.assignedSlotsB[idx2].player;
      state.assignedSlotsB[idx2].player = p1;
      syncMatchdayPositions();
      showToast(`↕️ Position swap: ${state.assignedSlotsB[idx2].player.name} ↔ ${state.assignedSlotsB[idx1].player.name} (${state.teamBName})`, "success");
    }
  } else {
    // ── CROSS-TEAM SWAP (Team A <-> Team B) ──────────────────────
    const idxA = state.assignedSlotsA.findIndex(s => s.player.id === (firstTeam === "A" ? firstId : player.id));
    const idxB = state.assignedSlotsB.findIndex(s => s.player.id === (firstTeam === "B" ? firstId : player.id));

    if (idxA !== -1 && idxB !== -1) {
      const pA = state.assignedSlotsA[idxA].player;
      state.assignedSlotsA[idxA].player = state.assignedSlotsB[idxB].player;
      state.assignedSlotsB[idxB].player = pA;
      syncMatchdayPositions();
      showToast(`🔄 Swapped ${state.assignedSlotsA[idxA].player.name} (${state.teamAName}) ↔ ${state.assignedSlotsB[idxB].player.name} (${state.teamBName})`, "success");
    }
  }

  state.selectedSwapPlayerId = null;
  state.selectedSwapTeam = null;
  renderPitch();
  renderTeamComparison();
  renderSynergyBanner();
}

// ============================================================
// Side-by-Side FIFA Team Comparison Dashboard
// ============================================================
function renderTeamComparison() {
  const statsA = calculateTeamStats(state.activeTeamA, state.matchdaySettings, state.sectorWeights, true);
  const statsB = calculateTeamStats(state.activeTeamB, state.matchdaySettings, state.sectorWeights, true);

  // Team A Overviews
  document.getElementById("team-a-ovr-display").textContent = statsA.effectiveAvgOvr.toFixed(1);
  document.getElementById("team-b-ovr-display").textContent = statsB.effectiveAvgOvr.toFixed(1);

  // Synergy badges
  document.getElementById("team-a-synergy-badge").textContent = `⚡ ${statsA.synergyCount} Chemistry (${statsA.synergyBoost > 0 ? '+' + statsA.synergyBoost : '0'} OVR)`;
  document.getElementById("team-b-synergy-badge").textContent = `⚡ ${statsB.synergyCount} Chemistry (${statsB.synergyBoost > 0 ? '+' + statsB.synergyBoost : '0'} OVR)`;

  // Position breakdown tags
  const posTagA = document.getElementById("team-a-pos-summary");
  const posTagB = document.getElementById("team-b-pos-summary");
  if (posTagA && posTagB) {
    posTagA.innerHTML = `
      <span class="text-emerald-400 font-semibold">${statsA.positions.GK} GK</span> • 
      <span class="text-blue-400 font-semibold">${statsA.positions.DEF} DEF</span> • 
      <span class="text-amber-400 font-semibold">${statsA.positions.MID} MID</span> • 
      <span class="text-red-400 font-semibold">${statsA.positions.FWD} FWD</span>
    `;
    posTagB.innerHTML = `
      <span class="text-emerald-400 font-semibold">${statsB.positions.GK} GK</span> • 
      <span class="text-blue-400 font-semibold">${statsB.positions.DEF} DEF</span> • 
      <span class="text-amber-400 font-semibold">${statsB.positions.MID} MID</span> • 
      <span class="text-red-400 font-semibold">${statsB.positions.FWD} FWD</span>
    `;
  }

  // Stat comparison metrics (Primary Tactical Sectors First)
  const metrics = [
    { key: "attack", label: "⚔️ Attack (ATT)", a: statsA.attack, b: statsB.attack, highlight: true },
    { key: "midfield", label: "⚙️ Midfield (MID)", a: statsA.midfield, b: statsB.midfield, highlight: true },
    { key: "defense", label: "🛡️ Defense & GK (DEF)", a: statsA.defense, b: statsB.defense, highlight: true },
    { key: "pace", label: "Pace / Speed (PAC)", a: statsA.pace, b: statsB.pace },
    { key: "physical", label: "Physical / Stamina (PHY)", a: statsA.physical, b: statsB.physical },
    { key: "passing", label: "Passing & Vision (PAS)", a: statsA.passing, b: statsB.passing },
    { key: "goalkeeping", label: "🧤 GK Shot-Stopping", a: statsA.goalkeeping, b: statsB.goalkeeping }
  ];

  const statContainer = document.getElementById("team-comparison-bars");
  if (!statContainer) return;

  statContainer.innerHTML = metrics.map(m => {
    const diff = m.a - m.b;
    const winnerClassA = diff > 0 ? "font-bold text-blue-400" : "text-slate-300";
    const winnerClassB = diff < 0 ? "font-bold text-red-400" : "text-slate-300";
    const maxVal = Math.max(99, m.a, m.b);

    const widthA = Math.round((m.a / maxVal) * 100);
    const widthB = Math.round((m.b / maxVal) * 100);
    const isHighlight = m.highlight;
    const isExpanded = state.expandedMetrics.has(m.key);

    // Compute player contributions for Team A (using matchdayPosition and sectorWeights)
    const contribsA = state.activeTeamA.map(p => {
      const setting = state.matchdaySettings[p.id] || { fitness: 100, form: "neutral" };
      const score = getPlayerMetricScore(p, setting, m.key, state.sectorWeights, true);
      return { player: p, score };
    }).sort((x, y) => y.score - x.score);

    // Compute player contributions for Team B (using matchdayPosition and sectorWeights)
    const contribsB = state.activeTeamB.map(p => {
      const setting = state.matchdaySettings[p.id] || { fitness: 100, form: "neutral" };
      const score = getPlayerMetricScore(p, setting, m.key, state.sectorWeights, true);
      return { player: p, score };
    }).sort((x, y) => y.score - x.score);

    return `
      <div class="rounded-xl transition-all duration-150 ${isHighlight ? 'bg-slate-900/60 border border-slate-700/60 shadow-sm' : 'border border-slate-800/40 hover:bg-slate-900/30'}">
        <!-- Clickable Bar Row -->
        <div class="p-2 cursor-pointer select-none group" data-metric="${m.key}" title="Click to inspect each player's contribution">
          <div class="flex justify-between items-center text-xs font-semibold">
            <span class="${winnerClassA} text-sm font-mono">${m.a}</span>
            <div class="flex items-center gap-1.5">
              <span class="${isHighlight ? 'text-amber-300 font-bold' : 'text-slate-300 font-mono'} uppercase tracking-wider text-[11px] group-hover:text-white transition-colors">
                ${m.label}
              </span>
              <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-amber-300 transition-all font-mono flex items-center gap-0.5">
                <span>${isExpanded ? '▴' : '▾'}</span>
                <span>${isExpanded ? 'Hide' : 'Inspect'}</span>
              </span>
            </div>
            <span class="${winnerClassB} text-sm font-mono">${m.b}</span>
          </div>

          <div class="grid grid-cols-2 gap-1.5 h-2.5 bg-slate-950 rounded-full p-0.5 border border-slate-800 mt-1.5">
            <div class="flex justify-end bg-slate-900 rounded-l-full overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full stat-bar-fill" style="width: ${widthA}%"></div>
            </div>
            <div class="flex justify-start bg-slate-900 rounded-r-full overflow-hidden">
              <div class="h-full bg-red-500 rounded-full stat-bar-fill" style="width: ${widthB}%"></div>
            </div>
          </div>
        </div>

        <!-- Expandable Player Breakdown Drawer -->
        <div class="${isExpanded ? '' : 'hidden'} px-3 pb-3 pt-1 border-t border-slate-800/60 bg-slate-950/80 rounded-b-xl space-y-2">
          <div class="flex items-center justify-between text-[10px] font-mono border-b border-slate-800/80 pb-1 pt-1">
            <span class="text-blue-400 font-bold flex items-center gap-1">🔵 ${state.teamAName}</span>
            <span class="text-[9px] text-slate-500 uppercase tracking-widest font-sans">Individual Contributions</span>
            <span class="text-red-400 font-bold flex items-center gap-1">${state.teamBName} 🔴</span>
          </div>

          <div class="grid grid-cols-2 gap-3 text-[11px]">
            <!-- Team A Contributors -->
            <div class="space-y-1">
              ${contribsA.map(item => {
                const activePos = item.player.matchdayPosition || item.player.position;
                return `
                  <div class="flex items-center justify-between py-0.5 px-1 rounded hover:bg-slate-900/80">
                    <div class="flex items-center gap-1.5 truncate pr-1">
                      <span class="px-1 py-0.2 rounded text-[9px] font-bold ${getPositionBadgeClass(activePos)}" title="On-pitch role: ${activePos}">${activePos}</span>
                      <span class="font-medium text-slate-200 truncate">${item.player.name}</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0 font-mono">
                      <div class="w-8 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                        <div class="bg-blue-400 h-full rounded-full" style="width: ${Math.min(100, Math.round((item.score/99)*100))}%"></div>
                      </div>
                      <span class="font-bold text-blue-300 text-[11px] w-6 text-right">${item.score}</span>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>

            <!-- Team B Contributors -->
            <div class="space-y-1">
              ${contribsB.map(item => {
                const activePos = item.player.matchdayPosition || item.player.position;
                return `
                  <div class="flex items-center justify-between py-0.5 px-1 rounded hover:bg-slate-900/80">
                    <div class="flex items-center gap-1.5 truncate pr-1">
                      <span class="px-1 py-0.2 rounded text-[9px] font-bold ${getPositionBadgeClass(activePos)}" title="On-pitch role: ${activePos}">${activePos}</span>
                      <span class="font-medium text-slate-200 truncate">${item.player.name}</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0 font-mono">
                      <div class="w-8 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                        <div class="bg-red-400 h-full rounded-full" style="width: ${Math.min(100, Math.round((item.score/99)*100))}%"></div>
                      </div>
                      <span class="font-bold text-red-300 text-[11px] w-6 text-right">${item.score}</span>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Attach click events for accordions
  statContainer.querySelectorAll("[data-metric]").forEach(el => {
    el.addEventListener("click", () => {
      const key = el.getAttribute("data-metric");
      if (state.expandedMetrics.has(key)) {
        state.expandedMetrics.delete(key);
      } else {
        state.expandedMetrics.add(key);
      }
      renderTeamComparison();
    });
  });

  renderTeamRosterList("team-a-roster-list", state.activeTeamA, "A");
  renderTeamRosterList("team-b-roster-list", state.activeTeamB, "B");
}

function renderTeamRosterList(elementId, players, teamTag) {
  const container = document.getElementById(elementId);
  if (!container) return;

  const sorted = [...players].sort((a, b) => {
    const posOrder = { GK: 1, DEF: 2, MID: 3, FWD: 4 };
    const posA = a.matchdayPosition || a.position;
    const posB = b.matchdayPosition || b.position;
    return (posOrder[posA] || 5) - (posOrder[posB] || 5) || b.ovr - a.ovr;
  });

  container.innerHTML = sorted.map(p => {
    const mSetting = state.matchdaySettings[p.id] || { fitness: 100, form: "neutral" };
    const eff = getEffectivePlayerStats(p, mSetting);
    const activePos = p.matchdayPosition || p.position;
    const roleTag = p.matchdayRole ? `<span class="text-[9px] font-mono text-slate-400">(${p.matchdayRole})</span>` : "";

    return `
      <div class="flex items-center justify-between p-2 rounded-lg glass-card border border-slate-800 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${getPositionBadgeClass(activePos)}" title="On-pitch active position: ${activePos} (Natural: ${p.position})">
            ${activePos}
          </span>
          <span class="font-bold text-white truncate">${p.name}</span>
          ${roleTag}
          <span class="text-[10px]">${eff.formMod.icon}</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span class="font-mono text-[10px] text-slate-400">🔋${mSetting.fitness}%</span>
          <span class="px-1.5 py-0.5 rounded font-black text-xs ${getFifaCardTierClass(eff.effectiveOvr)}">
            ${eff.effectiveOvr}
          </span>
        </div>
      </div>
    `;
  }).join("");
}

// ============================================================
// Player Roster Database View
// ============================================================
function setupRosterEvents() {
  document.getElementById("btn-add-player")?.addEventListener("click", () => openPlayerModal());

  document.getElementById("roster-search-input")?.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderRosterView();
  });

  document.getElementById("roster-sort-select")?.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderRosterView();
  });

  document.querySelectorAll("[data-filter-pos]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.filterPosition = btn.dataset.filterPos;
      document.querySelectorAll("[data-filter-pos]").forEach(b => {
        const active = b.dataset.filterPos === state.filterPosition;
        b.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          active ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "bg-slate-800 text-slate-400 hover:text-white"
        }`;
      });
      renderRosterView();
    });
  });
}

function renderRosterView() {
  let players = db.getAll();

  if (state.searchQuery) {
    players = players.filter(p => 
      p.name.toLowerCase().includes(state.searchQuery) ||
      (p.notes && p.notes.toLowerCase().includes(state.searchQuery))
    );
  }

  if (state.filterPosition !== "ALL") {
    players = players.filter(p => p.position === state.filterPosition);
  }

  players.sort((a, b) => {
    switch (state.sortBy) {
      case "ovr_asc": return a.ovr - b.ovr;
      case "name_asc": return a.name.localeCompare(b.name);
      case "pac_desc": return (b.attributes?.pac || 0) - (a.attributes?.pac || 0);
      case "def_desc": return (b.attributes?.def || 0) - (a.attributes?.def || 0);
      case "sho_desc": return (b.attributes?.sho || 0) - (a.attributes?.sho || 0);
      case "ovr_desc":
      default:
        return b.ovr - a.ovr;
    }
  });

  const totalCountEl = document.getElementById("roster-total-count");
  if (totalCountEl) totalCountEl.textContent = `${players.length} Players`;

  const container = document.getElementById("roster-cards-container");
  if (!container) return;

  if (players.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400">
        <p class="text-base font-semibold">No players match your search or filter.</p>
        <button id="btn-add-player-empty-roster" class="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-lg">
          + Add New Player
        </button>
      </div>
    `;
    document.getElementById("btn-add-player-empty-roster")?.addEventListener("click", () => openPlayerModal());
    return;
  }

  container.innerHTML = players.map(p => {
    const cardClass = getFifaCardTierClass(p.ovr);
    const a = p.attributes || { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70 };
    
    // Chemistry names
    const partnerNames = (p.chemistryPartners || [])
      .map(id => db.getById(id)?.name || id)
      .join(", ");

    return `
      <div class="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-slate-600 transition-all group flex flex-col justify-between">
        <div>
          <!-- Header info -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${cardClass} shadow-md">
                ${p.ovr}
              </div>
              <div>
                <h4 class="font-bold text-white text-base leading-tight group-hover:text-blue-400 transition-colors">
                  ${p.name}
                </h4>
                <div class="flex items-center gap-1.5 mt-1">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getPositionBadgeClass(p.position)}">
                    ${p.position}
                  </span>
                  ${p.secondaryPosition && p.secondaryPosition !== p.position ? `
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400">
                      SEC: ${p.secondaryPosition}
                    </span>
                  ` : ''}
                  <span class="text-[10px] text-slate-400 font-mono">🦶 ${p.preferredFoot || 'Right'}</span>
                </div>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button class="p-1.5 hover:bg-slate-700/80 rounded-lg text-slate-400 hover:text-white transition-colors" title="Edit" data-edit-player="${p.id}">
                ✏️
              </button>
              <button class="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors" title="Delete" data-delete-player="${p.id}">
                🗑️
              </button>
            </div>
          </div>

          <!-- Chemistry Duos tag if present -->
          ${partnerNames ? `
            <div class="mt-2 text-[10px] text-amber-300/90 font-medium flex items-center gap-1 truncate" title="Chemistry: ${partnerNames}">
              <span>⚡ Chemistry Duos:</span>
              <span class="text-slate-300 font-semibold truncate">${partnerNames}</span>
            </div>
          ` : ''}

          <!-- FIFA Attribute Hexagon / 6-stat grid -->
          <div class="grid grid-cols-6 gap-1 mt-3 p-2 bg-slate-900/80 rounded-xl border border-slate-800 text-center font-mono">
            <div><div class="text-[9px] text-slate-400 font-bold">PAC</div><div class="text-xs font-black text-white">${a.pac}</div></div>
            <div><div class="text-[9px] text-slate-400 font-bold">SHO</div><div class="text-xs font-black text-white">${a.sho}</div></div>
            <div><div class="text-[9px] text-slate-400 font-bold">PAS</div><div class="text-xs font-black text-white">${a.pas}</div></div>
            <div><div class="text-[9px] text-slate-400 font-bold">DRI</div><div class="text-xs font-black text-white">${a.dri}</div></div>
            <div><div class="text-[9px] text-slate-400 font-bold">DEF</div><div class="text-xs font-black text-white">${a.def}</div></div>
            <div><div class="text-[9px] text-slate-400 font-bold">PHY</div><div class="text-xs font-black text-white">${a.phy}</div></div>
          </div>

          ${p.notes ? `
            <p class="text-xs text-slate-400 italic mt-2.5 truncate" title="${p.notes}">
              💬 "${p.notes}"
            </p>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-edit-player]").forEach(btn => {
    btn.addEventListener("click", () => openPlayerModal(btn.dataset.editPlayer));
  });

  container.querySelectorAll("[data-delete-player]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deletePlayer;
      const player = db.getById(id);
      if (confirm(`Are you sure you want to delete ${player ? player.name : "this player"}?`)) {
        db.deletePlayer(id);
        state.selectedPlayerIds.delete(id);
        renderRosterView();
        showToast("Player deleted successfully.", "info");
      }
    });
  });
}

// ============================================================
// Player Add / Edit Modal & Live FIFA Card Preview
// ============================================================
function setupPlayerModalEvents() {
  const modal = document.getElementById("player-modal");
  const closeBtn = document.getElementById("btn-close-modal");
  const cancelBtn = document.getElementById("btn-cancel-modal");
  const form = document.getElementById("player-form");

  const closeModal = () => {
    modal.classList.add("hidden");
    state.editingPlayerId = null;
  };

  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("modal-player-name").value.trim();
    const position = document.getElementById("modal-player-pos").value;
    const secondaryPosition = document.getElementById("modal-player-sec-pos").value;
    const preferredFoot = document.getElementById("modal-player-foot").value;
    const notes = document.getElementById("modal-player-notes").value.trim();

    // Chemistry partners checked
    const partnerCheckboxes = document.querySelectorAll("input[name='modal-chemistry-partner']:checked");
    const chemistryPartners = Array.from(partnerCheckboxes).map(cb => cb.value);

    const attributes = {
      pac: parseInt(document.getElementById("slider-pac").value, 10),
      sho: parseInt(document.getElementById("slider-sho").value, 10),
      pas: parseInt(document.getElementById("slider-pas").value, 10),
      dri: parseInt(document.getElementById("slider-dri").value, 10),
      def: parseInt(document.getElementById("slider-def").value, 10),
      phy: parseInt(document.getElementById("slider-phy").value, 10),
      gk: parseInt(document.getElementById("slider-gk").value, 10)
    };

    const autoCalc = document.getElementById("toggle-auto-ovr")?.checked;
    let ovr = autoCalc
      ? calculateOvr(position, attributes)
      : parseInt(document.getElementById("slider-ovr").value, 10);

    const saved = db.savePlayer({
      id: state.editingPlayerId,
      name,
      position,
      secondaryPosition,
      preferredFoot,
      ovr,
      attributes,
      notes,
      chemistryPartners
    });

    closeModal();
    renderApp();
    showToast(`✅ Saved player "${saved.name}" (OVR: ${saved.ovr})!`, "success");
  });

  const inputs = [
    "modal-player-name", "modal-player-pos", "modal-player-sec-pos",
    "slider-ovr", "slider-pac", "slider-sho", "slider-pas", "slider-dri",
    "slider-def", "slider-phy", "slider-gk", "toggle-auto-ovr"
  ];

  inputs.forEach(id => {
    document.getElementById(id)?.addEventListener("input", updateCardPreview);
  });
}

function openPlayerModal(playerId = null) {
  state.editingPlayerId = playerId;
  const modal = document.getElementById("player-modal");
  const modalTitle = document.getElementById("modal-title");

  const player = playerId ? db.getById(playerId) : {
    name: "",
    position: "MID",
    secondaryPosition: "FWD",
    ovr: 78,
    preferredFoot: "Right",
    notes: "",
    chemistryPartners: [],
    attributes: { pac: 75, sho: 72, pas: 78, dri: 76, def: 65, phy: 72, gk: 15 }
  };

  modalTitle.textContent = playerId ? "Edit Player Attributes & Chemistry" : "Add New Player";
  document.getElementById("modal-player-name").value = player.name;
  document.getElementById("modal-player-pos").value = player.position;
  document.getElementById("modal-player-sec-pos").value = player.secondaryPosition || player.position;
  document.getElementById("modal-player-foot").value = player.preferredFoot || "Right";
  document.getElementById("modal-player-notes").value = player.notes || "";

  // Populate chemistry partner checkboxes
  const partnerContainer = document.getElementById("modal-chemistry-partners-list");
  if (partnerContainer) {
    const otherPlayers = db.getAll().filter(p => !playerId || p.id !== playerId);
    partnerContainer.innerHTML = otherPlayers.map(p => {
      const isChecked = (player.chemistryPartners || []).includes(p.id);
      return `
        <label class="flex items-center gap-1.5 p-1 rounded hover:bg-slate-800 cursor-pointer select-none">
          <input type="checkbox" name="modal-chemistry-partner" value="${p.id}" ${isChecked ? 'checked' : ''} class="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500">
          <span class="text-slate-200 truncate text-[11px]">${p.name} (${p.position})</span>
        </label>
      `;
    }).join("");
  }

  const a = player.attributes || { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70, gk: 20 };
  setSliderVal("slider-ovr", player.ovr);
  setSliderVal("slider-pac", a.pac);
  setSliderVal("slider-sho", a.sho);
  setSliderVal("slider-pas", a.pas);
  setSliderVal("slider-dri", a.dri);
  setSliderVal("slider-def", a.def);
  setSliderVal("slider-phy", a.phy);
  setSliderVal("slider-gk", a.gk || 20);

  updateCardPreview();
  modal.classList.remove("hidden");
}

function setSliderVal(id, val) {
  const el = document.getElementById(id);
  const textEl = document.getElementById(`${id}-val`);
  if (el) el.value = val;
  if (textEl) textEl.textContent = val;
}

function updateCardPreview() {
  const name = document.getElementById("modal-player-name").value || "Player Name";
  const pos = document.getElementById("modal-player-pos").value;
  const pac = parseInt(document.getElementById("slider-pac").value, 10);
  const sho = parseInt(document.getElementById("slider-sho").value, 10);
  const pas = parseInt(document.getElementById("slider-pas").value, 10);
  const dri = parseInt(document.getElementById("slider-dri").value, 10);
  const def = parseInt(document.getElementById("slider-def").value, 10);
  const phy = parseInt(document.getElementById("slider-phy").value, 10);
  const gk = parseInt(document.getElementById("slider-gk").value, 10);

  document.getElementById("slider-pac-val").textContent = pac;
  document.getElementById("slider-sho-val").textContent = sho;
  document.getElementById("slider-pas-val").textContent = pas;
  document.getElementById("slider-dri-val").textContent = dri;
  document.getElementById("slider-def-val").textContent = def;
  document.getElementById("slider-phy-val").textContent = phy;
  document.getElementById("slider-gk-val").textContent = gk;

  const autoCalc = document.getElementById("toggle-auto-ovr")?.checked;
  const ovrSlider = document.getElementById("slider-ovr");
  let ovr = parseInt(ovrSlider.value, 10);

  if (autoCalc) {
    ovr = calculateOvr(pos, { pac, sho, pas, dri, def, phy, gk });
    ovrSlider.value = ovr;
    ovrSlider.disabled = true;
  } else {
    ovrSlider.disabled = false;
  }
  document.getElementById("slider-ovr-val").textContent = ovr;

  const preview = document.getElementById("fifa-card-preview");
  if (!preview) return;

  const cardTier = getFifaCardTier(ovr);
  preview.className = `fifa-card card-${cardTier} mx-auto`;
  preview.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <div class="text-3xl font-black leading-none">${ovr}</div>
        <div class="text-sm font-bold tracking-wider uppercase mt-0.5">${pos}</div>
      </div>
      <div class="text-2xl">${pos === 'GK' ? '🧤' : pos === 'DEF' ? '🛡️' : pos === 'MID' ? '⚡' : '⚽'}</div>
    </div>
    
    <div class="my-auto py-2 text-center">
      <div class="text-lg font-black tracking-wide truncate border-b border-current/20 pb-1">${name}</div>
    </div>

    <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-mono font-bold pt-1">
      <div class="flex justify-between"><span>PAC</span><span>${pac}</span></div>
      <div class="flex justify-between"><span>DRI</span><span>${dri}</span></div>
      <div class="flex justify-between"><span>SHO</span><span>${sho}</span></div>
      <div class="flex justify-between"><span>DEF</span><span>${def}</span></div>
      <div class="flex justify-between"><span>PAS</span><span>${pas}</span></div>
      <div class="flex justify-between"><span>PHY</span><span>${phy}</span></div>
    </div>
  `;
}

// ============================================================
// Backup & Export / Import Management
// ============================================================
function setupBackupEvents() {
  document.getElementById("btn-export-json")?.addEventListener("click", () => {
    const data = db.exportJSON();
    downloadFile(data, "football_players_backup.json", "application/json");
    showToast("Downloaded players JSON backup.", "success");
  });

  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    const data = db.exportCSV();
    downloadFile(data, "football_players_backup.csv", "text/csv");
    showToast("Downloaded players CSV spreadsheet.", "success");
  });

  document.getElementById("file-import-json")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = db.importJSON(ev.target.result);
      if (res.success) {
        showToast(`Successfully imported ${res.count} players from JSON!`, "success");
        renderApp();
      } else {
        showToast(`Import failed: ${res.error}`, "error");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("file-import-csv")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = db.importCSV(ev.target.result);
      if (res.success) {
        showToast(`Successfully imported ${res.count} players from CSV with chemistry links!`, "success");
        renderApp();
      } else {
        showToast(`Import failed: ${res.error}`, "error");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("btn-reset-defaults")?.addEventListener("click", () => {
    if (confirm("Reset roster to 24 default players? Any custom players will be replaced.")) {
      db.resetToDefaults();
      state.selectedPlayerIds.clear();
      db.getAll().slice(0, 16).forEach(p => state.selectedPlayerIds.add(p.id));
      renderApp();
      showToast("Reset to default 24 players roster.", "info");
    }
  });

  document.getElementById("btn-clear-all-db")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete ALL players from your database?")) {
      db.clearAll();
      state.selectedPlayerIds.clear();
      renderApp();
      showToast("All player data cleared.", "info");
    }
  });
}

// ============================================================
// Match Day Utilities: WhatsApp Export, Canvas Image, Coin Toss
// ============================================================
function copyWhatsAppLineup() {
  const statsA = calculateTeamStats(state.activeTeamA, state.matchdaySettings);
  const statsB = calculateTeamStats(state.activeTeamB, state.matchdaySettings);

  const formatList = (team) => {
    const sorted = [...team].sort((a, b) => {
      const pMap = { GK: 1, DEF: 2, MID: 3, FWD: 4 };
      return (pMap[a.position] || 5) - (pMap[b.position] || 5);
    });
    return sorted.map(p => {
      const mSetting = state.matchdaySettings[p.id] || { fitness: 100, form: "neutral" };
      const eff = getEffectivePlayerStats(p, mSetting);
      const formText = eff.formMod.icon;
      const fitText = mSetting.fitness < 100 ? `(Fit:${mSetting.fitness}%)` : '';
      return `• [${p.position}] ${p.name} (OVR: ${eff.effectiveOvr}) ${formText} ${fitText}`;
    }).join("\n");
  };

  const aiBriefingText = state.aiCoachBriefing
    ? `\n🎙️ *AI Coach Tactical Preview*:\n"${state.aiCoachBriefing}"\n-----------------------------------------`
    : '';

  const text = `⚽ *MATCHDAY LINEUP & BALANCED TEAMS* ⚽
-----------------------------------------
🔵 *${state.teamAName.toUpperCase()}* (Avg OVR: ${statsA.effectiveAvgOvr})
Tactics: ${state.formationTeamA} ${statsA.synergyCount > 0 ? `| ⚡ ${statsA.synergyCount} Chemistry (+${statsA.synergyBoost} OVR)` : ''}
${formatList(state.activeTeamA)}

🔴 *${state.teamBName.toUpperCase()}* (Avg OVR: ${statsB.effectiveAvgOvr})
Tactics: ${state.formationTeamB} ${statsB.synergyCount > 0 ? `| ⚡ ${statsB.synergyCount} Chemistry (+${statsB.synergyBoost} OVR)` : ''}
${formatList(state.activeTeamB)}
-----------------------------------------${aiBriefingText}
GK Mode: ${state.gkMode === "rotating" ? "🔄 Rotating Goalkeepers" : "🧤 Fixed Dedicated GK"}
Generated with 8x8 Football Team Builder 🏆`;

  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 Formatted lineup copied to clipboard! Ready to paste into WhatsApp.", "success");
  }).catch(() => {
    showToast("Failed to copy automatically. Please check clipboard permissions.", "error");
  });
}

function exportPitchAsImage() {
  const pitch = document.getElementById("soccer-pitch");
  if (!pitch) return;

  showToast("🖼️ Rendering high-resolution pitch image...", "info");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 1200;
  canvas.height = 750;

  // Draw turf stripes
  const stripeWidth = canvas.width / 12;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1b4d2e" : "#235e39";
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, canvas.height);
  }

  // Pitch boundary lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 30);
  ctx.lineTo(canvas.width / 2, canvas.height - 30);
  ctx.stroke();

  // Center circle & spot
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 90, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fill();

  // Penalty boxes
  ctx.strokeRect(30, canvas.height * 0.2, 180, canvas.height * 0.6);
  ctx.strokeRect(canvas.width - 210, canvas.height * 0.2, 180, canvas.height * 0.6);

  // Goal areas
  ctx.strokeRect(30, canvas.height * 0.35, 60, canvas.height * 0.3);
  ctx.strokeRect(canvas.width - 90, canvas.height * 0.35, 60, canvas.height * 0.3);

  // ── Team Name Banners on Left & Right Sides ────────────────
  const CANVAS_COLOR_HEX = {
    blue: "#2563eb",
    red: "#dc2626",
    yellow: "#eab308",
    black: "#111827",
    white: "#f8fafc"
  };

  // Left Side Team Banner (VOYAGERS)
  const colorHexA = CANVAS_COLOR_HEX[state.teamAColor] || "#2563eb";
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.beginPath();
  ctx.roundRect(50, 45, 340, 50, 25);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(80, 70, 10, 0, Math.PI * 2);
  ctx.fillStyle = colorHexA;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`LEFT: ${state.teamAName.toUpperCase()}`, 102, 70);

  // Right Side Team Banner (BOOTS & BEERS)
  const colorHexB = CANVAS_COLOR_HEX[state.teamBColor] || "#dc2626";
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.beginPath();
  ctx.roundRect(canvas.width - 390, 45, 340, 50, 25);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(canvas.width - 80, 70, 10, 0, Math.PI * 2);
  ctx.fillStyle = colorHexB;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(`RIGHT: ${state.teamBName.toUpperCase()}`, canvas.width - 102, 70);

  // Draw Tokens for Team A & Team B from current assignedSlots
  const drawToken = (p, team, xPercent, yPercent) => {
    const x = (xPercent / 100) * (canvas.width - 60) + 30;
    const y = (yPercent / 100) * (canvas.height - 60) + 30;

    const mSetting = state.matchdaySettings[p.id] || { fitness: 100, form: "neutral" };
    const eff = getEffectivePlayerStats(p, mSetting);

    const teamColor = team === "A" ? state.teamAColor : state.teamBColor;
    const fillColor = CANVAS_COLOR_HEX[teamColor] || (team === "A" ? "#2563eb" : "#dc2626");

    // Jersey circle
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = teamColor === "white" ? "#94a3b8" : "#ffffff";
    ctx.stroke();

    // Form icon inside jersey circle
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(eff.formMod.icon, x, y);

    // Name badge below jersey
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    const nameStr = p.name.split(" ")[0];
    ctx.font = "bold 13px sans-serif";
    const textWidth = ctx.measureText(nameStr).width;
    ctx.beginPath();
    ctx.roundRect(x - textWidth / 2 - 8, y + 26, textWidth + 16, 22, 11);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(nameStr, x, y + 37);
  };

  // Render Left Side Tokens (Team A)
  if (state.assignedSlotsA && state.assignedSlotsA.length > 0) {
    state.assignedSlotsA.forEach(({ slot, player }) => {
      const posX = 4 + (slot.y / 100) * 42;
      const posY = slot.x;
      drawToken(player, "A", posX, posY);
    });
  }

  // Render Right Side Tokens (Team B)
  if (state.assignedSlotsB && state.assignedSlotsB.length > 0) {
    state.assignedSlotsB.forEach(({ slot, player }) => {
      const posX = 96 - (slot.y / 100) * 42;
      const posY = slot.x;
      drawToken(player, "B", posX, posY);
    });
  }

  const link = document.createElement("a");
  link.download = `matchday_${state.teamAName}_vs_${state.teamBName}_${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("✅ High-res pitch lineup image downloaded!", "success");
}

function triggerCoinToss() {
  const result = Math.random() < 0.5 ? state.teamAName : state.teamBName;
  showToast(`🪙 Coin Toss: ${result} wins kickoff / choice of side!`, "info");
}

function assignRandomCaptains() {
  if (state.activeTeamA.length === 0 || state.activeTeamB.length === 0) return;
  const capA = state.activeTeamA[Math.floor(Math.random() * state.activeTeamA.length)];
  const capB = state.activeTeamB[Math.floor(Math.random() * state.activeTeamB.length)];
  showToast(`👑 Captains Chosen:\n${state.teamAName}: ${capA.name}\n${state.teamBName}: ${capB.name}`, "info");
}

// ============================================================
// Helper Utilities
// ============================================================
function getFifaCardTier(ovr) {
  if (ovr >= 87) return "special";
  if (ovr >= 80) return "gold";
  if (ovr >= 70) return "silver";
  return "bronze";
}

function getFifaCardTierClass(ovr) {
  if (ovr >= 87) return "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white";
  if (ovr >= 80) return "bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 text-slate-950";
  if (ovr >= 70) return "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-400 text-slate-900";
  return "bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 text-amber-100";
}

function getPositionBadgeClass(pos) {
  switch (pos) {
    case "GK": return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    case "DEF": return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
    case "MID": return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    case "FWD": return "bg-red-500/20 text-red-300 border border-red-500/30";
    default: return "bg-slate-700 text-slate-300";
  }
}

function showToast(message, type = "info") {
  const toast = document.getElementById("toast-notification");
  if (!toast) return;

  const bg = type === "success" ? "bg-emerald-600 border-emerald-400"
    : type === "warning" ? "bg-amber-600 border-amber-400"
    : type === "error" ? "bg-red-600 border-red-400"
    : "bg-blue-600 border-blue-400";

  toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-white font-medium text-sm flex items-center gap-3 border ${bg} transition-all duration-300 transform translate-y-0 opacity-100`;
  toast.innerHTML = `<span>${message}</span>`;

  clearTimeout(window.__toastTimeout);
  window.__toastTimeout = setTimeout(() => {
    toast.className = "hidden";
  }, 4000);
}

function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function renderApp() {
  updateFormationOptions();
  updateActiveTabUI();
}
