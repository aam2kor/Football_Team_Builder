import { SAMPLE_PLAYERS } from "../data/samplePlayers.js";

const STORAGE_KEY = "football_team_builder_players_v2";

/**
 * Calculates recommended FIFA-style OVR rating from individual attributes based on position.
 */
export function calculateOvr(arg1, arg2) {
  let position = typeof arg1 === "string" ? arg1 : (typeof arg2 === "string" ? arg2 : "MID");
  let attributes = typeof arg1 === "object" && arg1 !== null ? arg1 : (typeof arg2 === "object" && arg2 !== null ? arg2 : {});
  
  const {
    pac = 70,
    sho = 70,
    pas = 70,
    dri = 70,
    def = 70,
    phy = 70,
    gk = 50
  } = attributes;

  let ovr = 75;
  switch (position) {
    case "GK":
      ovr = gk * 0.70 + phy * 0.15 + pas * 0.10 + pac * 0.05;
      break;
    case "DEF":
      ovr = def * 0.45 + phy * 0.25 + pac * 0.15 + pas * 0.15;
      break;
    case "MID":
      ovr = pas * 0.30 + dri * 0.25 + pac * 0.20 + def * 0.15 + sho * 0.10;
      break;
    case "FWD":
      ovr = sho * 0.40 + pac * 0.25 + dri * 0.20 + phy * 0.15;
      break;
    default:
      ovr = (pac + sho + pas + dri + def + phy) / 6;
  }
  return Math.max(40, Math.min(99, Math.round(ovr)));
}

/**
 * Database manager using browser LocalStorage
 */
export class PlayerDatabase {
  constructor() {
    this.players = [];
    this.init();
  }

  init() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.players = parsed;
        } else {
          this.resetToDefaults();
        }
      } else {
        this.resetToDefaults();
      }
    } catch (e) {
      console.warn("Could not load from localStorage, initializing with defaults", e);
      this.players = JSON.parse(JSON.stringify(SAMPLE_PLAYERS));
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.players));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  }

  getAll() {
    return this.players.map(p => ({
      ...p,
      attributes: { ...(p.attributes || {}) },
      chemistryPartners: [...(p.chemistryPartners || [])]
    }));
  }

  get(idOrName) {
    if (!idOrName) return null;
    return this.getById(idOrName) || this.getByName(idOrName);
  }

  getById(id) {
    const p = this.players.find(p => p.id === id);
    if (!p) return null;
    return {
      ...p,
      attributes: { ...(p.attributes || {}) },
      chemistryPartners: [...(p.chemistryPartners || [])]
    };
  }

  getByName(name) {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    const p = this.players.find(p => p.name.toLowerCase().trim() === lower);
    if (!p) return null;
    return {
      ...p,
      attributes: { ...(p.attributes || {}) },
      chemistryPartners: [...(p.chemistryPartners || [])]
    };
  }

  update(id, updates = {}) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const current = this.players[idx];
    const updated = {
      ...current,
      ...updates,
      attributes: {
        ...(current.attributes || {}),
        ...(updates.attributes || {})
      },
      chemistryPartners: Array.isArray(updates.chemistryPartners)
        ? [...updates.chemistryPartners]
        : (current.chemistryPartners || [])
    };
    if (updates.ovr !== undefined) {
      updated.ovr = Number(updates.ovr);
    }
    this.players[idx] = updated;
    this.save();
    return updated;
  }

  savePlayer(playerData) {
    const isNew = !playerData.id || !this.players.some(p => p.id === playerData.id);
    
    // Ensure valid attributes
    const attributes = {
      pac: Number(playerData.attributes?.pac) || 70,
      sho: Number(playerData.attributes?.sho) || 70,
      pas: Number(playerData.attributes?.pas) || 70,
      dri: Number(playerData.attributes?.dri) || 70,
      def: Number(playerData.attributes?.def) || 70,
      phy: Number(playerData.attributes?.phy) || 70,
      gk: Number(playerData.attributes?.gk) || (playerData.position === "GK" ? 80 : 15),
    };

    // Calculate or preserve OVR
    const ovr = playerData.ovr 
      ? Number(playerData.ovr) 
      : calculateOvr(playerData.position || "MID", attributes);

    const position = playerData.position || "MID";
    const avatar = playerData.avatar || (
      position === "GK" ? "🧤" :
      position === "DEF" ? "🛡️" :
      position === "MID" ? "⚡" : "⚽"
    );

    const player = {
      id: isNew ? "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5) : playerData.id,
      name: (playerData.name || "Unnamed Player").trim(),
      position: position,
      secondaryPosition: playerData.secondaryPosition || position,
      ovr: Math.max(1, Math.min(99, ovr)),
      attributes: attributes,
      avatar: avatar,
      preferredFoot: playerData.preferredFoot || "Right",
      notes: (playerData.notes || "").trim(),
      chemistryPartners: Array.isArray(playerData.chemistryPartners) ? playerData.chemistryPartners : []
    };

    if (isNew) {
      this.players.unshift(player);
    } else {
      const idx = this.players.findIndex(p => p.id === player.id);
      if (idx !== -1) {
        this.players[idx] = player;
      }
    }

    this.save();
    return player;
  }

  deletePlayer(id) {
    const initialLen = this.players.length;
    this.players = this.players.filter(p => p.id !== id);
    // Also remove from other players' chemistry links
    this.players.forEach(p => {
      if (p.chemistryPartners && p.chemistryPartners.includes(id)) {
        p.chemistryPartners = p.chemistryPartners.filter(cid => cid !== id);
      }
    });

    if (this.players.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  resetToDefaults() {
    this.players = JSON.parse(JSON.stringify(SAMPLE_PLAYERS));
    this.save();
    return this.players;
  }

  clearAll() {
    this.players = [];
    this.save();
  }

  exportJSON() {
    return JSON.stringify(this.players, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) throw new Error("Import data must be an array of players");
      
      const validated = parsed.map(p => {
        if (!p.name) throw new Error("Each player must have a name");
        return {
          id: p.id || "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
          name: p.name.trim(),
          position: ["GK", "DEF", "MID", "FWD"].includes(p.position) ? p.position : "MID",
          secondaryPosition: p.secondaryPosition || p.position || "MID",
          ovr: Math.max(1, Math.min(99, Number(p.ovr) || 75)),
          attributes: {
            pac: Number(p.attributes?.pac) || 70,
            sho: Number(p.attributes?.sho) || 70,
            pas: Number(p.attributes?.pas) || 70,
            dri: Number(p.attributes?.dri) || 70,
            def: Number(p.attributes?.def) || 70,
            phy: Number(p.attributes?.phy) || 70,
            gk: Number(p.attributes?.gk) || 20,
          },
          avatar: p.avatar || "⚽",
          preferredFoot: p.preferredFoot || "Right",
          notes: (p.notes || "").trim(),
          chemistryPartners: Array.isArray(p.chemistryPartners) ? p.chemistryPartners : []
        };
      });

      this.players = validated;
      this.save();
      return { success: true, count: validated.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  exportCSV() {
    const headers = [
      "Name", "PrimaryPosition", "SecondaryPosition", "OVR",
      "PAC", "SHO", "PAS", "DRI", "DEF", "PHY", "GK",
      "PreferredFoot", "ChemistryPartners", "Notes"
    ];

    const rows = this.players.map(p => {
      // Map partner IDs to Names for human readability in spreadsheet
      const partnerNames = (p.chemistryPartners || [])
        .map(id => this.getById(id)?.name || id)
        .join("; ");

      return [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.position,
        p.secondaryPosition || p.position,
        p.ovr,
        p.attributes.pac,
        p.attributes.sho,
        p.attributes.pas,
        p.attributes.dri,
        p.attributes.def,
        p.attributes.phy,
        p.attributes.gk,
        p.preferredFoot,
        `"${partnerNames.replace(/"/g, '""')}"`,
        `"${(p.notes || '').replace(/"/g, '""')}"`
      ];
    });

    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  }

  importCSV(csvString) {
    try {
      const lines = csvString.trim().split(/\r?\n/);
      if (lines.length < 2) throw new Error("CSV file is empty or missing headers");

      const rawParsed = [];
      const headerLine = lines[0].toLowerCase();
      const delimiter = headerLine.includes(";") ? ";" : headerLine.includes("\t") ? "\t" : ",";

      // Detect header index mapping
      const headers = lines[0].split(delimiter).map(h => h.replace(/^["'\s]+|["'\s]+$/g, "").toLowerCase());
      
      const getColIdx = (aliases) => {
        for (const alias of aliases) {
          const idx = headers.findIndex(h => h === alias || h.includes(alias));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idxName = getColIdx(["name", "player"]);
      const idxPos = getColIdx(["primaryposition", "position", "pos"]);
      const idxSecPos = getColIdx(["secondaryposition", "secondary", "secpos"]);
      const idxOvr = getColIdx(["ovr", "overall", "rating"]);
      const idxPac = getColIdx(["pac", "pace", "speed"]);
      const idxSho = getColIdx(["sho", "shooting", "shot"]);
      const idxPas = getColIdx(["pas", "passing", "pass"]);
      const idxDri = getColIdx(["dri", "dribbling", "dribble"]);
      const idxDef = getColIdx(["def", "defending", "defense"]);
      const idxPhy = getColIdx(["phy", "physical", "physicality", "stamina"]);
      const idxGk = getColIdx(["gk", "goalkeeping", "keeper"]);
      const idxFoot = getColIdx(["preferredfoot", "foot"]);
      const idxChem = getColIdx(["chemistrypartners", "chemistry", "partner", "synergy"]);
      const idxNotes = getColIdx(["notes", "comment", "description"]);

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#") || line.startsWith("//")) continue;

        // Parse delimited line respecting quotes
        const match = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(delimiter);
        const rawFields = match.map(v => v.replace(/^["'\s]+|["'\s]+$/g, "").trim());
        
        const name = (idxName !== -1 ? rawFields[idxName] : rawFields[0]) || "";
        if (!name || name.toLowerCase().includes("example") || name.toLowerCase().includes("instructions")) continue;

        const rawPos = (idxPos !== -1 ? rawFields[idxPos] : rawFields[1]) || "MID";
        const cleanPos = rawPos.toUpperCase().trim();
        const position = ["GK", "DEF", "MID", "FWD"].includes(cleanPos) ? cleanPos : (
          cleanPos.includes("GOAL") || cleanPos.includes("KEEP") ? "GK" :
          cleanPos.includes("BACK") || cleanPos.includes("DEF") ? "DEF" :
          cleanPos.includes("ATT") || cleanPos.includes("STRIK") || cleanPos.includes("FWD") ? "FWD" : "MID"
        );

        const rawSec = (idxSecPos !== -1 ? rawFields[idxSecPos] : rawFields[2]) || position;
        const cleanSec = rawSec.toUpperCase().trim();
        const secondaryPosition = ["GK", "DEF", "MID", "FWD"].includes(cleanSec) ? cleanSec : position;

        const pac = Number(idxPac !== -1 ? rawFields[idxPac] : rawFields[4]) || 70;
        const sho = Number(idxSho !== -1 ? rawFields[idxSho] : rawFields[5]) || 70;
        const pas = Number(idxPas !== -1 ? rawFields[idxPas] : rawFields[6]) || 70;
        const dri = Number(idxDri !== -1 ? rawFields[idxDri] : rawFields[7]) || 70;
        const def = Number(idxDef !== -1 ? rawFields[idxDef] : rawFields[8]) || 70;
        const phy = Number(idxPhy !== -1 ? rawFields[idxPhy] : rawFields[9]) || 70;
        const gk = Number(idxGk !== -1 ? rawFields[idxGk] : rawFields[10]) || (position === "GK" ? 80 : 20);
        
        const attributes = { pac, sho, pas, dri, def, phy, gk };
        
        const rawOvr = Number(idxOvr !== -1 ? rawFields[idxOvr] : rawFields[3]);
        const ovr = (rawOvr && rawOvr > 0) ? rawOvr : calculateOvr(position, attributes);

        const preferredFoot = (idxFoot !== -1 ? rawFields[idxFoot] : rawFields[11]) || "Right";
        const rawChem = idxChem !== -1 ? rawFields[idxChem] : "";
        const notes = (idxNotes !== -1 ? rawFields[idxNotes] : rawFields[13]) || "";

        rawParsed.push({
          id: "p_" + Date.now() + "_" + i + "_" + Math.random().toString(36).substr(2, 4),
          name: name,
          position: position,
          secondaryPosition: secondaryPosition,
          ovr: Math.max(1, Math.min(99, ovr)),
          attributes: attributes,
          avatar: position === "GK" ? "🧤" : position === "DEF" ? "🛡️" : position === "MID" ? "⚡" : "⚽",
          preferredFoot: preferredFoot,
          notes: notes,
          rawChemStr: rawChem,
          chemistryPartners: []
        });
      }

      if (rawParsed.length === 0) throw new Error("No valid player rows found in CSV");

      // Resolve partner names to player IDs
      rawParsed.forEach(player => {
        if (player.rawChemStr) {
          const names = player.rawChemStr.split(/[;,]/).map(n => n.trim().toLowerCase()).filter(Boolean);
          names.forEach(targetName => {
            const found = rawParsed.find(other => other.name.toLowerCase().trim() === targetName || other.id === targetName);
            if (found && found.id !== player.id && !player.chemistryPartners.includes(found.id)) {
              player.chemistryPartners.push(found.id);
            }
          });
        }
        delete player.rawChemStr;
      });

      this.players = rawParsed;
      this.save();
      return { success: true, count: rawParsed.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
