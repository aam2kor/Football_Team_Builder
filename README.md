# ⚽ 8x8 Football (Soccer) Team Builder

An interactive, modern web application designed to generate perfectly balanced football teams for match day. Built with FIFA-style player ratings, multi-sector tactical balancing, customizable sector weights, matchday fitness, dynamic form arrows, chemistry synergy duos, flexible jersey colors, interactive pitch swapping, and local AI Coach integration (`qwen2.5-coder:1.5b` via Ollama) with live league sync.

---

## 🌟 Key Features

### 1. 🎯 Smart Multi-Sector Combinatorial Team Balancer
- Computes and evaluates all combinations in milliseconds ($\binom{16}{8} = 12,870$ splits for 8v8, scalable from 5v5 up to 11v11).
- Balances teams across **3 primary tactical sectors simultaneously**:
  - **⚔️ Attacking Power (ATT)**: Shooting, Dribbling, and Pace weighted heavily by Forward and Midfield roles.
  - **⚙️ Midfield Control (MID)**: Passing, Vision, Dribbling, and defensive work rate.
  - **🛡️ Defensive Strength (DEF & GK)**: Outfield Defending + Physicality ($65\%$) blended with Goalkeeper shot-stopping ($35\%$).
- Also optimizes:
  - **Effective Overall Rating Parity** (including Fitness, Form modifiers, and Chemistry boosts).
  - **Goalkeeper Parity** (Dedicated GK vs. Rotating GK mode).
  - **Positional Count Balance** (even distribution of DEF, MID, FWD across teams).
  - **Database Position Isolation**: Balancing algorithms always evaluate players using their true database natural positions; on-pitch tactical tweaks are isolated for visual analysis.

---

### 2. ⚙️ Advanced Sector Weights Equalizer
Expand the **⚙️ Advanced Sector Weights** panel to customize the engine's internal weights:
- **Attribute Weights**: Adjust the importance of PAC, SHO, PAS, DRI, DEF, PHY per sector.
- **Positional Weights**: Dynamically tune how heavily FWD, MID, DEF, and GK roles contribute to Attack, Midfield, and Defense.
- **GK Blend %**: Set how much Goalkeeper shot-stopping contributes to the defensive sector rating ($0\%\text{–}100\%$, default $35\%$).
- **Penalty Multipliers**: Adjust the priority weights given to balancing OVR ($\times 22.0$), DEF ($\times 9.0$), ATT ($\times 8.0$), and MID ($\times 7.0$).
- **Persistence & Reset**: Automatically saves to `localStorage`; includes per-sector **↺ Reset** and global **↺ Reset All** buttons.

---

### 3. 🏟️ Interactive Match Pitch Visualizer & Tactical Swapping
- **2-Click Live Swapping**:
  - **Within-Team Position Swap**: Click two players on the *same team* to immediately swap their tactical pitch slots (e.g. moving a Striker to Centre-Back) with automatic sectoral recalculation.
  - **Cross-Team Swap**: Click a player on Voyagers and a player on Boots & Beers to move them to the opposite team with live stat recalculations.
- **🎨 5 Selectable Team Jersey Colors**:
  - Choose between 🔵 **Blue**, 🔴 **Red**, 🟡 **Yellow**, ⚫ **Black**, and ⚪ **White** for either team.
  - Goalkeepers wear matching team colors for a clean, unified team kit look.
- **📛 High-Visibility Player Badges**: High-contrast, bold name badges (`13.5px` bold) and form arrows designed for crisp readability on mobile and desktop.
- **📱 Mobile Responsive Pitch**: Dedicated `@media (max-width: 640px)` stylesheet ensuring a comfortable `350px` pitch height with clear tactical spacing.
- **🏷️ Team Side Watermarks**: Clearly indicates the **LEFT** team (*Voyagers*) and **RIGHT** team (*Boots & Beers*) with active kit color badges on the turf.

---

### 4. 🎴 Aesthetic Matchday Player Selection Tiles
- **Spacious & High-Contrast Design**: Large, elegant glassmorphism player tiles with rich FIFA-style tier accents (Gold, Silver, Bronze, and Special Iridescent).
- **🔋 Matchday Fitness Slider (20%–100%)**: Dynamically scales Physicality (PHY), Pace (PAC), and effective matchday rating for tired or recovering players, with quick preset pills (`100%`, `75%`, `50%`).
- **🔥 Matchday Form Modifiers (FIFA/PES Arrows)**:
  - 🔥 **Super Hot (⬆️)**: $+4$ OVR / $+8\%$ stats
  - ⚡ **Good Form (↗️)**: $+2$ OVR / $+4\%$ stats
  - ➡️ **Normal (➡️)**: $+0$
  - 🌧️ **Off Day (↘️)**: $-2$ OVR / $-4\%$ stats
  - ❄️ **Terrible (⬇️)**: $-4$ OVR / $-8\%$ stats
- **🤝 Player Synergy & Chemistry Duos**: Pair favorite teammates in the roster database; when assigned to the same team, they trigger a **Chemistry Boost** ($+1.5$ OVR per active duo link).
- **🧤 Flexible Goalkeeper Rules**:
  - **Fixed Dedicated GK**: Strict 1 GK per side; GK shot-stopping is blended into the defensive score.
  - **Rotating GKs**: All players share goalkeeper duties; balances outfield strength without forcing a fixed keeper slot.

---

### 5. 🤖 Dual AI Engine: Google Gemini & Local Ollama (`qwen2.5-coder:1.5b`)
- **🔄 Seamless Provider Toggle**: Switch instantly between **✨ Google Gemini** (e.g. `gemini-2.5-flash`, `gemini-2.5-pro`) and **🖥️ Local Ollama** (`qwen2.5-coder:1.5b`) directly in the in-app AI settings.
- **✨ Google Gemini Integration**:
  - Uses native structured JSON schema (`responseSchema` & `responseMimeType: "application/json"`) for 100% deterministic outputs.
  - Securely saved API key in browser `localStorage` or optional `GEMINI_API_KEY` environment variable in `server.py`.
- **⚡ Built-in Zero-Config Proxies**: `server.py` provides built-in proxy routes for both Ollama (`/api/ollama/*`) and Google Gemini (`/api/gemini/*`), eliminating CORS barriers.
- **🔍 Two Distinct AI Workflows**:
  - **1. Review & Refine Draft with AI (Draft-First)**:
    - The mathematical balancer first creates an optimal baseline draft.
    - AI Coach reviews the draft against your tactical prompt (e.g. *"Make Voyagers more counter-attacking"* or *"Swap Abey to Boots & Beers"*), executing proactive, balanced player swaps.
    - **Strict Player Universe Restriction**: AI prompt filtering strictly guarantees that only active squad players are analyzed and swapped (zero hallucinations).
  - **2. Build Teams with AI Coach (Constraint-First)**:
    - AI Coach extracts hard pinning, separation, and pairing constraints directly from natural language before feeding them into the combinatorial engine.
- **🎙️ Pre-Match AI Tactical Briefing & Swaps Changelog**:
  - Displays a pre-match scout report, tactical commentary, and a dedicated visual changelog of player swaps.
- **⚙️ Interactive Model Settings Modal**:
  - Live status indicator (`🟢 Online` / `🔴 Offline`) with live connection testing, provider tabs, and customizable model tags.

---

### 6. 🏆 Third Half United League Live API & AI Historical Insights
- **📡 Live Public API Integration**:
  - Connects to `https://thirdhalfutdleague.lovable.app/api/public/matches` via local caching & CORS-free proxy in `server.py`.
  - **Instant ~28ms Response**: Startup pre-fetching and in-memory TTL caching provide sub-millisecond sync speed.
  - **Full 2026 Season Matches**: Includes all 4 live fixtures (up to September 2, 2026: Voyagers 2 – 3 Boots & Beers).
- **💡 AI Historical League Insights**:
  - Click **💡 AI League Insights** to have **`qwen2.5-coder:1.5b`** analyze historical scorelines, momentum streaks, top goalscorers (Vinay, Sreekanth, CP), and derby narratives.
- **🧠 Squad-Filtered Match Context**:
  - Top scorers, winners, and recent form in the AI context are automatically filtered to only the players present in today's matchday roster.

---

### 7. 📊 Side-by-Side Head-to-Head Comparison Dashboard
- **Team Overview Cards**: Displays effective average OVR, chemistry links, positional counts, and full matchday rosters.
- **7 Head-to-Head Comparison Bars**:
  - **Highlighted Primary Sectors**: ⚔️ Attack (ATT), ⚙️ Midfield (MID), 🛡️ Defense & GK (DEF).
  - **Technical & Physical Metrics**: ⚡ Pace (PAC), 💪 Physical (PHY), 🎯 Passing (PAS), 🧤 GK Shot-Stopping.

---

### 8. 💬 Matchday & Sharing Tools
- **📋 Copy to WhatsApp**: One-click formatted match report with team names, tactical formations, emojis, player ratings, form arrows, and chemistry links.
- **📸 Export Pitch Image**: Generates and downloads a high-resolution PNG image of the pitch lineup with team side banners and custom kit colors.
- **🪙 Coin Toss & 👑 Random Captains**: Instant matchday kickoff decider and captain selector.
- **📁 CSV / JSON Database**: Pre-seeded with 24 realistic players, with import/export tools and a shareable spreadsheet template (`football_players_template.csv`).

---

## 🚀 How to Run Locally

Start the development server using Python (no Node.js build step or external dependencies required):

```bash
# 1. Navigate to the project directory
cd /home/abey/Documents/Football_Team_Builder

# 2. Start the high-performance development server
python3 server.py
```

Open your browser and navigate to:
👉 **`http://localhost:8000`**

> **Note on AI & League Sync**:
> Running `python3 server.py` automatically activates the built-in CORS-free proxies for both the **Third Half United League API** (`/api/matches`) and your local **Ollama instance** (`/api/ollama/*`), ensuring all features work out-of-the-box.

---

## 🧪 Automated Test Suite

Run the verification test suites to validate engine balancing, fitness scaling, chemistry bonuses, and league analytics:

```bash
# Run Core Engine & AI Balancer Tests
python3 tests/run_tests.py

# Run League History & API Service Tests
python3 tests/test_league_service.py
```
