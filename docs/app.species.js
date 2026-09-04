/* app.species.js - species + subspecies (subrace) reference data.
 *
 * A big enough domain to earn its own file rather than bloating
 * app.rules.js past a sane line count. Pure data, no behavior.
 *
 * Shape:
 *   { key, name, size, speed, asi: {ability:bonus}, languages: [..],
 *     traits: [..display strings..], subraces: [ { key, name, asi,
 *     speed?, size?, languages?, traits: [..] } ] }
 *
 * Ability bonuses STACK: a character's final species bonus is the base
 * species asi PLUS the chosen subrace's asi (see YARN.speciesASI in
 * app.core.js). Traits/languages are display-only - nothing here is
 * auto-computed beyond size/speed/asi, by design (see DEVLOG).
 *
 * Some post-2020 species publish a "floating" ASI (player's choice of
 * which abilities to raise) instead of fixed bonuses. Those are recorded
 * with an empty asi object and a trait line explaining the choice, so the
 * math never invents a bonus the player didn't actually pick - they apply
 * it via the per-campaign ASI fields like any other Ability Score
 * Improvement.
 */
(function (YARN) {
  "use strict";

  YARN.SPECIES = [
    // ---- Dwarf ---------------------------------------------------------
    {
      key: "dwarf", name: "Dwarf", size: "Medium", speed: 25,
      asi: { con: 2 }, languages: ["Common", "Dwarvish"],
      traits: ["Darkvision 60 ft", "Dwarven Resilience (advantage vs. poison, resistance to poison damage)",
        "Stonecunning (double proficiency on History checks about stonework)", "Dwarven combat training (axe, hammer)"],
      subraces: [
        { key: "hill", name: "Hill Dwarf", asi: { wis: 1 },
          traits: ["Dwarven Toughness: +1 HP per level"] },
        { key: "mountain", name: "Mountain Dwarf", asi: { str: 2 },
          traits: ["Dwarven Armor Training (light and medium armor)"] },
        { key: "duergar", name: "Duergar (Gray Dwarf)", asi: { str: 1 },
          traits: ["Superior Darkvision 120 ft", "Duergar Resilience (advantage vs. illusions, charm, paralysis)",
            "Sunlight Sensitivity", "Innate spellcasting: enlarge/reduce (self), invisibility (self) at higher levels"] }
      ]
    },
    // ---- Elf -------------------------------------------------------------
    {
      key: "elf", name: "Elf", size: "Medium", speed: 30,
      asi: { dex: 2 }, languages: ["Common", "Elvish"],
      traits: ["Darkvision 60 ft", "Fey Ancestry (advantage vs. charm, immune to magical sleep)",
        "Trance (4-hour meditation instead of sleep)", "Keen Senses (proficiency in Perception)"],
      subraces: [
        { key: "high", name: "High Elf", asi: { int: 1 },
          traits: ["Knows one wizard cantrip (Intelligence)", "Extra language of choice"] },
        { key: "wood", name: "Wood Elf", asi: { wis: 1 }, speed: 35,
          traits: ["Mask of the Wild (hide in light natural cover)"] },
        { key: "drow", name: "Drow (Dark Elf)", asi: { cha: 1 },
          traits: ["Superior Darkvision 120 ft", "Sunlight Sensitivity",
            "Drow Magic: dancing lights, then faerie fire and darkness at higher levels"] },
        { key: "eladrin", name: "Eladrin", asi: { cha: 1 },
          traits: ["Fey Step: short teleport as a bonus action (recharges on rest, season-flavored)"] },
        { key: "shadarKai", name: "Shadar-Kai", asi: { con: 1 },
          traits: ["Necrotic resistance", "Blessing of the Raven Queen: short teleport + resistance to all damage until end of turn"] },
        { key: "sea", name: "Sea Elf", asi: { con: 1 },
          traits: ["Swim speed 30 ft", "Can breathe air and water", "Friendly with beasts that swim"] },
        { key: "pallid", name: "Pallid Elf", asi: { wis: 1 },
          traits: ["Innate spellcasting: minor illusion, then charm person / darkness at higher levels"] }
      ]
    },
    // ---- Halfling ----------------------------------------------------------
    {
      key: "halfling", name: "Halfling", size: "Small", speed: 25,
      asi: { dex: 2 }, languages: ["Common", "Halfling"],
      traits: ["Lucky (reroll natural 1s on attack/ability/save)", "Brave (advantage vs. frightened)",
        "Halfling Nimbleness (move through larger creatures' spaces)"],
      subraces: [
        { key: "lightfoot", name: "Lightfoot Halfling", asi: { cha: 1 },
          traits: ["Naturally Stealthy (hide behind a larger creature)"] },
        { key: "stout", name: "Stout Halfling", asi: { con: 1 },
          traits: ["Stout Resilience (advantage vs. poison, resistance to poison damage)"] },
        { key: "ghostwise", name: "Ghostwise Halfling", asi: { wis: 1 },
          traits: ["Silent Speech: telepathy with willing creatures within 30 ft"] }
      ]
    },
    // ---- Human -------------------------------------------------------------
    {
      key: "human", name: "Human", size: "Medium", speed: 30,
      asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
      languages: ["Common", "one language of choice"],
      traits: ["Versatile and numerous - no unusual traits beyond the ability spread"],
      subraces: [
        { key: "variant", name: "Variant Human", asi: {},
          traits: ["Ability Score Increase: +1 to two different abilities of your choice (apply via campaign ASI)",
            "One skill proficiency of choice", "One feat of choice (Origin feat under 2024 rules)"] }
      ]
    },
    // ---- Dragonborn --------------------------------------------------------
    {
      key: "dragonborn", name: "Dragonborn", size: "Medium", speed: 30,
      asi: { str: 2, cha: 1 }, languages: ["Common", "Draconic"],
      traits: ["Breath Weapon (replaces an attack, Dex or Con save depending on ancestry)",
        "Damage Resistance matching draconic ancestry"],
      subraces: [
        { key: "black", name: "Black Dragonborn", asi: {}, traits: ["Acid damage - 5x30 ft line, Dex save"] },
        { key: "blue", name: "Blue Dragonborn", asi: {}, traits: ["Lightning damage - 5x30 ft line, Dex save"] },
        { key: "brass", name: "Brass Dragonborn", asi: {}, traits: ["Fire damage - 5x30 ft line, Dex save"] },
        { key: "bronze", name: "Bronze Dragonborn", asi: {}, traits: ["Lightning damage - 5x30 ft line, Dex save"] },
        { key: "copper", name: "Copper Dragonborn", asi: {}, traits: ["Acid damage - 5x30 ft line, Dex save"] },
        { key: "gold", name: "Gold Dragonborn", asi: {}, traits: ["Fire damage - 15 ft cone, Dex save"] },
        { key: "green", name: "Green Dragonborn", asi: {}, traits: ["Poison damage - 15 ft cone, Con save"] },
        { key: "red", name: "Red Dragonborn", asi: {}, traits: ["Fire damage - 15 ft cone, Dex save"] },
        { key: "silver", name: "Silver Dragonborn", asi: {}, traits: ["Cold damage - 15 ft cone, Con save"] },
        { key: "white", name: "White Dragonborn", asi: {}, traits: ["Cold damage - 15 ft cone, Con save"] }
      ]
    },
    // ---- Gnome -------------------------------------------------------------
    {
      key: "gnome", name: "Gnome", size: "Small", speed: 25,
      asi: { int: 2 }, languages: ["Common", "Gnomish"],
      traits: ["Darkvision 60 ft", "Gnome Cunning (advantage on Int/Wis/Cha saves vs. magic)"],
      subraces: [
        { key: "forest", name: "Forest Gnome", asi: { dex: 1 },
          traits: ["Knows minor illusion cantrip", "Speak with Small Beasts"] },
        { key: "rock", name: "Rock Gnome", asi: { con: 1 },
          traits: ["Artificer's Lore (double proficiency, magic item history)", "Tinker: build a tiny clockwork device"] },
        { key: "deep", name: "Deep Gnome (Svirfneblin)", asi: { dex: 1 },
          traits: ["Superior Darkvision 120 ft", "Stone Camouflage (advantage hiding in rocky terrain)"] }
      ]
    },
    // ---- Half-Elf ----------------------------------------------------------
    {
      key: "halfElf", name: "Half-Elf", size: "Medium", speed: 30,
      asi: { cha: 2 }, languages: ["Common", "Elvish", "one language of choice"],
      traits: ["Darkvision 60 ft", "Fey Ancestry (advantage vs. charm, immune to magical sleep)",
        "Skill Versatility (proficiency in two skills of choice)",
        "Ability Score Increase: +1 to two other abilities of choice (apply via campaign ASI)"],
      subraces: [
        { key: "woodElfHeritage", name: "Half-Elf (Wood Elf heritage)", asi: {}, traits: ["Mask of the Wild"] },
        { key: "drowHeritage", name: "Half-Elf (Drow heritage)", asi: {}, traits: ["Drow Magic: dancing lights cantrip"] },
        { key: "highElfHeritage", name: "Half-Elf (High Elf heritage)", asi: {}, traits: ["Knows one wizard cantrip"] }
      ]
    },
    // ---- Half-Orc ----------------------------------------------------------
    {
      key: "halfOrc", name: "Half-Orc", size: "Medium", speed: 30,
      asi: { str: 2, con: 1 }, languages: ["Common", "Orc"],
      traits: ["Darkvision 60 ft", "Menacing (proficiency in Intimidation)",
        "Relentless Endurance (drop to 1 HP instead of 0, once per long rest)",
        "Savage Attacks (extra weapon damage die on a melee crit)"]
    },
    // ---- Tiefling ----------------------------------------------------------
    {
      key: "tiefling", name: "Tiefling", size: "Medium", speed: 30,
      asi: { int: 1, cha: 2 }, languages: ["Common", "Infernal"],
      traits: ["Darkvision 60 ft", "Hellish Resistance (resistance to fire damage)",
        "Infernal Legacy: thaumaturgy cantrip, then hellish rebuke / darkness at higher levels"],
      subraces: [
        { key: "asmodeus", name: "Tiefling (Asmodeus)", asi: {}, traits: ["Default infernal legacy line"] },
        { key: "feral", name: "Feral Tiefling", asi: { dex: 2, int: 1 },
          traits: ["Replaces the standard ASI with Dex +2 / Int +1"] },
        { key: "zariel", name: "Zariel Tiefling", asi: { str: 1, cha: 2 },
          traits: ["Legacy grants searing smite, then branding smite / martial advantage at higher levels"] },
        { key: "mephistopheles", name: "Mephistopheles Tiefling", asi: { int: 1, cha: 2 },
          traits: ["Legacy grants mage hand, then burning hands / flame blade at higher levels"] },
        { key: "glasya", name: "Glasya Tiefling", asi: { dex: 1, cha: 2 },
          traits: ["Legacy grants disguise self, then charm person / invisibility at higher levels"] }
      ]
    },
    // ---- Aasimar (Volo's) ---------------------------------------------------
    {
      key: "aasimar", name: "Aasimar", size: "Medium", speed: 30,
      asi: { cha: 2 }, languages: ["Common", "Celestial"],
      traits: ["Darkvision 60 ft", "Celestial Resistance (resistance to necrotic and radiant damage)",
        "Healing Hands (touch to heal, once per long rest)", "Light Bearer: knows the light cantrip"],
      subraces: [
        { key: "protector", name: "Protector Aasimar", asi: { wis: 1 },
          traits: ["Radiant Soul: sprout wings for flight + extra radiant damage (higher levels)"] },
        { key: "scourge", name: "Scourge Aasimar", asi: { con: 1 },
          traits: ["Radiant Consumption: radiant damage aura + self damage (higher levels)"] },
        { key: "fallen", name: "Fallen Aasimar", asi: { str: 1 },
          traits: ["Necrotic Shroud: frightening aura + extra necrotic damage (higher levels)"] }
      ]
    },
    // ---- other standalone species -------------------------------------------
    {
      key: "goliath", name: "Goliath", size: "Medium", speed: 30,
      asi: { str: 2, con: 1 }, languages: ["Common", "Giant"],
      traits: ["Stone's Endurance (reduce damage once per short/long rest)", "Powerful Build (counts as Large for carrying)",
        "Mountain Born (acclimated to cold and high altitude)"]
    },
    {
      key: "tabaxi", name: "Tabaxi", size: "Medium", speed: 30,
      asi: { dex: 2, cha: 1 }, languages: ["Common", "one language of choice"],
      traits: ["Darkvision 60 ft", "Feline Agility (double speed for one move per turn)",
        "Cat's Claws (climb speed, unarmed claw damage)", "Cat's Talent (proficiency in Perception and Stealth)"]
    },
    {
      key: "firbolg", name: "Firbolg", size: "Medium", speed: 30,
      asi: { wis: 2, str: 1 }, languages: ["Common", "Elvish", "Giant"],
      traits: ["Firbolg Magic: detect magic / disguise self (as a giant version of yourself), once per rest",
        "Hidden Step: turn invisible as a bonus action", "Powerful Build", "Speech of Beast and Leaf"]
    },
    {
      key: "kenku", name: "Kenku", size: "Medium", speed: 30,
      asi: { dex: 2, wis: 1 }, languages: ["Common", "Auran"],
      traits: ["Expert Forgery", "Mimicry (copy sounds/voices heard)", "Kenku Training (choose two skills from a set list)",
        "Cannot speak except by mimicking"]
    },
    {
      key: "lizardfolk", name: "Lizardfolk", size: "Medium", speed: 30,
      asi: { con: 2, wis: 1 }, languages: ["Common", "Draconic"],
      traits: ["Bite (unarmed natural weapon)", "Natural Armor (13 + Dex)", "Hold Breath 15 minutes",
        "Hungry Jaws (bonus-action bite in a pinch)"]
    },
    {
      key: "tortle", name: "Tortle", size: "Medium", speed: 30,
      asi: { str: 2, wis: 1 }, languages: ["Common", "Aquan"],
      traits: ["Natural Armor 17 (no Dex, can still use a shield)", "Shell Defense (withdraw for extra AC, can't move/attack)",
        "Hold Breath 1 hour", "Claws (unarmed natural weapon)"]
    },
    {
      key: "genasi", name: "Genasi", size: "Medium", speed: 30,
      asi: { con: 2 }, languages: ["Common", "Primordial"],
      traits: ["Elemental heritage flavors your subrace's extra trait"],
      subraces: [
        { key: "air", name: "Air Genasi", asi: { dex: 1 },
          traits: ["Unending Breath (never run out of air)", "Levitate spell 1/day"] },
        { key: "earth", name: "Earth Genasi", asi: { str: 1 },
          traits: ["Earth Walk (no speed penalty over difficult rocky/dirt terrain)", "Pass Without Trace 1/day"] },
        { key: "fire", name: "Fire Genasi", asi: { int: 1 },
          traits: ["Darkvision 60 ft", "Fire Resistance", "Produce Flame, then burning hands 1/day"] },
        { key: "water", name: "Water Genasi", asi: { wis: 1 },
          traits: ["Swim speed 30 ft, breathe air and water", "Acid Resistance",
            "Shape Water, then create/destroy water 1/day"] }
      ]
    },
    {
      key: "orc", name: "Orc", size: "Medium", speed: 30,
      asi: { str: 2, con: 1 }, languages: ["Common", "Orc"],
      traits: ["Darkvision 60 ft", "Aggressive (bonus-action move toward an enemy)", "Powerful Build",
        "Primal Intuition (proficiency in two Survival-flavored skills)"]
    },
    {
      key: "goblin", name: "Goblin", size: "Small", speed: 30,
      asi: { dex: 2, con: 1 }, languages: ["Common", "Goblin"],
      traits: ["Darkvision 60 ft", "Fury of the Small (extra damage vs. larger creatures, once per rest)",
        "Nimble Escape (bonus-action Disengage or Hide)"]
    },
    {
      key: "hobgoblin", name: "Hobgoblin", size: "Medium", speed: 30,
      asi: { con: 2, int: 1 }, languages: ["Common", "Goblin"],
      traits: ["Darkvision 60 ft", "Martial Training (light armor, one martial weapon, one artisan's tool)",
        "Saving Face (bonus to a failed roll if an ally is nearby, once per rest)"]
    },
    {
      key: "bugbear", name: "Bugbear", size: "Medium", speed: 30,
      asi: { str: 2, dex: 1 }, languages: ["Common", "Goblin"],
      traits: ["Darkvision 60 ft", "Long-Limbed (+5 ft reach on melee attacks on your turn)", "Powerful Build",
        "Sneaky (proficiency in Stealth)", "Surprise Attack (extra damage vs. a surprised target)"]
    },
    {
      key: "kobold", name: "Kobold", size: "Small", speed: 30,
      asi: { dex: 2 }, languages: ["Common", "Draconic"],
      traits: ["Darkvision 60 ft", "Pack Tactics (advantage when an ally is adjacent to the target)",
        "Sunlight Sensitivity", "Grovel, Cower, and Beg (bonus action to distract, once per short/long rest)"]
    },
    {
      key: "yuanTi", name: "Yuan-ti Pureblood", size: "Medium", speed: 30,
      asi: { cha: 2, int: 1 }, languages: ["Common", "Abyssal", "Draconic"],
      traits: ["Darkvision 60 ft", "Innate spellcasting: animal friendship (snakes), then suggestion at higher levels",
        "Magic Resistance (advantage vs. spells and magical effects)", "Poison Immunity"]
    },
    {
      key: "aarakocra", name: "Aarakocra", size: "Medium", speed: 25,
      asi: { dex: 2, wis: 1 }, languages: ["Common", "Aarakocra", "Auran"],
      traits: ["Flight speed 50 ft (light/no armor)", "Talons (unarmed natural weapon)"]
    },
    {
      key: "triton", name: "Triton", size: "Medium", speed: 30,
      asi: { str: 1, con: 1, cha: 1 }, languages: ["Common", "Primordial"],
      traits: ["Amphibious, swim speed 30 ft", "Control Air and Water 1/day", "Emissary of the Sea (speak with aquatic beasts)",
        "Guardians of the Depths (cold resistance, no deep-water pressure/cold issues)"]
    },
    {
      key: "changeling", name: "Changeling", size: "Medium", speed: 30, asi: {},
      languages: ["Common", "two languages of choice"],
      traits: ["Ability Score Increase: your choice, +2/+1 or +1/+1/+1 (apply via campaign ASI)",
        "Shapechanger (alter your appearance as an action)", "Changeling Instincts (proficiency in two social skills)"]
    },
    {
      key: "kalashtar", name: "Kalashtar", size: "Medium", speed: 30,
      asi: { wis: 2, cha: 1 }, languages: ["Common", "Quori"],
      traits: ["Dual Mind (advantage on Wisdom saves)", "Mental Discipline (resistance to psychic damage)",
        "Mind Link (telepathy with a bonded creature)", "Severed from Dreams (immune to magical sleep, no dreaming)"]
    },
    {
      key: "shifter", name: "Shifter", size: "Medium", speed: 30,
      asi: {}, languages: ["Common"],
      traits: ["Darkvision 60 ft", "Shifting: bonus action to gain temp HP + a subrace bonus for up to 1 minute, once per rest"],
      subraces: [
        { key: "beasthide", name: "Beasthide Shifter", asi: { con: 2, str: 1 }, traits: ["Shifting grants extra temp HP and resistance to bludgeoning/piercing/slashing"] },
        { key: "longtooth", name: "Longtooth Shifter", asi: { str: 2, dex: 1 }, traits: ["Shifting grants a bite attack"] },
        { key: "swiftstride", name: "Swiftstride Shifter", asi: { dex: 2, cha: 1 }, traits: ["Shifting grants +10 ft speed and a Disengage-like reaction"] },
        { key: "wildhunt", name: "Wildhunt Shifter", asi: { wis: 2, dex: 1 }, traits: ["Shifting grants tracking / can't be surprised while shifted"] }
      ]
    },
    {
      key: "warforged", name: "Warforged", size: "Medium", speed: 30,
      asi: { con: 1 }, languages: ["Common", "one language of choice"],
      traits: ["Ability Score Increase: +2 to one other ability of choice (apply via campaign ASI)",
        "Constructed Resilience (advantage vs. poison, resistance to poison, doesn't need to eat/breathe/sleep)",
        "Sentry's Rest (no need to sleep; long rest only needs 6 hrs stationary)", "Integrated Protection: +1 AC, don wearable armor as if never worn"]
    },
    {
      key: "centaur", name: "Centaur", size: "Medium", speed: 40,
      asi: { str: 2, wis: 1 }, languages: ["Common", "Sylvan"],
      traits: ["Fey", "Charge (extra damage after moving 30+ ft straight toward target)", "Hooves (unarmed natural weapon)",
        "Equine Build (counts as Large for carrying, advantage resisting shove)", "Proficiency in Survival"]
    },
    {
      key: "minotaur", name: "Minotaur", size: "Medium", speed: 30,
      asi: { str: 2, con: 1 }, languages: ["Common", "Minotaur"],
      traits: ["Horns (unarmed natural weapon)", "Goring Rush (bonus-action charge attack after moving 10+ ft)",
        "Hammering Horns (bonus-action shove after a horn hit)", "Imposing Presence (advantage on an intimidation-style check, once per rest)",
        "Labyrinthine Recall (never get lost in mazes you've navigated)"]
    },
    {
      key: "loxodon", name: "Loxodon", size: "Medium", speed: 30,
      asi: { con: 2, wis: 1 }, languages: ["Common", "Loxodon"],
      traits: ["Powerful Build", "Trunk (manipulate small objects, no hands needed)", "Natural Armor",
        "Keen Smell (advantage on Perception/Investigation via smell)", "Loxodon Serenity (advantage vs. charm/frightened)"]
    },
    {
      key: "simicHybrid", name: "Simic Hybrid", size: "Medium", speed: 30,
      asi: { con: 2 }, languages: ["Common", "Elvish"],
      traits: ["Ability Score Increase: +1 to one other ability of choice (apply via campaign ASI)",
        "Animal Enhancement: pick one - gills/swim, grasping tendrils, carapace +1 AC, or manta glide"]
    },
    {
      key: "vedalken", name: "Vedalken", size: "Medium", speed: 30,
      asi: { int: 2, wis: 1 }, languages: ["Common", "Vedalken"],
      traits: ["Vedalken Dispassion (advantage on Wisdom saves vs. being charmed/frightened)",
        "Tireless Precision (add proficiency to any Int/Wis/Cha check that doesn't already use it)",
        "Partially Amphibious (breathe air and water)"]
    },
    {
      key: "satyr", name: "Satyr", size: "Medium", speed: 35,
      asi: { cha: 2, dex: 1 }, languages: ["Common", "Elvish", "Sylvan"],
      traits: ["Fey", "Ram (unarmed natural weapon)", "Magic Resistance (advantage vs. spells and magical effects)",
        "Mirthful Leaps (bonus to jump distance)", "Reveler (proficiency in Performance/Persuasion + one instrument or game set)"]
    },
    {
      key: "githyanki", name: "Githyanki", size: "Medium", speed: 30,
      asi: { str: 2, int: 1 }, languages: ["Common", "Gith"],
      traits: ["Decadent Mastery (learn one language/tool/skill temporarily, once per long rest)",
        "Martial Prodigy (proficiency with light/medium armor, shortsword, longsword, greatsword)",
        "Githyanki Psionics: mage hand, then jump / misty step at higher levels"]
    },
    {
      key: "githzerai", name: "Githzerai", size: "Medium", speed: 30,
      asi: { wis: 2, int: 1 }, languages: ["Common", "Gith"],
      traits: ["Mental Discipline (advantage on saves vs. being charmed/frightened)",
        "Githzerai Psionics: mage hand, then shield / detect thoughts at higher levels"]
    },
    {
      key: "grung", name: "Grung", size: "Small", speed: 25,
      asi: { dex: 2, con: 1 }, languages: ["Grung"],
      traits: ["Amphibious", "Poison Immunity", "Poisonous Skin (touching you risks poison)",
        "Standing Leap (long jump up to 25 ft)", "Water Dependency (must stay moist or start suffocating)"]
    },
    {
      key: "harengon", name: "Harengon", size: "Medium", speed: 30, asi: {},
      languages: ["Common", "one language of choice"],
      traits: ["Ability Score Increase: your choice, +2/+1 or +1/+1/+1 (apply via campaign ASI)",
        "Hare-Trigger (add to initiative rolls)", "Leporine Senses (proficiency in Perception)",
        "Rabbit Hop (bonus-action jump)", "Lucky Footwork (turn a failed Dex save into a success once per rest)"]
    },
    {
      key: "owlin", name: "Owlin", size: "Medium", speed: 30, asi: {},
      languages: ["Common", "one language of choice"],
      traits: ["Ability Score Increase: your choice, +2/+1 or +1/+1/+1 (apply via campaign ASI)",
        "Darkvision 120 ft", "Flight speed 30 ft (light/no armor)", "Silent Feathers (proficiency in Stealth)"]
    },
    {
      key: "fairy", name: "Fairy", size: "Small", speed: 30, asi: {},
      languages: ["Common", "Sylvan"],
      traits: ["Ability Score Increase: your choice, +2/+1 or +1/+1/+1 (apply via campaign ASI)",
        "Flight speed 30 ft", "Fairy Magic: druidcraft, then faerie fire / enlarge-reduce at higher levels"]
    }
  ];
})(window.YARN = window.YARN || {});
