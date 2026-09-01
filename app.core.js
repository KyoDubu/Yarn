/* app.core.js - data model, persistence, and derived-stat math.
 *
 * The rule of this file: NOTHING derived is ever stored. Modifiers, proficiency
 * bonus, AC, save DCs and skill totals are computed on every read. Stored
 * derived values are how character sheets silently drift out of sync.
 */
(function (YARN) {
  "use strict";

  var STORAGE_KEY = "yarn.state";

  // ---- ids -------------------------------------------------------------
  YARN.uid = function (prefix) {
    return (prefix || "id") + "_" +
      Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  };

  // ---- empty shapes ----------------------------------------------------
  // One place that knows what a blank record looks like.
  YARN.blankCharacter = function () {
    return {
      id: YARN.uid("char"),
      name: "",
      species: "human",
      klass: "fighter",
      subclass: "",
      background: "Folk Hero",
      alignment: "True Neutral",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      saveProfs: [],
      skillProfs: [],
      skillExpertise: [],
      portrait: "",
      backstory: "",
      personality: "",
      ideals: "",
      bonds: "",
      flaws: "",
      // Opt-in extensions. When enabled:false this character is pure SRD and
      // none of these lists affect any math. Homebrew is additive, never
      // destructive - turning it off simply stops rendering the extras.
      homebrew: {
        enabled: false,
        customSkills: [],   // [{ key, name, ability }] - ability must be an SRD key
        currencies: [],     // [{ key, name }] - extra coin types, e.g. MP
        resources: []       // [{ key, name }] - meters like Bardic Inspiration
      }
    };
  };

  YARN.blankCampaign = function () {
    return {
      id: YARN.uid("camp"),
      name: "",
      dm: "",
      setting: "",
      notes: "",
      archived: false
    };
  };

  // A character's state WITHIN one campaign. This is the whole point of Yarn:
  // the same character can hold several of these at once, one per campaign.
  YARN.blankProgress = function () {
    return {
      level: 1,
      xp: 0,
      hpMax: 0,
      hpCurrent: 0,
      hpTemp: 0,
      hitDiceUsed: 0,
      deathSaves: { success: 0, fail: 0 },
      armorWorn: "none",
      shield: false,
      conditions: [],
      inventory: [],
      currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      currencyExtra: {},   // homebrew coin balances, keyed by currency key
      resourcesUsed: {},   // homebrew meters: key -> { current, max }
      spellSlotsUsed: {},
      asi: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      notes: "",
      sessions: []
    };
  };

  YARN.blankState = function () {
    return {
      characters: [],
      campaigns: [],
      progress: {},
      ui: { activeCharId: null, activeCampaignId: null, tab: "roster" }
    };
  };

  // ---- normalize -------------------------------------------------------
  // Runs on every load. Fills in fields added by later versions so old saves
  // keep working. Mirrors the Budget Planner's normalize() contract.
  function fillDefaults(target, defaults) {
    Object.keys(defaults).forEach(function (k) {
      if (target[k] === undefined || target[k] === null) {
        target[k] = defaults[k];
      }
    });
    return target;
  }

  YARN.normalize = function (raw) {
    var s = raw && typeof raw === "object" ? raw : {};
    fillDefaults(s, YARN.blankState());

    if (!Array.isArray(s.characters)) { s.characters = []; }
    if (!Array.isArray(s.campaigns)) { s.campaigns = []; }
    if (!s.progress || typeof s.progress !== "object") { s.progress = {}; }

    s.characters = s.characters.map(function (c) {
      var blank = YARN.blankCharacter();
      blank.id = c.id || blank.id;
      fillDefaults(c, blank);
      c.abilities = fillDefaults(c.abilities || {}, blank.abilities);
      c.homebrew = fillDefaults(c.homebrew || {}, blank.homebrew);
      if (!Array.isArray(c.homebrew.customSkills)) { c.homebrew.customSkills = []; }
      if (!Array.isArray(c.homebrew.currencies)) { c.homebrew.currencies = []; }
      if (!Array.isArray(c.homebrew.resources)) { c.homebrew.resources = []; }
      return c;
    });

    s.campaigns = s.campaigns.map(function (c) {
      var blank = YARN.blankCampaign();
      blank.id = c.id || blank.id;
      return fillDefaults(c, blank);
    });

    // Drop progress buckets whose campaign or character no longer exists,
    // then backfill any missing fields on the survivors.
    var charIds = {}, campIds = {};
    s.characters.forEach(function (c) { charIds[c.id] = true; });
    s.campaigns.forEach(function (c) { campIds[c.id] = true; });

    Object.keys(s.progress).forEach(function (campId) {
      if (!campIds[campId]) { delete s.progress[campId]; return; }
      var bucket = s.progress[campId];
      Object.keys(bucket).forEach(function (cid) {
        if (!charIds[cid]) { delete bucket[cid]; return; }
        var blank = YARN.blankProgress();
        fillDefaults(bucket[cid], blank);
        bucket[cid].deathSaves = fillDefaults(bucket[cid].deathSaves || {}, blank.deathSaves);
        bucket[cid].currency = fillDefaults(bucket[cid].currency || {}, blank.currency);
        bucket[cid].asi = fillDefaults(bucket[cid].asi || {}, blank.asi);
        if (!bucket[cid].currencyExtra || typeof bucket[cid].currencyExtra !== "object") { bucket[cid].currencyExtra = {}; }
        if (!bucket[cid].resourcesUsed || typeof bucket[cid].resourcesUsed !== "object") { bucket[cid].resourcesUsed = {}; }
      });
    });

    s.ui = fillDefaults(s.ui || {}, YARN.blankState().ui);
    return s;
  };

  // ---- persistence -----------------------------------------------------
  YARN.state = YARN.normalize(null);

  YARN.load = function () {
    var raw = null;
    try {
      raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      raw = null; // corrupt save should not brick the app
    }
    YARN.state = YARN.normalize(raw);
    return YARN.state;
  };

  YARN.save = function () {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(YARN.state));
    } catch (e) {
      // Quota or private mode. Never let a failed save break the UI.
    }
    if (typeof YARN.onSave === "function") { YARN.onSave(YARN.state); }
    return YARN.state;
  };

  // ---- lookups ---------------------------------------------------------
  function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { return list[i]; }
    }
    return null;
  }
  YARN.getCharacter = function (id) { return findById(YARN.state.characters, id); };
  YARN.getCampaign = function (id) { return findById(YARN.state.campaigns, id); };

  // Returns the progress bucket, creating it on first access. This is the
  // single gateway to per-campaign state - nothing else should touch
  // state.progress directly.
  YARN.getProgress = function (campaignId, characterId) {
    if (!campaignId || !characterId) { return null; }
    if (!YARN.state.progress[campaignId]) { YARN.state.progress[campaignId] = {}; }
    var bucket = YARN.state.progress[campaignId];
    if (!bucket[characterId]) { bucket[characterId] = YARN.blankProgress(); }
    return bucket[characterId];
  };

  // Every campaign a given character is being played in.
  YARN.campaignsFor = function (characterId) {
    return YARN.state.campaigns.filter(function (camp) {
      var bucket = YARN.state.progress[camp.id];
      return !!(bucket && bucket[characterId]);
    });
  };

  // Every character in a given campaign.
  YARN.charactersIn = function (campaignId) {
    var bucket = YARN.state.progress[campaignId] || {};
    return YARN.state.characters.filter(function (c) { return !!bucket[c.id]; });
  };

  // ---- derived stats ---------------------------------------------------
  // The math. All pure functions, all recomputed on every render.

  YARN.mod = function (score) { return Math.floor((Number(score) - 10) / 2); };

  YARN.profBonus = function (level) {
    var lvl = Math.max(1, Math.min(20, Number(level) || 1));
    return 2 + Math.floor((lvl - 1) / 4);
  };

  // Base score + species ASI + campaign-earned ASI. A character can have
  // different final scores in different campaigns, which is correct: they
  // levelled up separately.
  YARN.abilityScore = function (char, prog, key) {
    if (!char) { return 10; }
    var base = Number(char.abilities[key]) || 10;
    var species = YARN.speciesInfo(char.species);
    var speciesBonus = (species && species.asi[key]) || 0;
    var earned = (prog && prog.asi && prog.asi[key]) || 0;
    return base + speciesBonus + earned;
  };

  YARN.abilityMod = function (char, prog, key) {
    return YARN.mod(YARN.abilityScore(char, prog, key));
  };

  YARN.saveTotal = function (char, prog, key) {
    var total = YARN.abilityMod(char, prog, key);
    var cls = YARN.classInfo(char.klass);
    var proficient = (cls && cls.saves.indexOf(key) !== -1) ||
                     char.saveProfs.indexOf(key) !== -1;
    if (proficient) { total += YARN.profBonus(prog ? prog.level : 1); }
    return total;
  };

  YARN.skillTotal = function (char, prog, skillKey) {
    var skill = YARN.skillInfoFor(char, skillKey);
    if (!skill) { return 0; }
    var total = YARN.abilityMod(char, prog, skill.ability);
    var pb = YARN.profBonus(prog ? prog.level : 1);
    if (char.skillExpertise.indexOf(skillKey) !== -1) { total += pb * 2; }
    else if (char.skillProfs.indexOf(skillKey) !== -1) { total += pb; }
    return total;
  };

  YARN.passivePerception = function (char, prog) {
    return 10 + YARN.skillTotal(char, prog, "perception");
  };

  // The skill list for a character: SRD skills, plus any homebrew custom
  // skills when homebrew is enabled. One place decides what "a skill" is.
  YARN.skillsFor = function (char) {
    var list = YARN.SKILLS.slice();
    if (char && char.homebrew && char.homebrew.enabled &&
        Array.isArray(char.homebrew.customSkills)) {
      char.homebrew.customSkills.forEach(function (s) {
        if (s && s.key && s.ability) { list.push(s); }
      });
    }
    return list;
  };

  YARN.skillInfoFor = function (char, key) {
    var list = YARN.skillsFor(char);
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) { return list[i]; }
    }
    return null;
  };

  YARN.initiative = function (char, prog) {
    return YARN.abilityMod(char, prog, "dex");
  };

  // Armor table lives here rather than app.rules.js because AC is computed,
  // not looked up - the dex cap is behavior, not reference data.
  var ARMOR = {
    none:     { base: 10, dexCap: null },
    leather:  { base: 11, dexCap: null },
    studded:  { base: 12, dexCap: null },
    hide:     { base: 12, dexCap: 2 },
    chainShirt: { base: 13, dexCap: 2 },
    scale:    { base: 14, dexCap: 2 },
    halfPlate: { base: 15, dexCap: 2 },
    ringMail: { base: 14, dexCap: 0 },
    chainMail: { base: 16, dexCap: 0 },
    splint:   { base: 17, dexCap: 0 },
    plate:    { base: 18, dexCap: 0 }
  };
  YARN.ARMOR = ARMOR;

  YARN.ac = function (char, prog) {
    var armor = ARMOR[(prog && prog.armorWorn) || "none"] || ARMOR.none;
    var dex = YARN.abilityMod(char, prog, "dex");
    if (armor.dexCap !== null) { dex = Math.min(dex, armor.dexCap); }
    return armor.base + dex + (prog && prog.shield ? 2 : 0);
  };

  YARN.spellAbilityKey = function (char) {
    var cls = YARN.classInfo(char.klass);
    return cls ? cls.spellAbility : null;
  };

  YARN.spellSaveDC = function (char, prog) {
    var key = YARN.spellAbilityKey(char);
    if (!key) { return null; }
    return 8 + YARN.profBonus(prog ? prog.level : 1) + YARN.abilityMod(char, prog, key);
  };

  YARN.spellAttack = function (char, prog) {
    var key = YARN.spellAbilityKey(char);
    if (!key) { return null; }
    return YARN.profBonus(prog ? prog.level : 1) + YARN.abilityMod(char, prog, key);
  };

  // Average HP: full hit die at level 1, then average roll (die/2 + 1) per
  // level after, plus CON mod every level. The standard "take average" rule.
  YARN.suggestedHpMax = function (char, prog) {
    var cls = YARN.classInfo(char.klass);
    if (!cls) { return 0; }
    var level = Math.max(1, (prog && prog.level) || 1);
    var con = YARN.abilityMod(char, prog, "con");
    var perLevel = Math.floor(cls.hitDie / 2) + 1;
    return cls.hitDie + con + (level - 1) * (perLevel + con);
  };

  YARN.levelForXp = function (xp) {
    var table = YARN.XP_FOR_LEVEL, level = 1;
    for (var i = 1; i < table.length; i++) {
      if (Number(xp) >= table[i]) { level = i; }
    }
    return level;
  };

  // Slots available at a level, respecting the class's caster progression.
  YARN.spellSlots = function (char, prog) {
    var cls = YARN.classInfo(char.klass);
    if (!cls || !cls.caster) { return null; }
    var level = Math.max(1, (prog && prog.level) || 1);
    var effective = level;
    if (cls.caster === "half") { effective = Math.floor(level / 2); }
    if (cls.caster === "third") { effective = Math.floor(level / 3); }
    if (effective < 1) { return null; }
    return YARN.FULL_CASTER_SLOTS[Math.min(20, effective)] || null;
  };

  // Convenience bundle so renderers make ONE call instead of a dozen.
  YARN.derived = function (char, prog) {
    if (!char) { return null; }
    var scores = {}, mods = {}, saves = {}, skills = {};
    YARN.ABILITY_KEYS.forEach(function (k) {
      scores[k] = YARN.abilityScore(char, prog, k);
      mods[k] = YARN.mod(scores[k]);
      saves[k] = YARN.saveTotal(char, prog, k);
    });
    YARN.skillsFor(char).forEach(function (s) {
      skills[s.key] = YARN.skillTotal(char, prog, s.key);
    });
    return {
      scores: scores,
      mods: mods,
      saves: saves,
      skills: skills,
      profBonus: YARN.profBonus(prog ? prog.level : 1),
      ac: YARN.ac(char, prog),
      initiative: YARN.initiative(char, prog),
      passivePerception: YARN.passivePerception(char, prog),
      spellSaveDC: YARN.spellSaveDC(char, prog),
      spellAttack: YARN.spellAttack(char, prog),
      suggestedHpMax: YARN.suggestedHpMax(char, prog),
      slots: YARN.spellSlots(char, prog)
    };
  };

  // ---- dice ------------------------------------------------------------
  // Every roller takes an optional rng so tests can feed a deterministic
  // sequence. Default is Math.random. rng() must return [0, 1).
  function defaultRng() { return Math.random(); }

  YARN.rollDie = function (sides, rng) {
    rng = rng || defaultRng;
    return 1 + Math.floor(rng() * sides);
  };

  // Roll 4d6, drop the lowest, sum the rest. The classic stat-line roll.
  YARN.roll4d6DropLowest = function (rng) {
    rng = rng || defaultRng;
    var rolls = [YARN.rollDie(6, rng), YARN.rollDie(6, rng),
                 YARN.rollDie(6, rng), YARN.rollDie(6, rng)];
    var sorted = rolls.slice().sort(function (a, b) { return a - b; });
    return { rolls: rolls, dropped: sorted[0], total: sorted[1] + sorted[2] + sorted[3] };
  };

  // Six independent 4d6-drop-lowest results, ready to assign to abilities.
  YARN.rollAbilitySet = function (rng) {
    rng = rng || defaultRng;
    var out = [];
    for (var i = 0; i < 6; i++) { out.push(YARN.roll4d6DropLowest(rng)); }
    return out;
  };

  // ---- point buy -------------------------------------------------------
  // Cost of a single score under the 27-point system. Out-of-range scores
  // cost Infinity, which makes any line containing one "invalid".
  YARN.pointBuyCostFor = function (score) {
    var c = YARN.POINT_BUY_COST[score];
    return c === undefined ? Infinity : c;
  };

  YARN.pointBuySpent = function (scores) {
    return YARN.ABILITY_KEYS.reduce(function (sum, k) {
      return sum + YARN.pointBuyCostFor(Number(scores[k]));
    }, 0);
  };

  YARN.pointBuyRemaining = function (scores) {
    return YARN.POINT_BUY_BUDGET - YARN.pointBuySpent(scores);
  };

  YARN.pointBuyValid = function (scores) {
    return YARN.pointBuySpent(scores) <= YARN.POINT_BUY_BUDGET;
  };

  // ---- random name -----------------------------------------------------
  YARN.randomName = function (rng) {
    rng = rng || defaultRng;
    var p = YARN.NAME_PARTS.prefix, s = YARN.NAME_PARTS.suffix;
    var a = p[Math.floor(rng() * p.length)];
    var b = s[Math.floor(rng() * s.length)];
    return a + b;
  };

  // ---- clone -----------------------------------------------------------
  // Deep-copy a character's CORE identity (not per-campaign progress) into a
  // brand-new record. opts.asHomebrew flips homebrew mode on; opts.nameSuffix
  // is appended to the name. Returns the new character WITHOUT pushing it -
  // the caller decides when to commit it to state.
  YARN.cloneCharacter = function (charId, opts) {
    var src = YARN.getCharacter(charId);
    if (!src) { return null; }
    opts = opts || {};
    var copy = JSON.parse(JSON.stringify(src)); // structural deep copy
    copy.id = YARN.uid("char");
    if (opts.nameSuffix) { copy.name = (copy.name || "Unnamed") + opts.nameSuffix; }
    // normalize() guarantees the homebrew block exists, but be defensive.
    if (!copy.homebrew || typeof copy.homebrew !== "object") {
      copy.homebrew = YARN.blankCharacter().homebrew;
    }
    if (opts.asHomebrew) { copy.homebrew.enabled = true; }
    return copy;
  };

  // Clone as a homebrew variant, commit it to state, and return it. This is
  // the "make a homebrew version of an existing character" action - the
  // original is left completely untouched.
  YARN.cloneAsHomebrew = function (charId) {
    var copy = YARN.cloneCharacter(charId, { asHomebrew: true, nameSuffix: " (Homebrew)" });
    if (!copy) { return null; }
    YARN.state.characters.push(copy);
    return copy;
  };
})(window.YARN = window.YARN || {});
