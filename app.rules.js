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
    { key: "barbarian", name: "Barbarian", hitDie: 12, saves: ["str", "con"], caster: null,    spellAbility: null },
    { key: "bard",      name: "Bard",      hitDie: 8,  saves: ["dex", "cha"], caster: "full",  spellAbility: "cha" },
    { key: "cleric",    name: "Cleric",    hitDie: 8,  saves: ["wis", "cha"], caster: "full",  spellAbility: "wis" },
    { key: "druid",     name: "Druid",     hitDie: 8,  saves: ["int", "wis"], caster: "full",  spellAbility: "wis" },
    { key: "fighter",   name: "Fighter",   hitDie: 10, saves: ["str", "con"], caster: null,    spellAbility: null },
    { key: "monk",      name: "Monk",      hitDie: 8,  saves: ["str", "dex"], caster: null,    spellAbility: null },
    { key: "paladin",   name: "Paladin",   hitDie: 10, saves: ["wis", "cha"], caster: "half",  spellAbility: "cha" },
    { key: "ranger",    name: "Ranger",    hitDie: 10, saves: ["str", "dex"], caster: "half",  spellAbility: "wis" },
    { key: "rogue",     name: "Rogue",     hitDie: 8,  saves: ["dex", "int"], caster: null,    spellAbility: null },
    { key: "sorcerer",  name: "Sorcerer",  hitDie: 6,  saves: ["con", "cha"], caster: "full",  spellAbility: "cha" },
    { key: "warlock",   name: "Warlock",   hitDie: 8,  saves: ["wis", "cha"], caster: "pact",  spellAbility: "cha" },
    { key: "wizard",    name: "Wizard",    hitDie: 6,  saves: ["int", "wis"], caster: "full",  spellAbility: "int" }
  ];

  // ---- Species (SRD) -------------------------------------------------
  // asi = permanent ability score increases from ancestry.
  YARN.SPECIES = [
    { key: "dwarf",      name: "Dwarf",      speed: 25, size: "Medium", asi: { con: 2 } },
    { key: "elf",        name: "Elf",        speed: 30, size: "Medium", asi: { dex: 2 } },
    { key: "halfling",   name: "Halfling",   speed: 25, size: "Small",  asi: { dex: 2 } },
    { key: "human",      name: "Human",      speed: 30, size: "Medium",
      asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
    { key: "dragonborn", name: "Dragonborn", speed: 30, size: "Medium", asi: { str: 2, cha: 1 } },
    { key: "gnome",      name: "Gnome",      speed: 25, size: "Small",  asi: { int: 2 } },
    { key: "halfElf",    name: "Half-Elf",   speed: 30, size: "Medium", asi: { cha: 2 } },
    { key: "halfOrc",    name: "Half-Orc",   speed: 30, size: "Medium", asi: { str: 2, con: 1 } },
    { key: "tiefling",   name: "Tiefling",   speed: 30, size: "Medium", asi: { int: 1, cha: 2 } }
  ];

  // ---- Backgrounds ---------------------------------------------------
  YARN.BACKGROUNDS = [
    "Acolyte", "Charlatan", "Criminal", "Entertainer", "Folk Hero", "Guild Artisan",
    "Hermit", "Noble", "Outlander", "Sage", "Sailor", "Soldier", "Urchin"
  ];

  YARN.ALIGNMENTS = [
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil"
  ];

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
})(window.YARN = window.YARN || {});
