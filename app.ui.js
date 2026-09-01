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
        '<span class="brand">\uD83E\uDDF6 Yarn</span>' +
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
            selectFrom(YARN.SPECIES, "char.species", char.species, "name", "key") + "</div>" +
        "</div>" +
        '<div class="row">' +
          '<div class="field"><label>Background</label>' +
            selectStrings(YARN.BACKGROUNDS, "char.background", char.background) + "</div>" +
          '<div class="field"><label>Alignment</label>' +
            selectStrings(YARN.ALIGNMENTS, "char.alignment", char.alignment) + "</div>" +
          '<div class="field"><label>Level</label>' +
            '<input type="number" min="1" max="20" data-type="number" data-model="prog.level" value="' + (prog.level || 1) + '"></div>' +
          '<div class="field"><label>XP</label>' +
            '<input type="number" min="0" data-type="number" data-model="prog.xp" value="' + (prog.xp || 0) + '"></div>' +
        "</div>" +
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
          "Enter the base score. Species &amp; ASI bonuses are added automatically.</p>" +
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
    var items = YARN.skillsFor(char).map(function (s) {
      var isProf = char.skillProfs.indexOf(s.key) !== -1;
      var isExp = char.skillExpertise.indexOf(s.key) !== -1;
      var custom = YARN.skillInfo(s.key) ? "" : ' <span class="badge hb-badge">hb</span>';
      return "<li>" +
        '<input type="checkbox" data-prof="skill:' + s.key + '"' + (isProf ? " checked" : "") + ' title="Proficient">' +
        '<input type="checkbox" data-prof="exp:' + s.key + '"' + (isExp ? " checked" : "") + ' title="Expertise">' +
        '<span class="grow">' + esc(s.name) +
          ' <span class="muted" style="font-size:.65rem">(' + esc(s.ability) + ")</span>" + custom + "</span>" +
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
        '<div>' + abilitiesPanel(char) + "</div>" +
        '<div>' + combatPanel(char, prog) + savesPanel(char) + currencyPanel(char, prog) + "</div>" +
        '<div>' + skillsPanel(char) + resourcesPanel(char, prog) + "</div>" +
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
      case "speed":
        var sp = YARN.speciesInfo(char.species);
        return sp ? sp.speed : 30;
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
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", UI.init);
  } else {
    UI.init();
  }
})(window.YARN = window.YARN || {});
