# ⚽ 8x8 Football (Soccer) Team Builder

An interactive web application designed to generate perfectly balanced football teams for match day. Built with FIFA-style player cards, customizable tactical attributes, matchday fitness, dynamic form arrows, chemistry synergy duos, and rotating goalkeeper mode.

---

## 🌟 Key Features

1. **Smart Combinatorial Team Balancer**:
   - Computes all $\binom{16}{8} = 12,870$ team combinations in milliseconds.
   - Optimizes for:
     - **Effective Overall Rating Parity** (including Fitness, Form, and Chemistry)
     - **Goalkeeper Equality** (Fixed GK mode or Rotating GK mode)
     - **Positional Balance** (Equal distribution of Defenders, Midfielders, and Forwards)
     - **Attribute Balance** (Pace, Defending, Shooting, Physicality)
   - Provides Top 3 alternative balanced configurations + Re-roll shuffle.

2. **⚡ Player Synergy & Chemistry Duos**:
   - Specify favorite partner duos in the database or spreadsheet.
   - When teammates with chemistry are placed on the same team, their combined effective rating receives a **Synergy Boost** (+1.5 OVR per active duo link).

3. **🔋 Matchday Fitness Level (0%–100%)**:
   - Real-time slider on matchday to simulate tired or injured players.
   - Dynamically scales Physicality (PHY), Pace (PAC), and effective matchday rating.

4. **🔥 Matchday Form Modifiers (FIFA/PES Arrows)**:
   - Cycle through 5 form states:
     - 🔥 **Super Hot (⬆️)**: $+4$ OVR / $+8\%$ stats
     - ⚡ **Good Form (↗️)**: $+2$ OVR / $+4\%$ stats
     - ➡️ **Normal (➡️)**: $+0$
     - 🌧️ **Off Day (↘️)**: $-2$ OVR / $-4\%$ stats
     - ❄️ **Terrible (⬇️)**: $-4$ OVR / $-8\%$ stats

5. **🔄 Rotating Goalkeepers vs. Fixed GK Mode**:
   - **Fixed GK**: Strict 1 dedicated GK per side.
   - **Rotating GK**: All players take turns in goal; balances team defensive floor and outfield strength without forcing a designated GK slot.

6. **🏟️ Interactive 2D Soccer Pitch & Live Swapping**:
   - Authentic turf markings, center circle, and penalty boxes.
   - Dynamic 8v8 formations: `1-3-3-1`, `1-2-4-1`, `1-3-2-2`, `1-2-3-2` (and formations for 5v5 through 11v11).
   - **Click-to-Swap**: Click a player on Voyagers and a player on Boots & Beers to instantly swap them with live stat recalculations.

7. **📊 Side-by-Side FIFA Team Comparison**:
   - Head-to-head comparison bars for Attack, Midfield, Defense, Pace, Physicality, Passing, and Goalkeeping.
   - Active Chemistry Duos summary banner.

8. **💬 Matchday & Sharing Tools**:
   - **Copy to WhatsApp**: Formatted lineup with emojis, player ratings, form arrows, fitness notes, and chemistry links.
   - **Export Pitch Image**: Generates a high-resolution PNG of the pitch lineup.
   - **Coin Toss & Captain Picker**: Matchday kickoff decider tools.

9. **📁 Spreadsheet & CSV / JSON Integration**:
   - Pre-seeded with 24 realistic players across all positions.
   - Shareable Google Sheets / Excel template: `football_players_template.csv`.
   - Full CSV & JSON Backup, Import, and Export.

---

## 🚀 How to Run Locally

You can run the application in any modern web browser using Python's built-in HTTP server:

```bash
# 1. Navigate to the project folder
cd /home/abey/Documents/Football_Team_Builder

# 2. Start a local web server
python3 -m http.server 8000
```

Then open your browser and navigate to:
👉 **`http://localhost:8000`**
