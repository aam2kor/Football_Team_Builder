/**
 * Pre-seeded sample database of 24 realistic football players
 * with FIFA-style attributes (1-99), positions, and chemistry partner duos.
 */
export const SAMPLE_PLAYERS = [
  // --- GOALKEEPERS (GK) ---
  {
    id: "p1",
    name: "Marcus Vance",
    position: "GK",
    secondaryPosition: "DEF",
    ovr: 85,
    attributes: { pac: 58, sho: 30, pas: 68, dri: 52, def: 45, phy: 82, gk: 87 },
    avatar: "🧤",
    preferredFoot: "Right",
    notes: "Great shot stopper, solid command of the box",
    chemistryPartners: ["p4", "p6"] // Great chemistry with CBs Carlos Mendoza & Sami
  },
  {
    id: "p2",
    name: "Hugo De Silva",
    position: "GK",
    secondaryPosition: "DEF",
    ovr: 82,
    attributes: { pac: 60, sho: 25, pas: 74, dri: 55, def: 40, phy: 78, gk: 83 },
    avatar: "🧤",
    preferredFoot: "Left",
    notes: "Modern sweeper keeper with good distribution",
    chemistryPartners: ["p5", "p7"] // Good distribution with fullbacks Trent & Diego
  },
  {
    id: "p3",
    name: "Liam O'Connor",
    position: "GK",
    secondaryPosition: "DEF",
    ovr: 76,
    attributes: { pac: 52, sho: 20, pas: 62, dri: 45, def: 38, phy: 75, gk: 78 },
    avatar: "🧤",
    preferredFoot: "Right",
    notes: "Reliable reflex keeper, vocal organizer",
    chemistryPartners: ["p8"]
  },

  // --- DEFENDERS (DEF) ---
  {
    id: "p4",
    name: "Carlos Mendoza",
    position: "DEF",
    secondaryPosition: "MID",
    ovr: 86,
    attributes: { pac: 78, sho: 55, pas: 76, dri: 72, def: 88, phy: 86, gk: 25 },
    avatar: "🛡️",
    preferredFoot: "Right",
    notes: "Dominant center back, strong in air and tackles",
    chemistryPartners: ["p1", "p6", "p11"] // Strong duo with CB Sami and CDM Mateo
  },
  {
    id: "p5",
    name: "Trent Walker",
    position: "DEF",
    secondaryPosition: "MID",
    ovr: 84,
    attributes: { pac: 85, sho: 68, pas: 83, dri: 80, def: 81, phy: 78, gk: 20 },
    avatar: "⚡",
    preferredFoot: "Right",
    notes: "Attacking wing-back with deadly crossing",
    chemistryPartners: ["p10", "p18"] // Deadly crossing link to striker Rafael Santos
  },
  {
    id: "p6",
    name: "Sami Al-Khatib",
    position: "DEF",
    secondaryPosition: "DEF",
    ovr: 81,
    attributes: { pac: 74, sho: 48, pas: 72, dri: 68, def: 84, phy: 84, gk: 18 },
    avatar: "🧱",
    preferredFoot: "Left",
    notes: "No-nonsense physical center-back",
    chemistryPartners: ["p4", "p15"]
  },
  {
    id: "p7",
    name: "Diego Rossi",
    position: "DEF",
    secondaryPosition: "MID",
    ovr: 79,
    attributes: { pac: 80, sho: 58, pas: 75, dri: 74, def: 80, phy: 76, gk: 20 },
    avatar: "🏃",
    preferredFoot: "Left",
    notes: "Tenacious left-back, quick recovery pace",
    chemistryPartners: ["p12", "p20"]
  },
  {
    id: "p8",
    name: "Jonas Richter",
    position: "DEF",
    secondaryPosition: "MID",
    ovr: 77,
    attributes: { pac: 71, sho: 50, pas: 70, dri: 66, def: 79, phy: 82, gk: 15 },
    avatar: "🛡️",
    preferredFoot: "Right",
    notes: "Solid positional defender and aerial threat",
    chemistryPartners: ["p3", "p15"]
  },
  {
    id: "p9",
    name: "Kofi Mensah",
    position: "DEF",
    secondaryPosition: "DEF",
    ovr: 74,
    attributes: { pac: 79, sho: 42, pas: 65, dri: 67, def: 75, phy: 79, gk: 18 },
    avatar: "🏃",
    preferredFoot: "Right",
    notes: "Fast full-back with tireless work ethic",
    chemistryPartners: ["p16"]
  },

  // --- MIDFIELDERS (MID) ---
  {
    id: "p10",
    name: "Lucas Romero",
    position: "MID",
    secondaryPosition: "FWD",
    ovr: 88,
    attributes: { pac: 82, sho: 83, pas: 89, dri: 88, def: 72, phy: 79, gk: 15 },
    avatar: "🎯",
    preferredFoot: "Right",
    notes: "Playmaker maestro, exquisite vision and passing",
    chemistryPartners: ["p18", "p19", "p5"] // Playmaker synergy with strikers Rafael & Julian
  },
  {
    id: "p11",
    name: "Mateo Kovacic",
    position: "MID",
    secondaryPosition: "DEF",
    ovr: 85,
    attributes: { pac: 79, sho: 74, pas: 86, dri: 86, def: 80, phy: 82, gk: 18 },
    avatar: "⚙️",
    preferredFoot: "Right",
    notes: "Box-to-box engine, excels in transitions",
    chemistryPartners: ["p4", "p13"] // Midfield engine tandem with Nico Barella
  },
  {
    id: "p12",
    name: "Hakim Sterling",
    position: "MID",
    secondaryPosition: "FWD",
    ovr: 84,
    attributes: { pac: 89, sho: 80, pas: 81, dri: 87, def: 55, phy: 73, gk: 15 },
    avatar: "⚡",
    preferredFoot: "Right",
    notes: "Pacy winger with creative dribbling",
    chemistryPartners: ["p21", "p7"]
  },
  {
    id: "p13",
    name: "Nico Barella",
    position: "MID",
    secondaryPosition: "DEF",
    ovr: 83,
    attributes: { pac: 81, sho: 76, pas: 83, dri: 82, def: 78, phy: 84, gk: 20 },
    avatar: "🔥",
    preferredFoot: "Right",
    notes: "High stamina, aggressive presser, dynamic runs",
    chemistryPartners: ["p11", "p19"]
  },
  {
    id: "p14",
    name: "Arda Guler",
    position: "MID",
    secondaryPosition: "FWD",
    ovr: 80,
    attributes: { pac: 78, sho: 79, pas: 84, dri: 85, def: 50, phy: 68, gk: 15 },
    avatar: "🪄",
    preferredFoot: "Left",
    notes: "Silky technician, set-piece specialist",
    chemistryPartners: ["p20", "p22"]
  },
  {
    id: "p15",
    name: "Viktor Lind",
    position: "MID",
    secondaryPosition: "DEF",
    ovr: 78,
    attributes: { pac: 73, sho: 70, pas: 79, dri: 76, def: 77, phy: 80, gk: 22 },
    avatar: "⚓",
    preferredFoot: "Right",
    notes: "Disciplined holding midfielder, shields backline",
    chemistryPartners: ["p6", "p8"]
  },
  {
    id: "p16",
    name: "Yusuf Demir",
    position: "MID",
    secondaryPosition: "MID",
    ovr: 76,
    attributes: { pac: 82, sho: 72, pas: 77, dri: 79, def: 62, phy: 71, gk: 15 },
    avatar: "⚡",
    preferredFoot: "Left",
    notes: "Speedy flank midfielder, good crosser",
    chemistryPartners: ["p9", "p24"]
  },
  {
    id: "p17",
    name: "Tobias Schmidt",
    position: "MID",
    secondaryPosition: "DEF",
    ovr: 73,
    attributes: { pac: 68, sho: 65, pas: 75, dri: 72, def: 71, phy: 75, gk: 18 },
    avatar: "⚙️",
    preferredFoot: "Right",
    notes: "Composed midfield distributor",
    chemistryPartners: ["p15"]
  },

  // --- FORWARDS / ATTACKERS (FWD) ---
  {
    id: "p18",
    name: "Rafael Santos",
    position: "FWD",
    secondaryPosition: "MID",
    ovr: 89,
    attributes: { pac: 88, sho: 90, pas: 80, dri: 87, def: 42, phy: 83, gk: 15 },
    avatar: "🚀",
    preferredFoot: "Right",
    notes: "Clinical finisher, sharp movement in the box",
    chemistryPartners: ["p10", "p5"] // Strike partnership with playmaker Lucas Romero
  },
  {
    id: "p19",
    name: "Julian Alvarez",
    position: "FWD",
    secondaryPosition: "MID",
    ovr: 86,
    attributes: { pac: 86, sho: 86, pas: 81, dri: 85, def: 58, phy: 80, gk: 15 },
    avatar: "💥",
    preferredFoot: "Right",
    notes: "Relentless pressing forward with lethal strike",
    chemistryPartners: ["p10", "p13"]
  },
  {
    id: "p20",
    name: "Antoine Griezmann",
    position: "FWD",
    secondaryPosition: "MID",
    ovr: 85,
    attributes: { pac: 80, sho: 85, pas: 86, dri: 86, def: 62, phy: 75, gk: 15 },
    avatar: "⭐",
    preferredFoot: "Left",
    notes: "Intelligent second striker, links play brilliantly",
    chemistryPartners: ["p7", "p14", "p22"]
  },
  {
    id: "p21",
    name: "Dusan Vlaho",
    position: "FWD",
    secondaryPosition: "FWD",
    ovr: 82,
    attributes: { pac: 81, sho: 85, pas: 70, dri: 78, def: 38, phy: 87, gk: 12 },
    avatar: "🎯",
    preferredFoot: "Left",
    notes: "Target man with explosive left foot",
    chemistryPartners: ["p12"]
  },
  {
    id: "p22",
    name: "Karim Benzema",
    position: "FWD",
    secondaryPosition: "MID",
    ovr: 81,
    attributes: { pac: 75, sho: 84, pas: 82, dri: 83, def: 40, phy: 77, gk: 12 },
    avatar: "👑",
    preferredFoot: "Right",
    notes: "Experienced false nine, clinical under pressure",
    chemistryPartners: ["p14", "p20"]
  },
  {
    id: "p23",
    name: "Emil Forsberg",
    position: "FWD",
    secondaryPosition: "MID",
    ovr: 78,
    attributes: { pac: 79, sho: 78, pas: 78, dri: 80, def: 48, phy: 72, gk: 15 },
    avatar: "⚡",
    preferredFoot: "Right",
    notes: "Direct attacker, creates chances out of nothing",
    chemistryPartners: ["p15"]
  },
  {
    id: "p24",
    name: "Tariq Edwards",
    position: "FWD",
    secondaryPosition: "FWD",
    ovr: 75,
    attributes: { pac: 87, sho: 74, pas: 68, dri: 77, def: 35, phy: 74, gk: 12 },
    avatar: "🏃",
    preferredFoot: "Right",
    notes: "Rapid counter-attack threat",
    chemistryPartners: ["p16"]
  }
];
