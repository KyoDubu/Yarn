/* app.ui.js - the character sheet renderer + interaction wiring.
 *
 * Rendering contract:
 *  - render()          rebuilds the whole DOM. Called on structural changes
 *                      (switch character/campaign, toggle homebrew, add/remove
 *                      a custom skill/currency/resource).
 *  - refreshDerived()  recomputes derived stats and writes them into every
 *                      [data-out] node WITHOUT rebuilding inputs, so typing in
 *                      a text field never loses focus.
 *
 * Nothing derived is stored - refreshDerived() always reads YARN.derived().
 */
(function (YARN) {
  "use strict";

  var UI = YARN.UI = {};
  var root; // #app

  // ---- tiny helpers ----------------------------------------------------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function signed(n) { n = Number(n) || 0; return (n >= 0 ? "+" : "") + n; }
  function ui() { return YARN.state.ui; }
  function activeChar() { return YARN.getCharacter(ui().activeCharId); }
  function activeCamp() { return YARN.getCampaign(ui().activeCampaignId); }
  function activeProg() {
    var c = activeChar(), k = activeCamp();
    if (!c || !k) { return null; }
    var bucket = YARN.state.progress[k.id];
    if (!bucket || !bucket[c.id]) { return null; }
    return YARN.getProgress(k.id, c.id);
  }
  function slug(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") ||
      ("k" + Math.random().toString(36).slice(2, 6));
  }

  // ---- model binding ---------------------------------------------------
  function applyModel(path, val) {
    var parts = path.split(".");
    var obj = parts.shift() === "char" ? activeChar() : activeProg();
    if (!obj) { return; }
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (obj[k] == null || typeof obj[k] !== "object") { obj[k] = {}; }
      obj = obj[k];
    }
    obj[parts[parts.length - 1]] = val;
  }

  function toggleProf(kind, key, on) {
    var char = activeChar();
    if (!char) { return; }
    var arr = kind === "save" ? char.saveProfs
            : kind === "exp" ? char.skillExpertise
            : char.skillProfs;
    var i = arr.indexOf(key);
    if (on && i === -1) { arr.push(key); }
    if (!on && i !== -1) { arr.splice(i, 1); }
  }

  // ---- render: top bar -------------------------------------------------
  function optionList(items, activeId, placeholder) {
    var html = '<option value="">' + esc(placeholder) + "</option>";
    items.forEach(function (it) {
      html += '<option value="' + esc(it.id) + '"' +
        (it.id === activeId ? " selected" : "") + ">" +
        esc(it.name || "(unnamed)") + "</option>";
    });
    return html;
  }

  function topbar() {
    var char = activeChar();
    var cloneBtn = char
      ? '<button class="ghost" data-action="clone-homebrew" title="Duplicate this character into a new homebrew copy">\u2398 Homebrew copy</button>'
      : "";
    return '' +
      '<div class="topbar">' +
        '<span class="brand"><img src="Static/yarn.png" alt="" class="brand-logo">Yarn</span>' +
        '<div><label for="selChar">Character</label>' +
          '<select id="selChar" data-action="pick-char">' +
          optionList(YARN.state.characters, ui().activeCharId, "\u2014 pick \u2014") +
          "</select></div>" +
        '<button class="ghost" data-action="new-char">+ Character</button>' +
        cloneBtn +
        '<div><label for="selCamp">Campaign</label>' +
          '<select id="selCamp" data-action="pick-camp">' +
          optionList(YARN.state.campaigns, ui().activeCampaignId, "\u2014 pick \u2014") +
          "</select></div>" +
        '<button class="ghost" data-action="new-camp">+ Campaign</button>' +
      "</div>";
  }

  // ---- render: identity ------------------------------------------------
  function selectFrom(list, model, current, labelKey, valueKey) {
    var html = '<select data-model="' + model + '">';
    list.forEach(function (it) {
      var v = it[valueKey], lbl = it[labelKey];
      html += '<option value="' + esc(v) + '"' + (v === current ? " selected" : "") +
        ">" + esc(lbl) + "</option>";
    });
    return html + "</select>";
  }
  function selectStrings(arr, model, current) {
    var html = '<select data-model="' + model + '">';
    arr.forEach(function (s) {
      html += '<option value="' + esc(s) + '"' + (s === current ? " selected" : "") +
        ">" + esc(s) + "</option>";
    });
    return html + "</select>";
  }

  function subspeciesSelect(char) {
    var sp = YARN.speciesInfo(char.species);
    var subs = (sp && Array.isArray(sp.subraces)) ? sp.subraces : [];
    if (!subs.length) {
      return '<select disabled><option>none for this species</option></select>';
    }
    var html = '<select data-model="char.subspecies" data-restructure="1"><option value="">pick one</option>';
    subs.forEach(function (r) {
      html += '<option value="' + esc(r.key) + '"' + (r.key === char.subspecies ? " selected" : "") +
        ">" + esc(r.name) + "</option>";
    });
    return html + "</select>";
  }

  function backgroundAsiControls(char) {
    var choices = YARN.backgroundAbilityChoices(char.background);
    if (!choices.length) { return ""; }
    var spent = YARN.backgroundAsiSpent(char.backgroundAsi);
    var remaining = 3 - spent;
    var fields = choices.map(function (k) {
      var info = YARN.ABILITIES.filter(function (a) { return a.key === k; })[0];
      var v = Number(char.backgroundAsi[k]) || 0;
      return '<div class="field" style="display:inline-block;margin-right:.6rem;width:auto">' +
        '<label>' + esc(info ? info.name : k) + "</label>" +
        '<input type="number" min="0" max="2" data-type="number" data-restructure="1" ' +
        'data-model="char.backgroundAsi.' + k + '" value="' + v + '" style="width:4rem">' +
        "</div>";
    }).join("");
    return '<div class="field" style="margin-top:.4rem">' +
      '<label>Background Ability Bonus <span class="muted" style="font-weight:normal">' +
      "(2024 rules: split +2/+1 or spread +1/+1/+1 across these three - must total 3, currently " +
      esc(String(spent)) + "/3)</span></label><div>" + fields + "</div></div>";
  }

  // ---- render: classes / multiclassing ----------------------------------
  // "Multiclassed" means prog.classLevels has at least one entry. Empty is
  // the default and the common case: single-classed, driven entirely by the
  // existing char.klass + prog.level fields, unchanged. See
  // YARN.classBreakdown() in app.core.js for how the fallback works.
  function isMulticlassed(prog) {
    return !!(prog.classLevels && Object.keys(prog.classLevels).length);
  }

  function classesPanel(char, prog) {
    if (!isMulticlassed(prog)) {
      return '<p class="muted" style="font-size:.7rem;margin:.3rem 0 0">Single-classed as ' +
        esc(YARN.classInfo(char.klass) ? YARN.classInfo(char.klass).name : char.klass) +
        '. <button type="button" class="ghost" data-action="add-class" style="margin-left:.4rem">+ Multiclass</button></p>';
    }
    var rows = YARN.classBreakdown(char, prog).map(function (entry) {
      var name = entry.cls ? entry.cls.name : entry.key;
      return '<li><span class="grow">' + esc(name) +
        (entry.key === char.klass ? ' <span class="badge">starting</span>' : "") + "</span>" +
        '<input type="number" min="1" max="20" data-type="number" data-restructure="1" style="width:3.5rem" ' +
          'data-model="prog.classLevels.' + entry.key + '" value="' + entry.levels + '">' +
        '<button type="button" class="danger" data-action="del-class:' + entry.key +
          '" title="Remove this class">\u00d7</button></li>';
    }).join("");
    return '<div class="field" style="margin-top:.4rem">' +
      '<label>Classes <span class="muted" style="font-weight:normal">(total level ' +
        YARN.totalLevel(char, prog) + ")</span></label>" +
      '<ul class="linelist">' + rows + "</ul>" +
      '<button type="button" class="ghost" data-action="add-class">+ Add another class</button> ' +
      '<button type="button" class="ghost" data-action="revert-multiclass">Revert to single class</button>' +
      '<p class="muted" style="font-size:.65rem;margin:.3rem 0 0">Saving throw proficiencies only ever come ' +
        "from your starting class, per the multiclassing rules.</p>" +
    "</div>";
  }

  function identityPanel(char, prog) {
    return '' +
      '<div class="panel span-2">' +
        '<div class="row">' +
          '<div class="field"><label>Character Name</label>' +
            '<input data-model="char.name" value="' + esc(char.name) + '"></div>' +
          '<div class="field"><label>Class</label>' +
            selectFrom(YARN.CLASSES, "char.klass", char.klass, "name", "key") + "</div>" +
          '<div class="field"><label>Subclass</label>' +
            '<input data-model="char.subclass" value="' + esc(char.subclass) + '"></div>' +
          '<div class="field"><label>Species</label>' +
            selectFrom(YARN.SPECIES, "char.species", char.species, "name", "key").replace("<select ", '<select data-restructure="1" ') + "</div>" +
          '<div class="field"><label>Subspecies</label>' + subspeciesSelect(char) + "</div>" +
        "</div>" +
        '<div class="row">' +
          '<div class="field"><label>Background</label>' +
            selectStrings(YARN.BACKGROUNDS, "char.background", char.background).replace("<select ", '<select data-restructure="1" ') + "</div>" +
          '<div class="field"><label>Alignment</label>' +
            selectStrings(YARN.ALIGNMENTS, "char.alignment", char.alignment) + "</div>" +
          '<div class="field"><label>Level' +
            (isMulticlassed(prog) ? ' <span class="muted" style="font-weight:normal">(from classes)</span>' : '') + '</label>' +
            (isMulticlassed(prog)
              ? '<input type="number" value="' + YARN.totalLevel(char, prog) + '" disabled title="Computed from the Classes list below">'
              : '<input type="number" min="1" max="20" data-type="number" data-model="prog.level" value="' + (prog.level || 1) + '">') +
          "</div>" +
          '<div class="field"><label>XP</label>' +
            '<input type="number" min="0" data-type="number" data-model="prog.xp" value="' + (prog.xp || 0) + '"></div>' +
        "</div>" +
        classesPanel(char, prog) +
        backgroundAsiControls(char) +
        '<div class="toggle-row">' +
          '<input type="checkbox" id="hbToggle" data-model="char.homebrew.enabled" data-restructure="1"' +
            (char.homebrew.enabled ? " checked" : "") + ">" +
          '<label for="hbToggle">Homebrew mode <span class="muted">' +
            "(custom skills, extra currencies, resource meters)</span></label>" +
        "</div>" +
      "</div>";
  }

  // ---- render: abilities column ---------------------------------------
  function abilitiesPanel(char) {
    var tiles = YARN.ABILITIES.map(function (a) {
      return '' +
        '<div class="ability">' +
          '<div class="name">' + esc(a.name) + "</div>" +
          '<input class="score" type="number" data-type="number" data-model="char.abilities.' +
            a.key + '" value="' + (char.abilities[a.key] || 10) +
            '" aria-label="' + esc(a.name) + ' base score">' +
          '<div class="mod"><span data-out="score.' + a.key + '">10</span> &middot; ' +
            '<span data-out="mod.' + a.key + '">+0</span></div>' +
        "</div>";
    }).join("");
    return '' +
      '<div class="panel">' +
        "<h2>Ability Scores</h2>" +
        '<p class="muted" style="font-size:.7rem;margin:.2rem 0 .6rem">' +
          "Enter the base score. Your Background's ability bonus (2024 rules) and any campaign ASI are added automatically.</p>" +
        '<div class="abilities">' + tiles + "</div>" +
      "</div>";
  }

  // ---- render: combat tiles -------------------------------------------
  function combatPanel(char, prog) {
    var armorOpts = Object.keys(YARN.ARMOR).map(function (k) {
      return '<option value="' + k + '"' + (prog.armorWorn === k ? " selected" : "") +
        ">" + k + "</option>";
    }).join("");
    return '' +
      '<div class="panel">' +
        "<h2>Combat</h2>" +
        '<div class="stat-tiles">' +
          '<div class="tile"><div class="big" data-out="ac">10</div><div class="lbl">Armor Class</div></div>' +
          '<div class="tile"><div class="big" data-out="init">+0</div><div class="lbl">Initiative</div></div>' +
          '<div class="tile"><div class="big" data-out="speed">30</div><div class="lbl">Speed</div></div>' +
          '<div class="tile"><div class="big" data-out="profBonus">+2</div><div class="lbl">Prof. Bonus</div></div>' +
          '<div class="tile"><div class="big" data-out="pp">10</div><div class="lbl">Passive Perc.</div></div>' +
          '<div class="tile"><div class="big" data-out="spellDC">\u2014</div><div class="lbl">Spell Save DC</div></div>' +
        "</div>" +
        '<div class="row" style="margin-top:.7rem">' +
          '<div class="field"><label>Armor Worn</label><select data-model="prog.armorWorn">' + armorOpts + "</select></div>" +
          '<div class="field"><label>Shield</label><div class="toggle-row">' +
            '<input type="checkbox" data-model="prog.shield"' + (prog.shield ? " checked" : "") +
            '><span class="muted">+2 AC</span></div></div>' +
        "</div>" +
        '<div class="row">' +
          '<div class="field"><label>Max HP</label><input type="number" data-type="number" data-model="prog.hpMax" value="' + (prog.hpMax || 0) + '"></div>' +
          '<div class="field"><label>Current HP</label><input type="number" data-type="number" data-model="prog.hpCurrent" value="' + (prog.hpCurrent || 0) + '"></div>' +
          '<div class="field"><label>Temp HP</label><input type="number" data-type="number" data-model="prog.hpTemp" value="' + (prog.hpTemp || 0) + '"></div>' +
        "</div>" +
        '<p class="muted" style="font-size:.7rem">Suggested Max HP (average): ' +
          '<b data-out="hpSuggest">0</b></p>' +
      "</div>";
  }

  // ---- render: saves + skills -----------------------------------------
  function savesPanel(char) {
    var cls = YARN.classInfo(char.klass);
    var items = YARN.ABILITIES.map(function (a) {
      var classGranted = cls && cls.saves.indexOf(a.key) !== -1;
      var checked = classGranted || char.saveProfs.indexOf(a.key) !== -1;
      var box = classGranted
        ? '<input type="checkbox" checked disabled title="Granted by class">'
        : '<input type="checkbox" data-prof="save:' + a.key + '"' + (checked ? " checked" : "") + ">";
      return "<li>" + box +
        '<span class="grow">' + esc(a.name) +
        (classGranted ? ' <span class="badge">class</span>' : "") + "</span>" +
        '<span class="num pos" data-out="save.' + a.key + '">+0</span></li>';
    }).join("");
    return '<div class="panel"><h2>Saving Throws</h2><ul class="linelist">' + items + "</ul></div>";
  }

  function skillsPanel(char) {
    var fromBg = YARN.backgroundSkills(char);
    var items = YARN.skillsFor(char).map(function (s) {
      var isBg = fromBg.indexOf(s.key) !== -1;
      var isProf = isBg || char.skillProfs.indexOf(s.key) !== -1;
      var isExp = char.skillExpertise.indexOf(s.key) !== -1;
      var custom = YARN.skillInfo(s.key) ? "" : ' <span class="badge hb-badge">hb</span>';
      var profBox = isBg
        ? '<input type="checkbox" checked disabled title="Granted by background">'
        : '<input type="checkbox" data-prof="skill:' + s.key + '"' + (isProf ? " checked" : "") + ' title="Proficient">';
      return "<li>" +
        profBox +
        '<input type="checkbox" data-prof="exp:' + s.key + '"' + (isExp ? " checked" : "") + ' title="Expertise">' +
        '<span class="grow">' + esc(s.name) +
          ' <span class="muted" style="font-size:.65rem">(' + esc(s.ability) + ")</span>" +
          (isBg ? ' <span class="badge">background</span>' : "") + custom + "</span>" +
        '<span class="num pos" data-out="skill.' + s.key + '">+0</span></li>';
    }).join("");
    var hb = char.homebrew.enabled
      ? '<button class="ghost hb-only" data-action="add-skill" style="margin-top:.5rem">+ Custom skill</button>'
      : "";
    return '<div class="panel"><h2>Skills</h2>' +
      '<p class="muted" style="font-size:.65rem;margin:.1rem 0 .4rem">Left box = proficient, right box = expertise.</p>' +
      '<ul class="linelist">' + items + "</ul>" + hb + "</div>";
  }

  // ---- render: currency + resources -----------------------------------
  function currencyPanel(char, prog) {
    var coins = [["cp", "CP"], ["sp", "SP"], ["ep", "EP"], ["gp", "GP"], ["pp", "PP"]];
    var std = coins.map(function (c) {
      return '<div class="field"><label>' + c[1] + "</label>" +
        '<input type="number" data-type="number" data-model="prog.currency.' + c[0] +
        '" value="' + (prog.currency[c[0]] || 0) + '"></div>';
    }).join("");
    var extra = "";
    if (char.homebrew.enabled) {
      extra = char.homebrew.currencies.map(function (cur) {
        return '<div class="field"><label>' + esc(cur.name) + ' <span class="hb-badge">hb</span></label>' +
          '<input type="number" data-type="number" data-model="prog.currencyExtra.' + cur.key +
          '" value="' + (prog.currencyExtra[cur.key] || 0) + '">' +
          ' <button class="danger" data-action="del-currency:' + cur.key + '" title="Remove">\u00d7</button></div>';
      }).join("");
      extra += '<button class="ghost hb-only" data-action="add-currency" style="margin-top:.4rem">+ Currency</button>';
    }
    return '<div class="panel"><h2>Currency</h2><div class="row">' + std + extra + "</div></div>";
  }

  // ---- render: species traits (display-only) ---------------------------
  function traitsPanel(char) {
    var p = YARN.speciesProfile(char);
    if (!p.name) { return ""; }
    var title = p.subName ? esc(p.subName) + " <span class=\"muted\">(" + esc(p.name) + ")</span>" : esc(p.name);
    var langs = p.languages.length ? "<p class=\"muted\" style=\"font-size:.7rem;margin:.3rem 0\">Languages: " +
      p.languages.map(esc).join(", ") + "</p>" : "";
    var traits = p.traits.length
      ? "<ul class=\"linelist\">" + p.traits.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"
      : '<p class="muted">No traits recorded.</p>';
    return '<div class="panel"><h2>Species Traits</h2><h3 style="margin-bottom:.2rem">' + title + "</h3>" +
      langs + traits + "</div>";
  }

  // ---- render: background info (display-only) --------------------------
  function backgroundPanel(char) {
    var info = YARN.backgroundInfo(char.background);
    if (!info) { return ""; }
    var skillNames = YARN.backgroundSkills(char).map(function (k) {
      var s = YARN.skillInfo(k);
      return s ? s.name : k;
    });
    var tools = info.tools.length
      ? "<p class=\"muted\" style=\"font-size:.7rem;margin:.3rem 0\">Tools: " + info.tools.map(esc).join(", ") + "</p>"
      : "";
    var langs = info.languages
      ? "<p class=\"muted\" style=\"font-size:.7rem;margin:.3rem 0\">Languages: " + info.languages + " of your choice</p>"
      : "";
    // 2014-style backgrounds carry `feature` (a roleplay perk); the 2024
    // additions carry `originFeat` instead (a granted feat, not simulated -
    // see the doc comment on YARN.BACKGROUND_INFO). Exactly one is present.
    var perk = info.feature
      ? '<p class="muted" style="font-size:.7rem;margin:.3rem 0">Feature: <b>' + esc(info.feature) + "</b> (roleplay/DM adjudicated)</p>"
      : (info.originFeat
          ? '<p class="muted" style="font-size:.7rem;margin:.3rem 0">Origin feat: <b>' + esc(info.originFeat) +
            "</b> (2024 rules - feat mechanics aren't simulated yet, track its effects manually)</p>"
          : "");
    return '<div class="panel"><h2>Background</h2>' +
      '<p class="muted" style="font-size:.7rem;margin:.1rem 0 .3rem">Skills granted: ' +
        skillNames.map(esc).join(", ") + "</p>" +
      tools + langs + perk +
      "</div>";
  }

  function resourcesPanel(char, prog) {
    if (!char.homebrew.enabled) { return ""; }
    var rows = char.homebrew.resources.map(function (r) {
      var st = prog.resourcesUsed[r.key] || { current: 0, max: 0 };
      return '<div class="row" style="align-items:flex-end">' +
        '<div class="field" style="flex:2"><label>' + esc(r.name) + "</label></div>" +
        '<div class="field"><label>Current</label><input type="number" data-type="number" data-model="prog.resourcesUsed.' + r.key + '.current" value="' + (st.current || 0) + '"></div>' +
        '<div class="field"><label>Max</label><input type="number" data-type="number" data-model="prog.resourcesUsed.' + r.key + '.max" value="' + (st.max || 0) + '"></div>' +
        '<div class="field" style="flex:0"><button class="danger" data-action="del-resource:' + r.key + '">\u00d7</button></div>' +
      "</div>";
    }).join("");
    return '<div class="panel hb-only"><h2>Resources <span class="hb-badge">homebrew</span></h2>' +
      (rows || '<p class="muted">No resource meters yet.</p>') +
      '<button class="ghost" data-action="add-resource" style="margin-top:.5rem">+ Resource meter</button></div>';
  }

  // ---- render: root ----------------------------------------------------
  function render() {
    var char = activeChar(), camp = activeCamp(), prog = activeProg();
    var body;

    if (!char) {
      body = '<div class="empty"><h1>No character selected</h1>' +
        "<p>Create a character to begin, then pick a campaign to track their progress.</p>" +
        '<button class="primary" data-action="new-char">+ New Character</button></div>';
    } else if (!camp) {
      body = '<div class="empty"><h1>' + esc(char.name || "Unnamed") + " needs a campaign</h1>" +
        "<p>A character's level, HP and loot live per-campaign \u2014 that's the whole point of Yarn. " +
        "Pick or create a campaign above.</p>" +
        '<button class="primary" data-action="new-camp">+ New Campaign</button></div>';
    } else if (!prog) {
      body = '<div class="empty"><h1>Play ' + esc(char.name || "this character") +
        " in " + esc(camp.name) + "?</h1>" +
        "<p>They're not in this campaign yet.</p>" +
        '<button class="primary" data-action="add-to-campaign">Add to campaign</button></div>';
    } else {
      body = '<div class="grid sheet-grid">' +
        identityPanel(char, prog) +
        '<div>' + abilitiesPanel(char) + traitsPanel(char) + "</div>" +
        '<div>' + combatPanel(char, prog) + savesPanel(char) + currencyPanel(char, prog) + "</div>" +
        '<div>' + skillsPanel(char) + backgroundPanel(char) + resourcesPanel(char, prog) + "</div>" +
        "</div>";
    }

    root.className = char && char.homebrew && char.homebrew.enabled ? "hb-on" : "";
    root.innerHTML = topbar() + '<div class="wrap">' + body + "</div>";
    refreshDerived();
  }
  UI.render = render;

  // ---- refreshDerived --------------------------------------------------
  function outValue(d, key, char) {
    var parts = key.split(".");
    switch (parts[0]) {
      case "score": return d.scores[parts[1]];
      case "mod":   return signed(d.mods[parts[1]]);
      case "save":  return signed(d.saves[parts[1]]);
      case "skill": return signed(d.skills[parts[1]]);
      case "ac":    return d.ac;
      case "init":  return signed(d.initiative);
      case "pp":    return d.passivePerception;
      case "profBonus": return signed(d.profBonus);
      case "spellDC":   return d.spellSaveDC == null ? "\u2014" : d.spellSaveDC;
      case "hpSuggest": return d.suggestedHpMax;
      case "speed": return YARN.speciesSpeed(char);
      default: return "";
    }
  }
  function refreshDerived() {
    var char = activeChar(), prog = activeProg();
    if (!char || !prog) { return; }
    var d = YARN.derived(char, prog);
    root.querySelectorAll("[data-out]").forEach(function (el) {
      el.textContent = outValue(d, el.getAttribute("data-out"), char);
    });
  }

  // ---- events ----------------------------------------------------------
  function onEdit(e) {
    var t = e.target;
    // Selects that drive navigation carry data-action, not data-model, and
    // must be handled on 'change' (click fires before the value updates).
    if (t.tagName === "SELECT" && t.getAttribute("data-action")) {
      if (e.type !== "change") { return; }
      var a = t.getAttribute("data-action");
      handleAction(t, a.split(":")[0], a.indexOf(":") !== -1 ? a.split(":")[1] : null);
      return;
    }
    var prof = t.getAttribute("data-prof");
    if (prof) {
      var pk = prof.split(":");
      toggleProf(pk[0], pk[1], t.checked);
      YARN.save();
      refreshDerived();
      return;
    }
    var model = t.getAttribute("data-model");
    if (!model) { return; }
    var val = t.type === "checkbox" ? t.checked
      : (t.getAttribute("data-type") === "number" ? (t.value === "" ? 0 : Number(t.value)) : t.value);
    applyModel(model, val);
    if (model === "char.species") { applyModel("char.subspecies", ""); } // new species -> blank subrace
    if (model === "char.background") {
      // Different background = different 3-ability candidate set - a prior
      // allocation may not even apply anymore, so start clean (mirrors the
      // wizard's same reset-on-background-change behavior).
      YARN.ABILITY_KEYS.forEach(function (k) { applyModel("char.backgroundAsi." + k, 0); });
    }
    YARN.save();
    if (t.getAttribute("data-restructure")) { render(); }
    else { refreshDerived(); }
  }

  function onClick(e) {
    var el = e.target.closest("[data-action]");
    if (!el || el.tagName === "SELECT") { return; } // selects handled on change
    var action = el.getAttribute("data-action");
    var arg = action.indexOf(":") !== -1 ? action.split(":")[1] : null;
    action = action.split(":")[0];
    handleAction(el, action, arg);
  }

  function handleAction(el, action, arg) {
    var char = activeChar();
    if (action === "pick-char") { ui().activeCharId = el.value || null; render(); return; }
    if (action === "pick-camp") { ui().activeCampaignId = el.value || null; render(); return; }

    if (action === "new-char") {
      YARN.Wizard.open({
        onCreate: function (nc) {
          YARN.state.characters.push(nc);
          ui().activeCharId = nc.id;
          YARN.save(); render();
        }
      });
      return;
    }
    if (action === "clone-homebrew") {
      if (!char) { return; }
      var copy = YARN.cloneAsHomebrew(char.id);
      if (copy) {
        ui().activeCharId = copy.id;
        YARN.save(); render();
      }
      return;
    }
    if (action === "new-camp") {
      var ncamp = YARN.blankCampaign();
      ncamp.name = window.prompt("Campaign name?") || "New Campaign";
      YARN.state.campaigns.push(ncamp);
      ui().activeCampaignId = ncamp.id;
      YARN.save(); render(); return;
    }
    if (action === "add-to-campaign") {
      YARN.getProgress(activeCamp().id, char.id); // creates the bucket
      YARN.save(); render(); return;
    }
    if (!char) { return; }

    if (action === "add-class") {
      var mcProg = activeProg();
      if (!mcProg) { return; }
      if (!mcProg.classLevels || typeof mcProg.classLevels !== "object") { mcProg.classLevels = {}; }
      if (!Object.keys(mcProg.classLevels).length) {
        // First time multiclassing this character in this campaign: lock
        // in the starting class's current total level as its own explicit
        // entry so nothing silently resets to 1.
        mcProg.classLevels[char.klass] = Math.max(1, mcProg.level || 1);
      }
      var choices = YARN.CLASSES.filter(function (c) { return mcProg.classLevels[c.key] === undefined; });
      if (!choices.length) { window.alert("Every class is already on this character!"); return; }
      var hint = choices.map(function (c) { return c.key; }).join(", ");
      var pick = (window.prompt("Add which class? (" + hint + ")") || "").toLowerCase().trim();
      var newCls = YARN.classInfo(pick);
      if (!newCls || mcProg.classLevels[pick] !== undefined) {
        window.alert("That's not one of the available class keys: " + hint);
        return;
      }
      var lvlStr = window.prompt("How many levels in " + newCls.name + "?", "1");
      mcProg.classLevels[pick] = Math.max(1, Math.min(19, Number(lvlStr) || 1));
      YARN.save(); render(); return;
    }
    if (action === "del-class" && arg) {
      var dcProg = activeProg();
      if (!dcProg || !dcProg.classLevels) { return; }
      var remaining = Object.keys(dcProg.classLevels).filter(function (k) { return k !== arg; });
      if (!remaining.length) {
        window.alert("Can't remove your last class - use \"Revert to single class\" instead.");
        return;
      }
      delete dcProg.classLevels[arg];
      YARN.save(); render(); return;
    }
    if (action === "revert-multiclass") {
      var rmProg = activeProg();
      if (!rmProg) { return; }
      rmProg.level = YARN.totalLevel(char, rmProg); // preserve the total, drop the breakdown
      rmProg.classLevels = {};
      YARN.save(); render(); return;
    }

    if (action === "add-skill") {
      var sname = window.prompt("Custom skill name?");
      if (!sname) { return; }
      var ab = (window.prompt("Governing ability (str/dex/con/int/wis/cha)?", "dex") || "dex").toLowerCase();
      if (YARN.ABILITY_KEYS.indexOf(ab) === -1) { ab = "dex"; }
      char.homebrew.customSkills.push({ key: slug(sname), name: sname, ability: ab });
      YARN.save(); render(); return;
    }
    if (action === "add-currency") {
      var cname = window.prompt("Currency name? (e.g. MP)");
      if (!cname) { return; }
      char.homebrew.currencies.push({ key: slug(cname), name: cname });
      YARN.save(); render(); return;
    }
    if (action === "add-resource") {
      var rname = window.prompt("Resource meter name? (e.g. Bardic Inspiration)");
      if (!rname) { return; }
      char.homebrew.resources.push({ key: slug(rname), name: rname });
      YARN.save(); render(); return;
    }
    if (action === "del-currency" && arg) {
      char.homebrew.currencies = char.homebrew.currencies.filter(function (c) { return c.key !== arg; });
      YARN.save(); render(); return;
    }
    if (action === "del-resource" && arg) {
      char.homebrew.resources = char.homebrew.resources.filter(function (r) { return r.key !== arg; });
      YARN.save(); render(); return;
    }
  }

  // ---- boot ------------------------------------------------------------
  UI.init = function () {
    root = document.getElementById("app");
    YARN.load();
    document.addEventListener("input", onEdit);
    document.addEventListener("change", onEdit);
    document.addEventListener("click", onClick);
    render();
    if (typeof YARN.initSync === "function") { YARN.initSync(); }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", UI.init);
  } else {
    UI.init();
  }
})(window.YARN = window.YARN || {});
