/* app.wizard.js - the guided character-creation wizard (modal overlay).
 *
 * A small step machine that walks the D&D 2024 creation order (class ->
 * origin -> abilities -> details) but feeds Yarn's existing 2014 SRD math:
 * the numbers you assign are BASE scores, and species ASI is added on top
 * by YARN.abilityScore(). Nothing derived is stored here either.
 *
 * The wizard NEVER touches YARN.state directly. It builds a character with
 * YARN.blankCharacter() and hands it to opts.onCreate(char); the caller
 * decides when to commit it. That keeps creation testable and undoable.
 */
(function (YARN) {
  "use strict";

  var W = YARN.Wizard = {};
  var STEPS = ["mode", "class", "species", "background", "abilities", "details", "review"];
  var STEP_TITLES = {
    mode: "Standard or Homebrew?",
    class: "Choose a Class",
    species: "Choose a Species",
    background: "Choose a Background",
    abilities: "Determine Ability Scores",
    details: "Name & Details",
    review: "Review & Create"
  };

  var S = null;     // current wizard state
  var overlay = null;
  var onCreate = null;
  var rollTimer = null;   // interval id for the dice-roll animation, if one is running

  // ---- helpers ---------------------------------------------------------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function signed(n) { n = Number(n) || 0; return (n >= 0 ? "+" : "") + n; }
  function abilityName(key) {
    for (var i = 0; i < YARN.ABILITIES.length; i++) {
      if (YARN.ABILITIES[i].key === key) { return YARN.ABILITIES[i].name; }
    }
    return key;
  }

  function freshState() {
    var assign = {}, direct = {};
    YARN.ABILITY_KEYS.forEach(function (k) { assign[k] = null; direct[k] = 8; });
    return {
      step: 0,
      mode: "standard",
      klass: "fighter",
      species: "human",
      subspecies: "",
      background: "Folk Hero",
      method: "standard",
      pool: YARN.STANDARD_ARRAY.slice(),
      poolMeta: [],       // parallel dice breakdowns for the roll method
      rolling: false,     // true while the roll animation is mid-flight
      assign: assign,     // ability -> pool index (standard / roll)
      direct: direct,     // ability -> score (pointbuy / manual)
      name: "",
      alignment: "True Neutral",
      personality: "",
      backstory: "",
      subModalOpen: false   // is the subrace-picker popup currently showing?
    };
  }

  // Final BASE scores from whichever method is active. Species ASI is NOT
  // included here - that is added later by YARN.abilityScore().
  function baseScores() {
    var out = {};
    if (S.method === "standard" || S.method === "roll") {
      YARN.ABILITY_KEYS.forEach(function (k) {
        var idx = S.assign[k];
        out[k] = (idx === null || idx === undefined) ? 8 : Number(S.pool[idx]);
      });
    } else {
      YARN.ABILITY_KEYS.forEach(function (k) { out[k] = Number(S.direct[k]) || 8; });
    }
    return out;
  }

  // Every pool slot must be assigned to exactly one ability.
  function poolFullyAssigned() {
    var used = {};
    for (var i = 0; i < YARN.ABILITY_KEYS.length; i++) {
      var idx = S.assign[YARN.ABILITY_KEYS[i]];
      if (idx === null || idx === undefined) { return false; }
      if (used[idx]) { return false; } // same slot picked twice
      used[idx] = true;
    }
    return true;
  }

  // ---- step rendering --------------------------------------------------
  function radioCards(items, current, action, valueKey, labelKey, hintKey) {
    return items.map(function (it) {
      var v = it[valueKey], on = v === current;
      return '<button class="wz-card' + (on ? " sel" : "") +
        '" data-wz="pick:' + action + ":" + esc(v) + '" aria-pressed="' + on + '">' +
        '<span class="wz-card-title">' + esc(it[labelKey]) + "</span>" +
        (hintKey && it[hintKey] ? '<span class="wz-card-hint">' + esc(it[hintKey]) + "</span>" : "") +
        "</button>";
    }).join("");
  }

  function stepMode() {
    var opts = [
      { key: "standard", name: "Standard", hint: "Pure 5e SRD. Pick from the official class, species and skill lists." },
      { key: "homebrew", name: "Homebrew", hint: "Everything in Standard, plus custom skills, extra currencies and resource meters." }
    ];
    return '<p class="wz-lead">How much do you want to bend the rules?</p>' +
      '<div class="wz-cards">' + radioCards(opts, S.mode, "mode", "key", "name", "hint") + "</div>";
  }

  function stepClass() {
    var cls = YARN.CLASSES.map(function (c) {
      var caster = c.caster ? (c.caster + " caster") : "martial";
      return { key: c.key, name: c.name, hint: "d" + c.hitDie + " \u00b7 " + caster };
    });
    var picked = YARN.classInfo(S.klass);
    return '<p class="wz-lead">Your class is the biggest single choice - it sets your hit die, saves and spellcasting.</p>' +
      '<div class="wz-cards wz-cards-grid">' + radioCards(cls, S.klass, "klass", "key", "name", "hint") + "</div>" +
      (picked && picked.blurb ? '<p class="wz-blurb">' + esc(picked.name) + ": " + esc(picked.blurb) + "</p>" : "");
  }

  function asiText(asi) {
    var parts = Object.keys(asi || {}).map(function (k) { return "+" + asi[k] + " " + k.toUpperCase(); });
    return parts.length ? parts.join(", ") : "\u2014";
  }

  function stepSpecies() {
    var sp = YARN.SPECIES.map(function (s) {
      var tag = Array.isArray(s.subraces) && s.subraces.length ? " \u00b7 has subraces" : "";
      return { key: s.key, name: s.name, hint: s.size + " \u00b7 " + s.speed + "ft \u00b7 " + asiText(s.asi) + tag };
    });
    var species = YARN.speciesInfo(S.species);
    var subLine = "";
    if (species && Array.isArray(species.subraces) && species.subraces.length) {
      var sub = YARN.subspeciesInfo(S.species, S.subspecies);
      subLine = '<div class="wz-subrace-bar">' +
        (sub
          ? '<span class="wz-subrace-chosen">Subrace: <b>' + esc(sub.name) + "</b> (" + asiText(sub.asi) + ")</span>"
          : '<span class="wz-subrace-chosen wz-subrace-missing">No subrace chosen yet</span>') +
        '<button class="wz-btn" data-wz="open-subrace">' + (sub ? "Change subrace" : "Choose subrace") + "</button>" +
        "</div>";
    }
    return '<p class="wz-lead">Species sets your size, speed and (in the 2014 rules Yarn uses) your ability bonuses.</p>' +
      '<div class="wz-cards wz-cards-grid">' + radioCards(sp, S.species, "species", "key", "name", "hint") + "</div>" +
      (species && species.blurb ? '<p class="wz-blurb">' + esc(species.name) + ": " + esc(species.blurb) + "</p>" : "") +
      subLine;
  }

  // Standalone popup for picking a subrace - opened automatically the moment
  // a species with subraces is chosen, and reopenable via "Change subrace".
  // Lives on top of the wizard modal rather than inline in the species list
  // so a 41-species grid doesn't grow a second grid underneath it.
  function subModalMarkup() {
    var species = YARN.speciesInfo(S.species);
    if (!species || !Array.isArray(species.subraces) || !species.subraces.length) { return ""; }
    var subs = species.subraces.map(function (r) {
      return { key: r.key, name: r.name, hint: asiText(r.asi) + (r.speed ? " \u00b7 " + r.speed + "ft" : "") };
    });
    return '<div class="wz-suboverlay" data-wz="sub-scrim">' +
      '<div class="wz-submodal" role="dialog" aria-modal="true" aria-labelledby="wzSubTitle" data-wz-stop="1">' +
        '<div class="wz-head"><h3 id="wzSubTitle">Choose a subrace of ' + esc(species.name) + "</h3>" +
          '<button class="wz-x" data-wz="close-subrace" aria-label="Close">\u00d7</button></div>' +
        '<p class="wz-lead">Its bonus stacks on top of the base species.</p>' +
        '<div class="wz-cards wz-cards-grid">' + radioCards(subs, S.subspecies, "subspecies", "key", "name", "hint") + "</div>" +
        '<div class="wz-foot"><div class="wz-spacer"></div>' +
          '<button class="wz-btn primary" data-wz="close-subrace"' + (S.subspecies ? "" : " disabled") + ">Done</button></div>" +
      "</div>" +
    "</div>";
  }

  function stepBackground() {
    var bg = YARN.BACKGROUNDS.map(function (b) {
      var info = YARN.backgroundInfo(b);
      var hint = info ? info.skills.map(function (k) {
        var s = YARN.skillInfo(k);
        return s ? s.name : k;
      }).join(", ") : "";
      return { key: b, name: b, hint: hint };
    });
    var picked = YARN.backgroundInfo(S.background);
    return '<p class="wz-lead">Your background is your life before adventuring - it grants two fixed skill proficiencies. ' +
      '<button class="wz-link" data-wz="random-bg">surprise me</button></p>' +
      '<div class="wz-cards wz-cards-grid">' + radioCards(bg, S.background, "background", "key", "name", "hint") + "</div>" +
      (picked && picked.blurb ? '<p class="wz-blurb">' + esc(S.background) + ": " + esc(picked.blurb) + "</p>" : "");
  }

  function methodTabs() {
    var methods = [
      ["standard", "Standard array"],
      ["pointbuy", "Point buy"],
      ["roll", "Roll dice"],
      ["manual", "Manual"]
    ];
    return '<div class="wz-tabs">' + methods.map(function (m) {
      return '<button class="wz-tab' + (S.method === m[0] ? " sel" : "") +
        '" data-wz="method:' + m[0] + '">' + esc(m[1]) + "</button>";
    }).join("") + "</div>";
  }

  // Selects that assign pool slots to abilities (standard / roll methods).
  // Slots already claimed by ANOTHER ability are shown disabled (with a
  // "(used)" suffix) so you physically cannot create a silent duplicate -
  // that used to be possible and just left "Next" disabled with zero
  // explanation, because poolFullyAssigned() rejects a repeated index.
  function assignTable() {
    var speciesAsi = YARN.speciesASI(S);
    var usedBy = {}; // pool index -> ability key currently holding it
    YARN.ABILITY_KEYS.forEach(function (k) {
      var idx = S.assign[k];
      if (idx !== null && idx !== undefined) { usedBy[idx] = k; }
    });
    var rows = YARN.ABILITY_KEYS.map(function (k) {
      var opts = '<option value="">\u2014</option>';
      S.pool.forEach(function (val, idx) {
        var takenByOther = usedBy[idx] !== undefined && usedBy[idx] !== k;
        opts += '<option value="' + idx + '"' + (S.assign[k] === idx ? " selected" : "") +
          (takenByOther ? " disabled" : "") + ">" + val +
          (takenByOther ? " (used)" : "") + "</option>";
      });
      var idx = S.assign[k];
      var base = (idx === null || idx === undefined) ? null : Number(S.pool[idx]);
      var spB = speciesAsi[k] || 0;
      var finalScore = base === null ? "\u2014" : (base + spB);
      var mod = base === null ? "" : signed(YARN.mod(base + spB));
      return "<tr><th>" + esc(abilityName(k)) + "</th>" +
        '<td><select data-wz="assign:' + k + '">' + opts + "</select></td>" +
        '<td class="wz-num">' + (spB ? "+" + spB : "\u2014") + "</td>" +
        '<td class="wz-num"><b>' + finalScore + "</b></td>" +
        '<td class="wz-num wz-mod">' + mod + "</td></tr>";
    }).join("");
    return '<table class="wz-abilities"><thead><tr>' +
      "<th>Ability</th><th>Assigned</th><th>Species</th><th>Total</th><th>Mod</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>";
  }

  // Steppers for point-buy / free inputs for manual.
  function directTable() {
    var speciesAsi = YARN.speciesASI(S);
    var isBuy = S.method === "pointbuy";
    var rows = YARN.ABILITY_KEYS.map(function (k) {
      var base = Number(S.direct[k]) || 8;
      var spB = speciesAsi[k] || 0;
      var control;
      if (isBuy) {
        // 5e SRD point buy: 8-15 range, budget-gated. Both boundaries are
        // shown disabled (not just silently inert) so a click that does
        // nothing never happens - if it looks clickable, it must work.
        var trialUp = Object.assign({}, S.direct); trialUp[k] = base + 1;
        var atMax = base >= YARN.POINT_BUY_MAX;
        var atMin = base <= YARN.POINT_BUY_MIN;
        var cantAfford = !atMax && YARN.pointBuyRemaining(trialUp) < 0;
        control = '<button class="wz-step" data-wz="buy:' + k + ':-1" aria-label="decrease"' +
            (atMin ? " disabled" : "") + ">\u2212</button>" +
          '<span class="wz-buyval">' + base + "</span>" +
          '<button class="wz-step" data-wz="buy:' + k + ':1" aria-label="increase"' +
            ((atMax || cantAfford) ? " disabled" : "") + ">+</button>";
      } else {
        control = '<input type="number" min="3" max="20" data-wz="manual:' + k + '" value="' + base + '">';
      }
      return "<tr><th>" + esc(abilityName(k)) + "</th>" +
        '<td class="wz-control">' + control + "</td>" +
        '<td class="wz-num">' + (spB ? "+" + spB : "\u2014") + "</td>" +
        '<td class="wz-num"><b>' + (base + spB) + "</b></td>" +
        '<td class="wz-num wz-mod">' + signed(YARN.mod(base + spB)) + "</td></tr>";
    }).join("");
    return '<table class="wz-abilities"><thead><tr>' +
      "<th>Ability</th><th>Score</th><th>Species</th><th>Total</th><th>Mod</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>";
  }

  function stepAbilities() {
    var body = methodTabs();
    var help = "", tools = "";

    if (S.method === "standard") {
      help = "Assign the standard array (15, 14, 13, 12, 10, 8) to your six abilities.";
      tools = '<button class="wz-btn" data-wz="suggest">Auto-assign for ' +
        esc(YARN.classInfo(S.klass).name) + "</button>";
      body += "<p class='wz-help'>" + help + " " + tools + "</p>" + assignTable();
    } else if (S.method === "roll") {
      help = "Roll 4d6 and drop the lowest, six times. Grab real dice if you've got them - " +
        "then type your totals into the pool below - or let Yarn roll for you.";
      var poolChips = S.pool.map(function (v, i) {
        var meta = S.poolMeta[i];
        var title = meta ? "rolled " + meta.rolls.join(",") + " drop " + meta.dropped : "";
        return '<span class="wz-chip' + (S.rolling ? " tumbling" : "") + '" title="' + esc(title) + '">' + v +
          (meta ? '<span class="wz-chip-sub">' + meta.rolls.join("\u00b7") + "</span>" : "") + "</span>";
      }).join("");
      tools = '<button class="wz-btn primary" data-wz="roll-all"' + (S.rolling ? " disabled" : "") + ">" +
        (S.rolling ? "\uD83C\uDFB2 Rolling\u2026" : "\uD83C\uDFB2 Roll 4d6 (drop lowest) \u00d76") + "</button>";
      body += "<p class='wz-help'>" + help + "</p>" +
        '<div class="wz-roll-bar">' + tools + '<div class="wz-pool">' + poolChips + "</div></div>" +
        '<p class="wz-help muted">Or type your own six totals:</p>' +
        '<div class="wz-pool-inputs">' + S.pool.map(function (v, i) {
          return '<input type="number" min="3" max="18" data-wz="pool:' + i + '"' +
            (S.rolling ? " disabled" : "") + ' value="' + v + '">';
        }).join("") + "</div>" +
        assignTable();
    } else if (S.method === "pointbuy") {
      var remaining = YARN.pointBuyRemaining(S.direct);
      var over = remaining < 0;
      help = "Spend 27 points. Each score starts at 8; 14 and 15 cost extra. " +
        "15 is the max score point buy can reach (SRD rule) - species bonuses " +
        "apply on top, in the Species column.";
      body += "<p class='wz-help'>" + help + "</p>" +
        '<p class="wz-points' + (over ? " over" : "") + '">Points remaining: <b>' + remaining + "</b>" +
        (over ? " (over budget!)" : "") + "</p>" + directTable();
    } else {
      help = "Type whatever your table agreed on. No guard rails here.";
      body += "<p class='wz-help'>" + help + "</p>" + directTable();
    }
    return body;
  }

  function stepDetails() {
    var alignOpts = YARN.ALIGNMENTS.map(function (a) {
      return '<option value="' + esc(a) + '"' + (a === S.alignment ? " selected" : "") + ">" + esc(a) + "</option>";
    }).join("");
    return '<div class="wz-field"><label for="wzName">Character name</label>' +
        '<div class="wz-inline"><input id="wzName" data-wz="name" value="' + esc(S.name) +
        '" placeholder="Name your hero"><button class="wz-btn" data-wz="random-name">\uD83C\uDFB2 Random</button></div></div>' +
      '<div class="wz-field"><label for="wzAlign">Alignment</label>' +
        '<select id="wzAlign" data-wz="alignment">' + alignOpts + "</select></div>" +
      '<div class="wz-field"><label for="wzPers">Personality (optional)</label>' +
        '<textarea id="wzPers" data-wz="personality" rows="2">' + esc(S.personality) + "</textarea></div>" +
      '<div class="wz-field"><label for="wzBack">Backstory (optional)</label>' +
        '<textarea id="wzBack" data-wz="backstory" rows="3">' + esc(S.backstory) + "</textarea></div>";
  }

  function stepReview() {
    var char = buildCharacter();
    var d = YARN.derived(char, YARN.blankProgress());
    var abilityRows = YARN.ABILITY_KEYS.map(function (k) {
      return "<tr><th>" + esc(abilityName(k)) + "</th>" +
        '<td class="wz-num"><b>' + d.scores[k] + "</b></td>" +
        '<td class="wz-num wz-mod">' + signed(d.mods[k]) + "</td></tr>";
    }).join("");
    var cls = YARN.classInfo(S.klass), sp = YARN.speciesInfo(S.species);
    var sub = YARN.subspeciesInfo(S.species, S.subspecies);
    return '<div class="wz-review">' +
      "<h3>" + esc(S.name || YARN.randomName()) + "</h3>" +
      '<p class="wz-summary">' +
        esc(sub ? sub.name : sp.name) + " " + esc(cls.name) + " \u00b7 " + esc(S.background) + " \u00b7 " + esc(S.alignment) +
        (S.mode === "homebrew" ? ' <span class="wz-tag">homebrew</span>' : "") + "</p>" +
      '<table class="wz-abilities wz-review-tbl"><tbody>' + abilityRows + "</tbody></table>" +
      '<p class="wz-help muted">Species bonuses are already baked into these totals. ' +
        "You can fine-tune everything on the sheet afterwards.</p>" +
      "</div>";
  }

  var RENDERERS = {
    mode: stepMode, class: stepClass, species: stepSpecies, background: stepBackground,
    abilities: stepAbilities, details: stepDetails, review: stepReview
  };

  // ---- validation ------------------------------------------------------
  function canAdvance() {
    var name = STEPS[S.step];
    if (name === "species") {
      var sp = YARN.speciesInfo(S.species);
      if (sp && Array.isArray(sp.subraces) && sp.subraces.length) { return !!S.subspecies; }
      return true;
    }
    if (name === "abilities") {
      if (S.method === "standard" || S.method === "roll") { return poolFullyAssigned(); }
      if (S.method === "pointbuy") { return YARN.pointBuyValid(S.direct); }
      return true; // manual: anything goes
    }
    return true;
  }

  // ---- character assembly ---------------------------------------------
  function buildCharacter() {
    var c = YARN.blankCharacter();
    c.name = S.name || YARN.randomName();
    c.klass = S.klass;
    c.species = S.species;
    c.subspecies = S.subspecies;
    c.background = S.background;
    c.alignment = S.alignment;
    c.abilities = baseScores();
    c.personality = S.personality;
    c.backstory = S.backstory;
    c.homebrew.enabled = (S.mode === "homebrew");
    return c;
  }

  // ---- shell -----------------------------------------------------------
  function render() {
    var stepKey = STEPS[S.step];
    var dots = STEPS.map(function (s, i) {
      return '<span class="wz-dot' + (i === S.step ? " on" : (i < S.step ? " done" : "")) + '"></span>';
    }).join("");
    var last = S.step === STEPS.length - 1;
    overlay.querySelector(".wz-modal").innerHTML =
      '<div class="wz-head"><div class="wz-progress">' + dots + "</div>" +
        '<button class="wz-x" data-wz="cancel" aria-label="Cancel">\u00d7</button></div>' +
      '<h2 id="wzTitle">Step ' + (S.step + 1) + " of " + STEPS.length + " \u00b7 " + esc(STEP_TITLES[stepKey]) + "</h2>" +
      '<div class="wz-body">' + RENDERERS[stepKey]() + "</div>" +
      '<div class="wz-foot">' +
        '<button class="wz-btn" data-wz="back"' + (S.step === 0 ? " disabled" : "") + ">Back</button>" +
        '<div class="wz-spacer"></div>' +
        (last
          ? '<button class="wz-btn primary" data-wz="create">Create character</button>'
          : '<button class="wz-btn primary" data-wz="next"' + (canAdvance() ? "" : " disabled") + ">Next</button>") +
      "</div>";
    var subHost = overlay.querySelector(".wz-sub-host");
    subHost.innerHTML = (stepKey === "species" && S.subModalOpen) ? subModalMarkup() : "";
    var focusTarget = subHost.querySelector("button, input, select") ||
      overlay.querySelector(".wz-body input, .wz-body select, .wz-body button");
    if (focusTarget) { focusTarget.focus(); }
  }

  // ---- events ----------------------------------------------------------
  function onOverlayClick(e) {
    var el = e.target.closest("[data-wz]");
    if (!el) { return; }
    // A click anywhere inside the subrace popup body (data-wz-stop) bubbles
    // up looking for its nearest [data-wz] owner, which is the scrim itself
    // when the click lands on plain text/whitespace. Only an actual click
    // on the backdrop (outside data-wz-stop) should close the popup.
    if (el.getAttribute("data-wz") === "sub-scrim" && e.target.closest("[data-wz-stop]")) { return; }
    var parts = el.getAttribute("data-wz").split(":");
    dispatch(parts[0], parts.slice(1), el);
  }
  function onOverlayInput(e) {
    var el = e.target.closest("[data-wz]");
    if (!el || el.tagName === "BUTTON") { return; }
    var parts = el.getAttribute("data-wz").split(":");
    dispatch(parts[0], parts.slice(1), el);
  }
  function onKey(e) {
    if (e.key !== "Escape") { return; }
    if (S && S.subModalOpen) { S.subModalOpen = false; render(); return; }
    close();
  }

  // Rolls 4d6-drop-lowest x6 for real (via YARN.rollAbilitySet), but shows a
  // brief tumbling animation first - a few ticks of random junk numbers in
  // the pool chips - before landing on the real result. Purely cosmetic:
  // the actual dice math never runs more than once, so nothing here can
  // change what score you end up with, only how it's revealed.
  function stopRollAnimation() {
    if (rollTimer) { clearInterval(rollTimer); rollTimer = null; }
    if (S) { S.rolling = false; }
  }
  function startRollAnimation() {
    var ticks = 0;
    var TOTAL_TICKS = 8;
    S.rolling = true;
    YARN.ABILITY_KEYS.forEach(function (a) { S.assign[a] = null; }); // reset assignment up front
    render();
    rollTimer = setInterval(function () {
      ticks++;
      if (ticks >= TOTAL_TICKS) {
        clearInterval(rollTimer);
        rollTimer = null;
        var set = YARN.rollAbilitySet();
        S.pool = set.map(function (r) { return r.total; });
        S.poolMeta = set;
        S.rolling = false;
        render();
        return;
      }
      // Junk values just for the tumble effect - never touches poolMeta,
      // so there is no chance of a fake breakdown leaking into the tooltip.
      S.pool = S.pool.map(function () { return 3 + Math.floor(Math.random() * 16); });
      render();
    }, 80);
  }

  function dispatch(cmd, args, el) {
    switch (cmd) {
      case "cancel": close(); return;
      case "back": if (S.step > 0) { stopRollAnimation(); S.step--; render(); } return;
      case "next": if (canAdvance() && S.step < STEPS.length - 1) { stopRollAnimation(); S.step++; render(); } return;
      case "create": commit(); return;

      case "pick":
        S[args[0]] = args[1];
        if (args[0] === "species") {
          S.subspecies = ""; // new species, blank slate for subrace
          var picked = YARN.speciesInfo(args[1]);
          // Auto-open the subrace popup the moment a species that has one
          // is chosen - matches the rulebook: subraces aren't optional
          // where they exist, so don't make the player go hunting for them.
          S.subModalOpen = !!(picked && Array.isArray(picked.subraces) && picked.subraces.length);
        }
        if (args[0] === "subspecies") {
          S.subModalOpen = false; // picking one is the only thing to do in there - close it
        }
        render(); return;

      case "open-subrace": S.subModalOpen = true; render(); return;
      case "close-subrace": S.subModalOpen = false; render(); return;
      case "sub-scrim": S.subModalOpen = false; render(); return;

      case "method":
        stopRollAnimation();
        S.method = args[0];
        render(); return;

      case "assign": {
        var v = el.value;
        S.assign[args[0]] = v === "" ? null : Number(v);
        render(); return;
      }
      case "buy": {
        var k = args[0], dir = Number(args[1]);
        var next = (Number(S.direct[k]) || 8) + dir;
        if (next < YARN.POINT_BUY_MIN || next > YARN.POINT_BUY_MAX) { return; }
        var trial = Object.assign({}, S.direct); trial[k] = next;
        if (YARN.pointBuyRemaining(trial) < 0) { return; } // can't overspend
        S.direct[k] = next;
        render(); return;
      }
      case "manual":
        S.direct[args[0]] = el.value === "" ? 0 : Number(el.value);
        render(); return;
      case "pool":
        S.pool[Number(args[0])] = el.value === "" ? 0 : Number(el.value);
        S.poolMeta[Number(args[0])] = null; // typed value overrides dice breakdown
        render(); return;

      case "roll-all": {
        if (S.rolling) { return; } // already mid-animation, ignore extra clicks
        startRollAnimation();
        return;
      }
      case "suggest": {
        var arr = YARN.SUGGESTED_ARRAY[S.klass];
        if (arr) {
          // Map suggested scores back onto pool slots (each used once).
          var taken = {};
          YARN.ABILITY_KEYS.forEach(function (a) {
            var want = arr[a];
            for (var i = 0; i < S.pool.length; i++) {
              if (!taken[i] && Number(S.pool[i]) === want) { S.assign[a] = i; taken[i] = true; break; }
            }
          });
        }
        render(); return;
      }
      case "random-name": S.name = YARN.randomName(); render(); return;
      case "random-bg": {
        var list = YARN.BACKGROUNDS;
        S.background = list[Math.floor(Math.random() * list.length)];
        render(); return;
      }
      case "name": S.name = el.value; return;            // no re-render: keep focus
      case "alignment": S.alignment = el.value; return;
      case "personality": S.personality = el.value; return;
      case "backstory": S.backstory = el.value; return;
    }
  }

  function commit() {
    var char = buildCharacter();
    close();
    if (typeof onCreate === "function") { onCreate(char); }
  }

  // ---- open / close ----------------------------------------------------
  function close() {
    if (!overlay) { return; }
    stopRollAnimation();
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    overlay = null;
    S = null;
  }
  W.close = close;

  W.open = function (opts) {
    opts = opts || {};
    onCreate = opts.onCreate || null;
    S = freshState();
    if (opts.mode === "homebrew") { S.mode = "homebrew"; }

    overlay = document.createElement("div");
    overlay.className = "wz-overlay";
    overlay.innerHTML = '<div class="wz-modal" role="dialog" aria-modal="true" aria-labelledby="wzTitle"></div>' +
      '<div class="wz-sub-host"></div>';
    overlay.addEventListener("click", onOverlayClick);
    overlay.addEventListener("input", onOverlayInput);
    overlay.addEventListener("change", onOverlayInput);
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey);
    render();
  };

  // Exposed for tests: drive the state machine headlessly.
  W._debug = {
    state: function () { return S; },
    baseScores: baseScores,
    buildCharacter: buildCharacter,
    canAdvance: canAdvance,
    poolFullyAssigned: poolFullyAssigned
  };
})(window.YARN = window.YARN || {});
