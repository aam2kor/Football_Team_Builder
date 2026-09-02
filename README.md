# ⚽ 8x8 Football (Soccer) Team Builder

An interactive, modern web application designed to generate perfectly balanced football teams for match day. Built with FIFA-style player ratings, multi-sector tactical balancing, customizable sector weights, matchday fitness, dynamic form arrows, chemistry synergy duos, flexible jersey colors, and interactive pitch swapping.

---

## 🌟 Key Features

### 1. 🎯 Smart Multi-Sector Combinatorial Team Balancer
- Computes and evaluates all combinations in milliseconds ($\binom{16}{8} = 12,870$ splits for 8v8).
- Balances teams across **3 primary tactical sectors simultaneously**:
  - **⚔️ Attacking Power (ATT)**: Shooting, Dribbling, and Pace weighted heavily by Forward and Midfield roles.
  - **⚙️ Midfield Control (MID)**: Passing, Vision, Dribbling, and defensive work rate.
  - **🛡️ Defensive Strength (DEF & GK)**: Outfield Defending + Physicality ($65\%$) blended with Goalkeeper shot-stopping ($35\%$).
- Also optimizes:
  - **Effective Overall Rating Parity** (including Fitness, Form modifiers, and Chemistry boosts).
  - **Goalkeeper Parity** (Dedicated GK vs. Rotating GK mode).
  - **Positional Count Balance** (even distribution of DEF, MID, FWD across teams).

---

### 2. ⚙️ Advanced Sector Weights Configurator
Expand the **⚙️ Advanced Sector Weights** panel to customize the engine's internal weights:
- **Attribute Weights**: Adjust the importance of PAC, SHO, PAS, DRI, DEF, PHY per sector.
- **Positional Weights**: Tune how heavily FWD, MID, DEF, and GK roles contribute to Attack, Midfield, and Defense.
- **GK Blend %**: Set how much Goalkeeper shot-stopping contributes to the defensive sector rating ($0\%\text{–}100\%$, default $35\%$).
- **Penalty Multipliers**: Adjust the priority weights given to balancing OVR ($\times 22.0$), DEF ($\times 9.0$), ATT ($\times 8.0$), and MID ($\times 7.0$).
- **Persistence & Reset**: Automatically saves to `localStorage`; includes per-sector **↺ Reset** and global **↺ Reset All** buttons.

---

### 3. 🏟️ Interactive Match Pitch Visualizer & Swapping
- **2-Click Live Swapping**:
  - **Within-Team Position Swap**: Click two players on the *same team* to immediately swap their tactical pitch slots (e.g. moving a Striker to Centre-Back).
  - **Cross-Team Swap**: Click a player on Voyagers and a player on Boots & Beers to move them to the opposite team with live stat recalculations.
- **🎨 5 Selectable Team Jersey Colors**:
  - Choose between 🔵 **Blue**, 🔴 **Red**, 🟡 **Yellow**, ⚫ **Black**, and ⚪ **White** for either team.
  - Goalkeepers wear the matching team color for a unified team kit look.
- **📛 Clean Token Display**: Pitch tokens show the player's **First Name** and active **Matchday Form Arrow** (numerical ratings are hidden on the pitch for a clean broadcast visual).
- **🏷️ Team Side Watermarks**: Clearly indicates the **LEFT** team (*Voyagers*) and **RIGHT** team (*Boots & Beers*) with active kit color badges on the turf.

---

### 4. ⚡ Matchday Dynamics & Chemistry
- **🔋 Matchday Fitness Slider (0%–100%)**: Dynamically scales Physicality (PHY), Pace (PAC), and effective matchday rating for tired or recovering players.
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

### 5. 📊 Side-by-Side Head-to-Head Comparison Dashboard
- **Team Overview Cards**: Displays effective average OVR, chemistry links, positional counts, and full matchday rosters.
- **7 Head-to-Head Comparison Bars**:
  - **Highlighted Primary Sectors**: ⚔️ Attack (ATT), ⚙️ Midfield (MID), 🛡️ Defense & GK (DEF).
  - **Technical & Physical Metrics**: ⚡ Pace (PAC), 💪 Physical (PHY), 🎯 Passing (PAS), 🧤 GK Shot-Stopping.

---

### 6. 💬 Matchday & Sharing Tools
- **📋 Copy to WhatsApp**: One-click formatted match report with team names, tactical formations, emojis, player ratings, form arrows, and chemistry links.
- **📸 Export Pitch Image**: Generates and downloads a high-resolution PNG image of the pitch lineup with team side banners and custom kit colors.
- **🪙 Coin Toss & 👑 Random Captains**: Instant matchday kickoff decider and captain selector.
- **📁 CSV / JSON Database**: Pre-seeded with 24 realistic players, with import/export tools and a shareable spreadsheet template (`football_players_template.csv`).

---

### 7. 🤖 AI Coach Prompt & Local LLM Integration (`qwen2.5-coder:1.5b`)
- **🔍 Two Distinct AI Workflows**:
  - **Option 1: 🔍 Review & Refine Draft with AI (Math Draft ➔ AI Tactical Review & Adjustments)**:
    - The mathematical balancer first creates an optimal baseline draft.
  - Interactive Connection Status indicator (`🟢 Online` / `🔴 Offline`) and built-in **⚙️ AI Model Settings Modal** with live connection testing.
- **🎙️ Pre-Match AI Tactical Briefing & Swaps Changelog**:
  - Displays a pre-match scout report, tactical commentary, and a dedicated changelog of any adjustments made to the draft.

---

### 8. 🏆 Third Half United League Live API & AI Historical Insights
- **📡 Live Public API Integration**:
  - Connects to `https://thirdhalfutdleague.lovable.app/api/public/matches` with automatic `localStorage` caching and offline resilience.
- **💡 AI Historical League Insights**:
  - Click **💡 AI League Insights** to have **`qwen2.5-coder:1.5b`** analyze historical scorelines, momentum streaks, player impact (e.g. *Mathai's undefeated 3-game run*), and tactical evolution over the season.
- **🧠 Historical Match Context in AI Coach**:
  - The AI Coach automatically receives recent league results and H2H records in its context, allowing it to generate pre-match narratives referencing previous derbies and revenge factors!

---

## 🚀 How to Run Locally

The application runs directly in any modern web browser using Python's built-in HTTP server (no Node.js build step required):

```bash
# 1. Navigate to the project directory
cd /home/abey/Documents/Football_Team_Builder

# 2. Start the local server
python3 -m http.server 8000
```

Open your browser and navigate to:
👉 **`http://localhost:8000`**

---

## 🧪 Automated Test Suite

Run the full verification test suite (verifying fitness scaling, chemistry bonuses, multi-sector balance, and combinatorial engine):

```bash
python3 tests/run_tests.py
```
