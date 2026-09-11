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
    "Artisan":       { skills: ["investigation", "persuasion"], tools: ["One artisan's tools"], languages: 0, originFeat: "Crafter", originFeatKey: "crafter", blurb: "A skilled crafter who's spent years mastering a trade and building a reputation for quality work." },
    "Charlatan":     { skills: ["deception", "sleightOfHand"], tools: ["Disguise kit", "Forgery kit"], languages: 0, feature: "False Identity", blurb: "A con artist adept at disguises, forged papers, and separating marks from their coin." },
    "Criminal":      { skills: ["deception", "stealth"], tools: ["One gaming set", "Thieves' tools"], languages: 0, feature: "Criminal Contact", blurb: "You have a network of shady contacts and a history of breaking the law to get by." },
    "Entertainer":   { skills: ["acrobatics", "performance"], tools: ["Disguise kit", "One musical instrument"], languages: 0, feature: "By Popular Demand", blurb: "A performer who's traveled from town to town, always ready to work a crowd." },
    "Farmer":        { skills: ["animalHandling", "nature"], tools: ["Carpenter's tools"], languages: 0, originFeat: "Tough", originFeatKey: "tough", blurb: "You worked the land, herding livestock and coaxing crops from difficult soil to keep a community fed." },
    "Folk Hero":     { skills: ["animalHandling", "survival"], tools: ["One artisan's tools", "Vehicles (land)"], languages: 0, feature: "Rustic Hospitality", blurb: "A commoner who stood up against injustice and became a local legend for it." },
    "Guard":         { skills: ["athletics", "perception"], tools: ["One gaming set"], languages: 0, originFeat: "Alert", originFeatKey: "alert", blurb: "You stood watch over a gate, caravan, or vault, trained to notice trouble before it starts." },
    "Guide":         { skills: ["stealth", "survival"], tools: ["Cartographer's tools"], languages: 0, originFeat: "Magic Initiate (Druid)", originFeatKey: "magicInitiate", blurb: "You've led travelers through unfamiliar and often dangerous terrain, reading the land like a map." },
    "Guild Artisan": { skills: ["insight", "persuasion"], tools: ["One artisan's tools"], languages: 1, feature: "Guild Membership", blurb: "A skilled tradesperson backed by a powerful guild and its connections." },
    "Hermit":        { skills: ["medicine", "religion"], tools: ["Herbalism kit"], languages: 1, feature: "Discovery", blurb: "You lived in seclusion, seeking enlightenment or hiding from the world - and found something." },
    "Merchant":      { skills: ["animalHandling", "persuasion"], tools: ["Navigator's tools"], languages: 0, originFeat: "Lucky", originFeatKey: "lucky", blurb: "A trader who's haggled across markets and caravan routes, always chasing the next good deal." },
    "Noble":         { skills: ["history", "persuasion"], tools: ["One gaming set"], languages: 1, feature: "Position of Privilege", blurb: "Born to wealth and privilege, you're used to influence, etiquette, and being obeyed." },
    "Outlander":     { skills: ["athletics", "survival"], tools: ["One musical instrument"], languages: 1, feature: "Wanderer", blurb: "Raised in the wilds far from civilization, you're a survivor first and a socialite never." },
    "Sage":          { skills: ["arcana", "history"], tools: [], languages: 2, feature: "Researcher", blurb: "A scholar who devoted years to research, libraries, and chasing knowledge for its own sake." },
    "Sailor":        { skills: ["athletics", "perception"], tools: ["Navigator's tools", "Vehicles (water)"], languages: 0, feature: "Ship's Passage", blurb: "You've spent your life at sea, weathering storms and rough crews to see distant shores." },
    "Scribe":        { skills: ["investigation", "perception"], tools: ["Calligrapher's supplies"], languages: 0, originFeat: "Skilled", originFeatKey: "skilled", blurb: "You made your living with careful handwriting and sharp research, copying texts and hunting down facts." },
    "Soldier":       { skills: ["athletics", "intimidation"], tools: ["One gaming set", "Vehicles (land)"], languages: 0, feature: "Military Rank", blurb: "A trained veteran of a military campaign, disciplined and used to a chain of command." },
    "Urchin":        { skills: ["sleightOfHand", "stealth"], tools: ["Disguise kit", "Thieves' tools"], languages: 0, feature: "City Secrets", blurb: "A streetwise survivor who grew up with nothing and learned to take what you needed." },
    "Wayfarer":      { skills: ["insight", "stealth"], tools: ["Thieves' tools"], languages: 0, originFeat: "Lucky", originFeatKey: "lucky", blurb: "A wanderer who grew up on the road or the streets, relying on instinct and quick feet to get by." }
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

  // ---- Feats -------------------------------------------------------------
  // Two very different "when do I get one" rules, both real 5e mechanics:
  //   - category "origin": free at level 1, handed to you automatically by
  //     your Background (see BACKGROUND_INFO's originFeatKey) - no choice,
  //     no level gate, not spent from anywhere.
  //   - category "general" / "racial": a character CHOOSES one of these
  //     instead of an Ability Score Improvement, and only at the levels
  //     where a class actually offers an ASI (YARN.ASI_LEVELS = 4/8/12/16/
  //     19) - see minLevel below and the level-gate in app.ui.js's Feats
  //     panel. "racial" is its own category because it also carries a
  //     species prerequisite (prereqText) on top of the level gate.
  //
  // mechanic tags this file actually computes (see app.core.js):
  //   "flatHpPerLevel" - adds mechanicValue x total level to suggested HP
  //   "abilityBonus"   - +1 to a CHOSEN ability from abilityChoices
  //   (grantsSaveProf: true also adds proficiency in that same save - Resilient only)
  //   Alert's initiative bonus (+ proficiency bonus, 2024 wording) is
  //   special-cased directly in YARN.initiative() - only one feat needs it,
  //   not worth inventing a whole mechanic tag for a single instance.
  // Everything else (mechanic: null) is real, correctly-described feat
  // data, just not simulated yet - same honest "display only" treatment
  // Origin Feats already got in v1.10, for the same reason: combat-trigger
  // and resource-pool feats (Lucky's luck points, Magic Initiate's spells,
  // Great Weapon Master's bonus attack, etc.) need systems Yarn doesn't
  // have yet (a real spell list, a resource-tracker hook, an attack-roll
  // flow) and half-simulating one of them would be worse than being clear
  // it's manual.
  YARN.FEATS = [
    // -- Origin feats (2024 PHB) - granted by background, level 1 --------
    { key: "alert", name: "Alert", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: null, blurb: "You gain a bonus to initiative rolls equal to your proficiency bonus, can't be surprised while conscious, and other creatures don't gain advantage on attack rolls against you from being unseen." },
    { key: "crafter", name: "Crafter", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: null, blurb: "You gain proficiency with three artisan's tools of your choice, buy nonmagical items at a 20% discount, and craft them in less time." },
    { key: "healer", name: "Healer", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: null, blurb: "Using a healer's kit to stabilize a dying creature also restores 1 HP to them, and spending your own healer's kit charges restores extra HP to a creature you tend outside combat." },
    { key: "lucky", name: "Lucky", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: null, blurb: "You have a pool of Luck Points (equal to your proficiency bonus) you can spend to give yourself advantage on a d20 test, or to impose disadvantage on an attack roll against you. The pool refills on a long rest." },
    { key: "magicInitiate", name: "Magic Initiate", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: null, blurb: "You learn two cantrips and one 1st-level spell from a chosen class's spell list; you can cast that 1st-level spell once without a slot, regaining the ability on a long rest." },
    { key: "musician", name: "Musician", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: null, blurb: "You gain proficiency with three musical instruments of your choice, and playing one for a short rest lets each participant gain a Heroic Inspiration die once you finish." },
    { key: "savageAttacker", name: "Savage Attacker", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: null, blurb: "Once per turn when you hit with a weapon attack, you can roll the weapon's damage dice twice and use either total." },
    { key: "skilled", name: "Skilled", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: null, blurb: "You gain proficiency in any combination of three skills or tools of your choice." },
    { key: "tavernBrawler", name: "Tavern Brawler", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: null, blurb: "Your unarmed strikes use a d4 for damage and count as magical, you can grapple as a bonus action after hitting with one, and you gain proficiency with unarmed strikes and improvised weapons." },
    { key: "tough", name: "Tough", category: "origin", minLevel: 1, abilityChoices: null,
      mechanic: "flatHpPerLevel", mechanicValue: 2,
      blurb: "Your hit point maximum increases by 2 for every level you have - retroactively for every level you'll ever gain." },

    // -- General feats (2024 PHB) - taken INSTEAD of an ASI, level 4+ ----
    { key: "actor", name: "Actor", category: "general", minLevel: 4, abilityChoices: ["cha"],
      mechanic: "abilityBonus", blurb: "You have advantage on Deception and Performance checks made to pass as someone else, and can mimic another person's speech or a creature's sounds." },
    { key: "athlete", name: "Athlete", category: "general", minLevel: 4, abilityChoices: ["str", "dex"],
      mechanic: "abilityBonus", blurb: "Climbing no longer costs extra movement, you can stand from prone using only 5 feet of movement, and your running jump distance increases." },
    { key: "charger", name: "Charger", category: "general", minLevel: 4, abilityChoices: null,
      mechanic: null, blurb: "After using the Dash action, you can make one attack as a bonus action, or shove a creature - either gets a bonus if you moved 10+ feet in a straight line first." },
    { key: "durable", name: "Durable", category: "general", minLevel: 4, abilityChoices: ["con"],
      mechanic: "abilityBonus", blurb: "When you roll a Hit Die to regain HP, the total can't be less than twice your Constitution modifier." },
    { key: "greatWeaponMaster", name: "Great Weapon Master", category: "general", minLevel: 4, abilityChoices: null,
      mechanic: null, blurb: "Before a melee attack with a heavy weapon you're proficient with, you can take a -5 penalty to hit for a +10 bonus to damage; scoring a crit or reducing a creature to 0 HP lets you make a bonus-action attack." },
    { key: "heavilyArmored", name: "Heavily Armored", category: "general", minLevel: 4, abilityChoices: ["str"],
      mechanic: "abilityBonus", blurb: "You gain proficiency with heavy armor." },
    { key: "keenMind", name: "Keen Mind", category: "general", minLevel: 4, abilityChoices: ["int"],
      mechanic: "abilityBonus", blurb: "You always know which way is north, the number of hours until sunrise/sunset, and can accurately recall anything you've seen or heard in the past month." },
    { key: "lightlyArmored", name: "Lightly Armored", category: "general", minLevel: 4, abilityChoices: ["str", "dex"],
      mechanic: "abilityBonus", blurb: "You gain proficiency with light armor." },
    { key: "mobile", name: "Mobile", category: "general", minLevel: 4, abilityChoices: null,
      mechanic: null, blurb: "Your speed increases by 10 feet, difficult terrain doesn't slow your Dash, and making a melee attack against a creature stops it from provoking your opportunity attack for the rest of the turn." },
    { key: "moderatelyArmored", name: "Moderately Armored", category: "general", minLevel: 4, abilityChoices: ["str", "dex"],
      mechanic: "abilityBonus", blurb: "You gain proficiency with medium armor and shields." },
    { key: "observant", name: "Observant", category: "general", minLevel: 4, abilityChoices: ["int", "wis"],
      mechanic: "abilityBonus", blurb: "If you can see a creature's mouth and know its language, you can read lips; you gain +5 to passive Perception and passive Investigation." },
    { key: "resilient", name: "Resilient", category: "general", minLevel: 4, abilityChoices: YARN.ABILITY_KEYS.slice(),
      mechanic: "abilityBonus", grantsSaveProf: true, blurb: "You gain proficiency in saving throws using the chosen ability, on top of the +1 score increase." },
    { key: "sharpshooter", name: "Sharpshooter", category: "general", minLevel: 4, abilityChoices: null,
      mechanic: null, blurb: "Ranged weapon attacks ignore half and three-quarters cover, and before attacking you can take a -5 penalty to hit for a +10 bonus to damage." },
    { key: "shieldMaster", name: "Shield Master", category: "general", minLevel: 4, abilityChoices: null,
      mechanic: null, blurb: "If you take the Attack action, you can shove a creature with your shield as a bonus action, and you can add your shield's AC bonus to Dexterity saves against effects that target only you." },
    { key: "weaponMaster", name: "Weapon Master", category: "general", minLevel: 4, abilityChoices: ["str", "dex"],
      mechanic: "abilityBonus", blurb: "You gain proficiency with four weapons of your choice, and can use them to add extra weapon mastery properties (per the 2024 rules)." },

    // -- Legacy racial feat (2014, Xanathar's Guide to Everything) -------
    // The one that kicked off this whole feature - see the DEVLOG for the
    // conversation. Never reprinted for 2024; kept here as "racial" so its
    // species prerequisite is visible and enforced separately from the
    // plain level gate every other general feat uses.
    { key: "elvenAccuracy", name: "Elven Accuracy", category: "racial", minLevel: 4,
      prereqText: "Elf or Half-Elf", abilityChoices: ["dex", "int", "wis", "cha"], mechanic: "abilityBonus",
      blurb: "Whenever you have advantage on an attack roll using Dexterity, Intelligence, Wisdom, or Charisma, you can reroll one of the dice once (2014 Xanathar's Guide to Everything, p.74)." }
  ];
  YARN.featInfo = function (key) { return byKey(YARN.FEATS, key); };

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

  // ---- Pact Magic slots (Warlock only) ---------------------------------
  // Warlock's "pact" caster type does NOT use the full-caster table above -
  // it has its own tiny, fixed-shape progression: fewer slots overall, but
  // they're always the highest level Warlock can reach, and they recharge
  // on a SHORT rest rather than a long one. This table was previously
  // missing entirely - YARN.spellSlots() silently treated "pact" the same
  // as "full", which is wrong even for a single-classed Warlock. Fixed as
  // part of the multiclass work since multiclass math has to keep Warlock
  // levels out of the combined full/half/third table anyway.
  // Row = Warlock level -> { count: slots available, level: slot level }.
  YARN.PACT_SLOTS = [
    null,
    { count: 1, level: 1 }, { count: 2, level: 1 },
    { count: 2, level: 2 }, { count: 2, level: 2 },
    { count: 2, level: 3 }, { count: 2, level: 3 },
    { count: 2, level: 4 }, { count: 2, level: 4 },
    { count: 2, level: 5 }, { count: 2, level: 5 },
    { count: 3, level: 5 }, { count: 3, level: 5 },
    { count: 3, level: 5 }, { count: 3, level: 5 },
    { count: 3, level: 5 }, { count: 3, level: 5 },
    { count: 4, level: 5 }, { count: 4, level: 5 },
    { count: 4, level: 5 }, { count: 4, level: 5 }
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
