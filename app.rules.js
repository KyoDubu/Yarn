/* app.rules.js - static D&D 5e SRD reference data.
 *
 * Pure data, no behavior. Everything here is a constant lookup table.
 * Keeping game data out of app.core.js means rules can be corrected or
 * extended (homebrew, 2024 rules) without touching application logic.
 */
(function (YARN) {
  "use strict";

  // ---- Abilities -----------------------------------------------------
  YARN.ABILITIES = [
    { key: "str", name: "Strength" },
    { key: "dex", name: "Dexterity" },
    { key: "con", name: "Constitution" },
    { key: "int", name: "Intelligence" },
    { key: "wis", name: "Wisdom" },
    { key: "cha", name: "Charisma" }
  ];
  YARN.ABILITY_KEYS = YARN.ABILITIES.map(function (a) { return a.key; });

  // ---- Skills (SRD) --------------------------------------------------
  // Single source of truth for skill -> governing ability.
  YARN.SKILLS = [
    { key: "acrobatics", name: "Acrobatics", ability: "dex" },
    { key: "animalHandling", name: "Animal Handling", ability: "wis" },
    { key: "arcana", name: "Arcana", ability: "int" },
    { key: "athletics", name: "Athletics", ability: "str" },
    { key: "deception", name: "Deception", ability: "cha" },
    { key: "history", name: "History", ability: "int" },
    { key: "insight", name: "Insight", ability: "wis" },
    { key: "intimidation", name: "Intimidation", ability: "cha" },
    { key: "investigation", name: "Investigation", ability: "int" },
    { key: "medicine", name: "Medicine", ability: "wis" },
    { key: "nature", name: "Nature", ability: "int" },
    { key: "perception", name: "Perception", ability: "wis" },
    { key: "performance", name: "Performance", ability: "cha" },
    { key: "persuasion", name: "Persuasion", ability: "cha" },
    { key: "religion", name: "Religion", ability: "int" },
    { key: "sleightOfHand", name: "Sleight of Hand", ability: "dex" },
    { key: "stealth", name: "Stealth", ability: "dex" },
    { key: "survival", name: "Survival", ability: "wis" }
  ];

  // ---- Classes (SRD) -------------------------------------------------
  // hitDie drives HP + hit dice. saves = the two proficient saving throws.
  // caster: "full" | "half" | "third" | "pact" | null -> drives spell slots.
  YARN.CLASSES = [
    { key: "barbarian", name: "Barbarian", hitDie: 12, saves: ["str", "con"], caster: null,    spellAbility: null, blurb: "A relentless melee brawler who trades finesse for raw fury and can shrug off punishment mid-rage." },
    { key: "bard",      name: "Bard",      hitDie: 8,  saves: ["dex", "cha"], caster: "full",  spellAbility: "cha", blurb: "A charismatic jack-of-all-trades who weaves magic through music, wit, and social savvy." },
    { key: "cleric",    name: "Cleric",    hitDie: 8,  saves: ["wis", "cha"], caster: "full",  spellAbility: "wis", blurb: "A divine conduit who heals allies and channels their deity's power in melee or at range." },
    { key: "druid",     name: "Druid",     hitDie: 8,  saves: ["int", "wis"], caster: "full",  spellAbility: "wis", blurb: "A nature-bound spellcaster who shapeshifts into beasts and commands the wild itself." },
    { key: "fighter",   name: "Fighter",   hitDie: 10, saves: ["str", "con"], caster: null,    spellAbility: null, blurb: "A versatile master of weapons and tactics, reliable in nearly any combat situation." },
    { key: "monk",      name: "Monk",      hitDie: 8,  saves: ["str", "dex"], caster: null,    spellAbility: null, blurb: "A disciplined martial artist who fights unarmed with supernatural speed and inner focus." },
    { key: "paladin",   name: "Paladin",   hitDie: 10, saves: ["wis", "cha"], caster: "half",  spellAbility: "cha", blurb: "A holy warrior bound by a sacred oath, blending heavy armor with divine smites and auras." },
    { key: "ranger",    name: "Ranger",    hitDie: 10, saves: ["str", "dex"], caster: "half",  spellAbility: "wis", blurb: "A wilderness hunter who tracks foes, fights from range or melee, and knows the land." },
    { key: "rogue",     name: "Rogue",     hitDie: 8,  saves: ["dex", "int"], caster: null,    spellAbility: null, blurb: "A cunning skirmisher who strikes from the shadows, disarms traps, and talks their way out of trouble." },
    { key: "sorcerer",  name: "Sorcerer",  hitDie: 6,  saves: ["con", "cha"], caster: "full",  spellAbility: "cha", blurb: "An innate spellcaster whose magic comes from raw bloodline power rather than study." },
    { key: "warlock",   name: "Warlock",   hitDie: 8,  saves: ["wis", "cha"], caster: "pact",  spellAbility: "cha", blurb: "A spellcaster who traded a pact with a mysterious patron for eldritch power." },
    { key: "wizard",    name: "Wizard",    hitDie: 6,  saves: ["int", "wis"], caster: "full",  spellAbility: "int", blurb: "A scholarly spellcaster who masters magic through study, unlocking the widest spell list in the game." }
  ];

  // ---- Species (SRD) -------------------------------------------------
  // asi = permanent ability score increases from ancestry.
  // Full species + subspecies (subrace) data now lives in app.species.js -
  // that's a big enough domain to earn its own file. This module still owns
  // the lookup helpers below.

  // ---- Backgrounds ---------------------------------------------------
  YARN.BACKGROUNDS = [
    "Acolyte", "Artisan", "Charlatan", "Criminal", "Entertainer", "Farmer", "Folk Hero",
    "Guard", "Guide", "Guild Artisan", "Hermit", "Merchant", "Noble", "Outlander",
    "Sage", "Sailor", "Scribe", "Soldier", "Urchin", "Wayfarer"
  ];

  // Keyed by the same display name stored on the character (background has
  // never had a separate key/name split - it's just a string). skills are
  // ALWAYS granted, never a player choice, so they can be baked straight
  // into skillTotal the same way class saves are - no separate "which
  // skills did my background give me" state to store or drift.
  // tools/languages are display-only text, same spirit as species traits:
  // they never feed the math because Yarn has no tool-proficiency or
  // language state to compute against yet.
  //
  // Two flavors of "what does this background do besides skills" coexist
  // here, and that's intentional rather than an inconsistency to clean up:
  //   - The 13 original entries use `feature` (a 2014 PHB roleplay feature
  //     like "Guild Membership" - text only, DM-adjudicated).
  //   - The 7 newer entries (Artisan/Farmer/Guard/Guide/Merchant/Scribe/
  //     Wayfarer, added for real 2024 PHB parity) use `originFeat` instead
  //     (2024 backgrounds trade the roleplay feature for a granted feat).
  //     Yarn doesn't simulate feat mechanics at all yet, so this is also
  //     display-only for now - see backgroundPanel() in app.ui.js for how
  //     the two get rendered differently.
  // A background entry has exactly one of the two, never both.
  YARN.BACKGROUND_INFO = {
    "Acolyte":       { skills: ["insight", "religion"], tools: [], languages: 2, feature: "Shelter of the Faithful", blurb: "You served in a temple, devoted to a deity, with a faith community behind you." },
    "Artisan":       { skills: ["investigation", "persuasion"], tools: ["One artisan's tools"], languages: 0, originFeat: "Crafter", blurb: "A skilled crafter who's spent years mastering a trade and building a reputation for quality work." },
    "Charlatan":     { skills: ["deception", "sleightOfHand"], tools: ["Disguise kit", "Forgery kit"], languages: 0, feature: "False Identity", blurb: "A con artist adept at disguises, forged papers, and separating marks from their coin." },
    "Criminal":      { skills: ["deception", "stealth"], tools: ["One gaming set", "Thieves' tools"], languages: 0, feature: "Criminal Contact", blurb: "You have a network of shady contacts and a history of breaking the law to get by." },
    "Entertainer":   { skills: ["acrobatics", "performance"], tools: ["Disguise kit", "One musical instrument"], languages: 0, feature: "By Popular Demand", blurb: "A performer who's traveled from town to town, always ready to work a crowd." },
    "Farmer":        { skills: ["animalHandling", "nature"], tools: ["Carpenter's tools"], languages: 0, originFeat: "Tough", blurb: "You worked the land, herding livestock and coaxing crops from difficult soil to keep a community fed." },
    "Folk Hero":     { skills: ["animalHandling", "survival"], tools: ["One artisan's tools", "Vehicles (land)"], languages: 0, feature: "Rustic Hospitality", blurb: "A commoner who stood up against injustice and became a local legend for it." },
    "Guard":         { skills: ["athletics", "perception"], tools: ["One gaming set"], languages: 0, originFeat: "Alert", blurb: "You stood watch over a gate, caravan, or vault, trained to notice trouble before it starts." },
    "Guide":         { skills: ["stealth", "survival"], tools: ["Cartographer's tools"], languages: 0, originFeat: "Magic Initiate (Druid)", blurb: "You've led travelers through unfamiliar and often dangerous terrain, reading the land like a map." },
    "Guild Artisan": { skills: ["insight", "persuasion"], tools: ["One artisan's tools"], languages: 1, feature: "Guild Membership", blurb: "A skilled tradesperson backed by a powerful guild and its connections." },
    "Hermit":        { skills: ["medicine", "religion"], tools: ["Herbalism kit"], languages: 1, feature: "Discovery", blurb: "You lived in seclusion, seeking enlightenment or hiding from the world - and found something." },
    "Merchant":      { skills: ["animalHandling", "persuasion"], tools: ["Navigator's tools"], languages: 0, originFeat: "Lucky", blurb: "A trader who's haggled across markets and caravan routes, always chasing the next good deal." },
    "Noble":         { skills: ["history", "persuasion"], tools: ["One gaming set"], languages: 1, feature: "Position of Privilege", blurb: "Born to wealth and privilege, you're used to influence, etiquette, and being obeyed." },
    "Outlander":     { skills: ["athletics", "survival"], tools: ["One musical instrument"], languages: 1, feature: "Wanderer", blurb: "Raised in the wilds far from civilization, you're a survivor first and a socialite never." },
    "Sage":          { skills: ["arcana", "history"], tools: [], languages: 2, feature: "Researcher", blurb: "A scholar who devoted years to research, libraries, and chasing knowledge for its own sake." },
    "Sailor":        { skills: ["athletics", "perception"], tools: ["Navigator's tools", "Vehicles (water)"], languages: 0, feature: "Ship's Passage", blurb: "You've spent your life at sea, weathering storms and rough crews to see distant shores." },
    "Scribe":        { skills: ["investigation", "perception"], tools: ["Calligrapher's supplies"], languages: 0, originFeat: "Skilled", blurb: "You made your living with careful handwriting and sharp research, copying texts and hunting down facts." },
    "Soldier":       { skills: ["athletics", "intimidation"], tools: ["One gaming set", "Vehicles (land)"], languages: 0, feature: "Military Rank", blurb: "A trained veteran of a military campaign, disciplined and used to a chain of command." },
    "Urchin":        { skills: ["sleightOfHand", "stealth"], tools: ["Disguise kit", "Thieves' tools"], languages: 0, feature: "City Secrets", blurb: "A streetwise survivor who grew up with nothing and learned to take what you needed." },
    "Wayfarer":      { skills: ["insight", "stealth"], tools: ["Thieves' tools"], languages: 0, originFeat: "Lucky", blurb: "A wanderer who grew up on the road or the streets, relying on instinct and quick feet to get by." }
  };

  // ---- 2024 background ability score choices --------------------------
  // Each background lists 3 candidate abilities. At creation you spend
  // exactly 3 points across them: +2 to one and +1 to a different one,
  // OR +1 to all three - see YARN.backgroundAsiValid. The original 13
  // entries got a trio built from their existing governing skills (Yarn
  // kept those 13 rather than deleting them when 2024 dropped/renamed
  // some); the 7 newer entries below use the real 2024 PHB values.
  YARN.BACKGROUND_ABILITY_CHOICES = {
    "Acolyte":       ["wis", "int", "cha"],
    "Artisan":       ["str", "dex", "int"],
    "Farmer":        ["str", "con", "wis"],
    "Guard":         ["str", "int", "wis"],
    "Guide":         ["dex", "con", "wis"],
    "Merchant":      ["con", "int", "cha"],
    "Scribe":        ["dex", "int", "wis"],
    "Wayfarer":      ["dex", "wis", "cha"],
    "Charlatan":     ["cha", "dex", "int"],
    "Criminal":      ["cha", "dex", "con"],
    "Entertainer":   ["dex", "cha", "str"],
    "Folk Hero":     ["wis", "str", "con"],
    "Guild Artisan": ["wis", "cha", "dex"],
    "Hermit":        ["wis", "int", "con"],
    "Noble":         ["int", "cha", "wis"],
    "Outlander":     ["str", "wis", "con"],
    "Sage":          ["int", "wis", "con"],
    "Sailor":        ["str", "dex", "wis"],
    "Soldier":       ["str", "con", "cha"],
    "Urchin":        ["dex", "int", "cha"]
  };
  YARN.backgroundAbilityChoices = function (name) {
    return YARN.BACKGROUND_ABILITY_CHOICES[name] || [];
  };

  YARN.ALIGNMENTS = [
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil"
  ];

  // ---- Ability score generation (2024 methods, usable under 2014) ------
  // The three sanctioned ways to generate a stat line, plus the class
  // suggestions the rulebook prints. Pure data - the math lives in core.
  YARN.STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

  // Point-buy cost table (27-point budget). Score -> points spent.
  YARN.POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  YARN.POINT_BUY_BUDGET = 27;
  YARN.POINT_BUY_MIN = 8;
  YARN.POINT_BUY_MAX = 15;

  // Suggested standard-array placement per class (str,dex,con,int,wis,cha).
  // Straight from the rulebook's "assign these" table - a one-click starting
  // point players can then tweak.
  YARN.SUGGESTED_ARRAY = {
    barbarian: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    bard:      { str: 8,  dex: 14, con: 12, int: 13, wis: 10, cha: 15 },
    cleric:    { str: 14, dex: 8,  con: 13, int: 10, wis: 15, cha: 12 },
    druid:     { str: 8,  dex: 12, con: 14, int: 13, wis: 15, cha: 10 },
    fighter:   { str: 15, dex: 14, con: 13, int: 8,  wis: 10, cha: 12 },
    monk:      { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 },
    paladin:   { str: 15, dex: 10, con: 13, int: 8,  wis: 12, cha: 14 },
    ranger:    { str: 12, dex: 15, con: 13, int: 8,  wis: 14, cha: 10 },
    rogue:     { str: 12, dex: 15, con: 13, int: 14, wis: 10, cha: 8 },
    sorcerer:  { str: 10, dex: 13, con: 14, int: 8,  wis: 12, cha: 15 },
    warlock:   { str: 8,  dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
    wizard:    { str: 8,  dex: 12, con: 13, int: 15, wis: 14, cha: 10 }
  };

  // ---- Random name fragments -----------------------------------------
  // Cheap-and-cheerful fantasy name generator source. Two-part names:
  // a prefix + a suffix. Not lore-accurate, just a spark to get unstuck.
  YARN.NAME_PARTS = {
    prefix: ["Aer", "Bran", "Cael", "Dor", "El", "Fen", "Gor", "Hal", "Ith",
             "Kel", "Lor", "Mar", "Nyx", "Or", "Pyr", "Quen", "Rav", "Syl",
             "Thal", "Ul", "Vor", "Wyn", "Xar", "Yr", "Zeph"],
    suffix: ["ade", "ain", "ara", "eth", "ian", "iel", "ira", "is", "lyn",
             "mir", "nor", "ric", "rin", "ros", "thas", "tia", "ven", "wyn",
             "yll", "ys"]
  };

  // ---- Conditions (SRD) ----------------------------------------------
  YARN.CONDITIONS = [
    "Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated",
    "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained",
    "Stunned", "Unconscious", "Exhaustion"
  ];

  // ---- XP thresholds -> level ----------------------------------------
  // Index 0 is unused so XP_FOR_LEVEL[5] reads as "XP needed for level 5".
  YARN.XP_FOR_LEVEL = [
    0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
  ];

  // ---- Spell slots by full-caster level -------------------------------
  // Row = character level, columns = slots for spell levels 1..9.
  YARN.FULL_CASTER_SLOTS = [
    null,
    [2, 0, 0, 0, 0, 0, 0, 0, 0], [3, 0, 0, 0, 0, 0, 0, 0, 0],
    [4, 2, 0, 0, 0, 0, 0, 0, 0], [4, 3, 0, 0, 0, 0, 0, 0, 0],
    [4, 3, 2, 0, 0, 0, 0, 0, 0], [4, 3, 3, 0, 0, 0, 0, 0, 0],
    [4, 3, 3, 1, 0, 0, 0, 0, 0], [4, 3, 3, 2, 0, 0, 0, 0, 0],
    [4, 3, 3, 3, 1, 0, 0, 0, 0], [4, 3, 3, 3, 2, 0, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 0, 0, 0], [4, 3, 3, 3, 2, 1, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 0, 0], [4, 3, 3, 3, 2, 1, 1, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 0], [4, 3, 3, 3, 2, 1, 1, 1, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]
  ];

  // Levels at which most classes gain an Ability Score Improvement.
  YARN.ASI_LEVELS = [4, 8, 12, 16, 19];

  // ---- Lookup helpers -------------------------------------------------
  // Tiny by design: one generic finder rather than six near-identical ones.
  function byKey(list, key) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) { return list[i]; }
    }
    return null;
  }
  YARN.classInfo = function (key) { return byKey(YARN.CLASSES, key); };
  YARN.speciesInfo = function (key) { return byKey(YARN.SPECIES, key); };
  YARN.skillInfo = function (key) { return byKey(YARN.SKILLS, key); };

  // Backgrounds are stored as a plain display-name string (never had a key),
  // so the lookup is a straight object hit rather than byKey(). Missing/
  // unrecognized names (e.g. blank, or a homebrew background typed in
  // freehand later) degrade to null - callers already treat null as
  // "grants nothing", same contract as speciesInfo/subspeciesInfo.
  YARN.backgroundInfo = function (name) { return YARN.BACKGROUND_INFO[name] || null; };

  // A subrace lives nested under its parent species. Returns null if the
  // species has no subraces, or the key doesn't match one of them - both
  // are valid "no subrace chosen" states, not errors.
  YARN.subspeciesInfo = function (speciesKey, subKey) {
    var sp = YARN.speciesInfo(speciesKey);
    if (!sp || !Array.isArray(sp.subraces) || !subKey) { return null; }
    return byKey(sp.subraces, subKey);
  };
})(window.YARN = window.YARN || {});
