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
      subspecies: "",
      klass: "fighter",
      subclass: "",
      background: "Folk Hero",
      alignment: "True Neutral",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      // 2024 rules: species grants NO ability bonus - the bonus moved to
      // Background instead (player picks +2/+1 split or +1/+1/+1 spread
      // across that background's 3 candidate abilities). See
      // YARN.backgroundAbilityChoices / YARN.abilityScore.
      backgroundAsi: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
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
      // Multiclass breakdown FOR THIS CAMPAIGN, e.g. {fighter: 3, wizard: 2}.
      // Empty by default - an empty object means "single-classed, just use
      // char.klass + level above" so every existing save and every player
      // who never multiclasses sees zero change. Populating this is what
      // actually turns on multiclass math - see YARN.totalLevel/classBreakdown.
      classLevels: {},
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
      // General/racial feats CHOSEN during play (level 4/8/12/16/19 ASI
      // trade-ins) - never includes the character's origin feat, which is
      // automatic from the Background and needs no slot (see
      // YARN.originFeatKey/YARN.allFeatKeys in this file). featAbilityChoice
      // is only consulted for feats whose catalog entry has abilityChoices,
      // e.g. {resilient: "con"} for "picked CON when I took Resilient".
      feats: [],
      featAbilityChoice: {},
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
      c.backgroundAsi = fillDefaults(c.backgroundAsi || {}, blank.backgroundAsi);
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
        if (!bucket[cid].classLevels || typeof bucket[cid].classLevels !== "object") { bucket[cid].classLevels = {}; }
        if (!Array.isArray(bucket[cid].feats)) { bucket[cid].feats = []; }
        if (!bucket[cid].featAbilityChoice || typeof bucket[cid].featAbilityChoice !== "object") { bucket[cid].featAbilityChoice = {}; }
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

  // ---- Feats --------------------------------------------------------
  // The feat automatically granted by a character's Background (2024
  // backgrounds only - the original 13 2014-style ones grant a `feature`
  // instead and have no originFeatKey). Free, no level gate, never lives
  // in prog.feats.
  YARN.originFeatKey = function (char) {
    var info = char ? YARN.backgroundInfo(char.background) : null;
    return (info && info.originFeatKey) || null;
  };

  // Every feat this character currently has IN THIS CAMPAIGN: the (at
  // most one) origin feat, plus whatever general/racial feats were
  // chosen during play. This is the one list every feat-driven calc
  // below reads from.
  YARN.allFeatKeys = function (char, prog) {
    var keys = [];
    var origin = YARN.originFeatKey(char);
    if (origin) { keys.push(origin); }
    (prog && Array.isArray(prog.feats) ? prog.feats : []).forEach(function (k) {
      if (keys.indexOf(k) === -1) { keys.push(k); }
    });
    return keys;
  };

  // ASI-or-feat decision points reached so far: one per YARN.ASI_LEVELS
  // entry the character's total level has reached. Real 5e actually ties
  // this to each CLASS's own level (multiclassing can offer more slots
  // than a same-level single-classed character), but Yarn simplifies to
  // total level here, same spirit as the multiclass spellcasting
  // simplification from v1.11 - the Feats panel says so on the sheet.
  YARN.asiSlotsAvailable = function (char, prog) {
    var level = YARN.totalLevel(char, prog);
    return YARN.ASI_LEVELS.filter(function (l) { return level >= l; }).length;
  };

  // Sum of +1s from every feat that grants an ability bonus to THIS key
  // (Resilient, Actor, Elven Accuracy...). A character can stack several
  // different ability-bonus feats - each contributes independently, that
  // really is how 5e works.
  YARN.featAbilityBonus = function (char, prog, key) {
    var choices = (prog && prog.featAbilityChoice) || {};
    return YARN.allFeatKeys(char, prog).reduce(function (sum, fk) {
      var feat = YARN.featInfo(fk);
      if (feat && feat.mechanic === "abilityBonus" && choices[fk] === key) { return sum + 1; }
      return sum;
    }, 0);
  };

  // Resilient is the only feat that also grants a save proficiency - it's
  // tied to whichever ability you picked for its +1.
  YARN.featGrantsSaveProf = function (char, prog, key) {
    var choices = (prog && prog.featAbilityChoice) || {};
    return YARN.allFeatKeys(char, prog).some(function (fk) {
      var feat = YARN.featInfo(fk);
      return !!(feat && feat.grantsSaveProf && choices[fk] === key);
    });
  };

  // Tough's flat "+2 HP per level, retroactively" - the only feat with a
  // pure-math effect on hit points.
  YARN.featFlatHpBonus = function (char, prog) {
    var level = YARN.totalLevel(char, prog);
    return YARN.allFeatKeys(char, prog).reduce(function (sum, fk) {
      var feat = YARN.featInfo(fk);
      if (feat && feat.mechanic === "flatHpPerLevel") { return sum + feat.mechanicValue * level; }
      return sum;
    }, 0);
  };

  // Base score + background ASI (2024 rules - species grants no ability
  // bonus at all, see DEVLOG v1.9) + campaign-earned ASI + feat ability
  // bonuses (Resilient, Actor, Elven Accuracy...). A character can have
  // different final scores in different campaigns, which is correct:
  // they levelled up separately.
  YARN.abilityScore = function (char, prog, key) {
    if (!char) { return 10; }
    var base = Number(char.abilities[key]) || 10;
    var backgroundBonus = (char.backgroundAsi && char.backgroundAsi[key]) || 0;
    var earned = (prog && prog.asi && prog.asi[key]) || 0;
    var featBonus = YARN.featAbilityBonus(char, prog, key);
    return base + backgroundBonus + earned + featBonus;
  };

  // 2024 background ASI math. A background offers exactly 3 candidate
  // abilities (YARN.backgroundAbilityChoices); you spend exactly 3 points
  // across them, never more than +2 on one. Because there are only 3 slots
  // each capped 0-2, "spends exactly 3, none over 2" is enough to guarantee
  // a RAW-legal split - there is no other way to total 3 across three
  // 0-2 slots except a {2,1,0} permutation or {1,1,1}, both legal.
  YARN.backgroundAsiSpent = function (asiMap) {
    return YARN.ABILITY_KEYS.reduce(function (sum, k) {
      return sum + (Number(asiMap && asiMap[k]) || 0);
    }, 0);
  };
  YARN.backgroundAsiValid = function (asiMap) {
    if (!asiMap) { return false; }
    var inRange = YARN.ABILITY_KEYS.every(function (k) {
      var v = Number(asiMap[k]) || 0;
      return v >= 0 && v <= 2;
    });
    return inRange && YARN.backgroundAsiSpent(asiMap) === 3;
  };

  // Combined ability bonuses from species + chosen subspecies. HISTORICAL
  // REFERENCE ONLY as of the 2024 rules migration - this used to feed
  // abilityScore() directly (2014 rule: species gives a fixed bonus,
  // subrace bonuses stack on top). It's kept around because the source
  // data (app.species.js) still records the old 2014 numbers for lore
  // accuracy, but nothing in the live math calls this anymore.
  YARN.speciesASI = function (char) {
    var out = {};
    if (!char) { return out; }
    var sp = YARN.speciesInfo(char.species);
    if (sp && sp.asi) {
      Object.keys(sp.asi).forEach(function (k) { out[k] = (out[k] || 0) + sp.asi[k]; });
    }
    var sub = YARN.subspeciesInfo(char.species, char.subspecies);
    if (sub && sub.asi) {
      Object.keys(sub.asi).forEach(function (k) { out[k] = (out[k] || 0) + sub.asi[k]; });
    }
    return out;
  };

  // A subspecies may override its parent's speed or size (e.g. Wood Elf
  // runs at 35 ft instead of the base Elf's 30).
  YARN.speciesSpeed = function (char) {
    if (!char) { return 30; }
    var sub = YARN.subspeciesInfo(char.species, char.subspecies);
    if (sub && sub.speed) { return sub.speed; }
    var sp = YARN.speciesInfo(char.species);
    return sp ? sp.speed : 30;
  };

  YARN.speciesSize = function (char) {
    if (!char) { return "Medium"; }
    var sub = YARN.subspeciesInfo(char.species, char.subspecies);
    if (sub && sub.size) { return sub.size; }
    var sp = YARN.speciesInfo(char.species);
    return sp ? sp.size : "Medium";
  };

  // One bundle for the sheet's "Species Traits" panel: display-only text,
  // never fed back into the math. Base species traits/languages come first,
  // then the subspecies' - matching how a player reads a stat block.
  // (No `asi` field here - species grants zero ability bonus under 2024
  // rules; see YARN.speciesASI's comment if you need the old 2014 numbers.)
  YARN.speciesProfile = function (char) {
    var sp = char ? YARN.speciesInfo(char.species) : null;
    var sub = char ? YARN.subspeciesInfo(char.species, char.subspecies) : null;
    return {
      name: sp ? sp.name : "",
      subName: sub ? sub.name : "",
      size: YARN.speciesSize(char),
      speed: YARN.speciesSpeed(char),
      languages: (sp && sp.languages ? sp.languages.slice() : []).concat(sub && sub.languages ? sub.languages : []),
      traits: (sp && sp.traits ? sp.traits.slice() : []).concat(sub && sub.traits ? sub.traits : [])
    };
  };

  YARN.abilityMod = function (char, prog, key) {
    return YARN.mod(YARN.abilityScore(char, prog, key));
  };

  // Ordered [{key, cls, levels}] breakdown of a character's classes WITHIN
  // one campaign. char.klass (chosen at creation) always comes first - RAW
  // cares which class you STARTED as for two things: saving throw
  // proficiencies only ever come from that one, and its level 1 is the one
  // that gets a max (not average) hit die. An empty prog.classLevels means
  // "never multiclassed", so this falls back to the plain single-class
  // shape Yarn has always used - zero behavior change for anyone who never
  // touches the multiclass UI.
  YARN.classBreakdown = function (char, prog) {
    var extra = (prog && prog.classLevels) || {};
    var keys = Object.keys(extra);
    if (!keys.length) {
      var lvl = Math.max(1, (prog && prog.level) || 1);
      return [{ key: char.klass, cls: YARN.classInfo(char.klass), levels: lvl }];
    }
    var out = [], starterSeen = false;
    if (extra[char.klass] !== undefined) {
      out.push({ key: char.klass, cls: YARN.classInfo(char.klass), levels: Math.max(1, extra[char.klass]) });
      starterSeen = true;
    }
    keys.forEach(function (k) {
      if (k === char.klass) { return; }
      out.push({ key: k, cls: YARN.classInfo(k), levels: Math.max(1, extra[k]) });
    });
    if (!starterSeen) {
      out.unshift({ key: char.klass, cls: YARN.classInfo(char.klass), levels: 1 });
    }
    return out;
  };

  // Total character level = sum across every class. This is the number
  // that drives proficiency bonus, XP-derived level display, etc. - RAW is
  // explicit that multiclassing never changes how proficiency bonus scales.
  YARN.totalLevel = function (char, prog) {
    return YARN.classBreakdown(char, prog).reduce(function (sum, e) { return sum + e.levels; }, 0);
  };

  YARN.saveTotal = function (char, prog, key) {
    var total = YARN.abilityMod(char, prog, key);
    var cls = YARN.classInfo(char.klass);
    var proficient = (cls && cls.saves.indexOf(key) !== -1) ||
                     char.saveProfs.indexOf(key) !== -1 ||
                     YARN.featGrantsSaveProf(char, prog, key);
    if (proficient) { total += YARN.profBonus(YARN.totalLevel(char, prog)); }
    return total;
  };

  // Skills granted automatically by the character's background (2014 PHB:
  // always fixed, never a player choice). Mirrors how class saves are baked
  // into saveTotal - no separate "backgroundSkillProfs" list to store or let
  // drift out of sync with the background you picked.
  YARN.backgroundSkills = function (char) {
    var info = char ? YARN.backgroundInfo(char.background) : null;
    return info ? info.skills.slice() : [];
  };

  YARN.skillTotal = function (char, prog, skillKey) {
    var skill = YARN.skillInfoFor(char, skillKey);
    if (!skill) { return 0; }
    var total = YARN.abilityMod(char, prog, skill.ability);
    var pb = YARN.profBonus(YARN.totalLevel(char, prog));
    var fromBackground = YARN.backgroundSkills(char).indexOf(skillKey) !== -1;
    if (char.skillExpertise.indexOf(skillKey) !== -1) { total += pb * 2; }
    else if (fromBackground || char.skillProfs.indexOf(skillKey) !== -1) { total += pb; }
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
    var base = YARN.abilityMod(char, prog, "dex");
    // Alert (2024 wording): bonus to initiative equal to proficiency bonus.
    if (YARN.allFeatKeys(char, prog).indexOf("alert") !== -1) {
      base += YARN.profBonus(YARN.totalLevel(char, prog));
    }
    return base;
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
    return 8 + YARN.profBonus(YARN.totalLevel(char, prog)) + YARN.abilityMod(char, prog, key);
  };

  YARN.spellAttack = function (char, prog) {
    var key = YARN.spellAbilityKey(char);
    if (!key) { return null; }
    return YARN.profBonus(YARN.totalLevel(char, prog)) + YARN.abilityMod(char, prog, key);
  };

  // Average HP: the level-1 class gets its MAX hit die + CON (the classic
  // "take max at level 1" rule); every level after that - regardless of
  // which class it lands in once multiclassed - gets that class's own
  // average roll (die/2 + 1) + CON. For a single-classed character this is
  // mathematically identical to the old flat formula.
  YARN.suggestedHpMax = function (char, prog) {
    var breakdown = YARN.classBreakdown(char, prog);
    var con = YARN.abilityMod(char, prog, "con");
    var total = 0, first = true;
    breakdown.forEach(function (entry) {
      if (!entry.cls) { return; }
      for (var i = 0; i < entry.levels; i++) {
        if (first) { total += entry.cls.hitDie + con; first = false; }
        else { total += Math.floor(entry.cls.hitDie / 2) + 1 + con; }
      }
    });
    return total + YARN.featFlatHpBonus(char, prog);
  };

  // Hit dice pool grouped by die size, e.g. {10: 3, 6: 2} for a Fighter
  // 3/Wizard 2. Display-only for now (actual short-rest spending still uses
  // the single hitDiceUsed counter) but this is what a future rest-tracker
  // panel needs, and it falls straight out of the same breakdown.
  YARN.hitDicePool = function (char, prog) {
    var pool = {};
    YARN.classBreakdown(char, prog).forEach(function (entry) {
      if (!entry.cls) { return; }
      pool[entry.cls.hitDie] = (pool[entry.cls.hitDie] || 0) + entry.levels;
    });
    return pool;
  };

  YARN.levelForXp = function (xp) {
    var table = YARN.XP_FOR_LEVEL, level = 1;
    for (var i = 1; i < table.length; i++) {
      if (Number(xp) >= table[i]) { level = i; }
    }
    return level;
  };

  // Multiclass Spellcasting (PHB rule): full casters contribute their whole
  // level to a combined caster level, half casters floor(level/2), third
  // casters floor(level/3) - sum those and look the total up on the same
  // full-caster table. Warlock's Pact Magic is its OWN separate pool (short
  // rest, tiny fixed table) and never joins that combined total, whether or
  // not you're multiclassed - that was wrong before this pass too (Warlock
  // slots were silently using the full-caster table).
  YARN.spellSlots = function (char, prog) {
    var breakdown = YARN.classBreakdown(char, prog);
    var casterLevel = 0, pactLevel = 0;
    breakdown.forEach(function (entry) {
      if (!entry.cls || !entry.cls.caster) { return; }
      if (entry.cls.caster === "full") { casterLevel += entry.levels; }
      else if (entry.cls.caster === "half") { casterLevel += Math.floor(entry.levels / 2); }
      else if (entry.cls.caster === "third") { casterLevel += Math.floor(entry.levels / 3); }
      else if (entry.cls.caster === "pact") { pactLevel += entry.levels; }
    });
    var slots = casterLevel > 0 ? (YARN.FULL_CASTER_SLOTS[Math.min(20, casterLevel)] || null) : null;
    var pact = pactLevel > 0 ? (YARN.PACT_SLOTS[Math.min(20, pactLevel)] || null) : null;
    if (!slots && !pact) { return null; }
    return { slots: slots, pact: pact };
  };

  // Convenience bundle so renderers make ONE call instead of a dozen.
  YARN.derived = function (char, prog) {
    if (!char) { return null; }
    var scores = {}, mods = {}, saves = {}, skills = {};
    var totalLevel = YARN.totalLevel(char, prog);
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
      profBonus: YARN.profBonus(totalLevel),
      totalLevel: totalLevel,
      classBreakdown: YARN.classBreakdown(char, prog),
      hitDicePool: YARN.hitDicePool(char, prog),
      feats: YARN.allFeatKeys(char, prog),
      originFeatKey: YARN.originFeatKey(char),
      asiSlotsAvailable: YARN.asiSlotsAvailable(char, prog),
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
