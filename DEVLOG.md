# Yarn - DEVLOG

_Last updated: 2026-09-01 - Current build: **v1.2 "guided creation"**_

A single-page, offline-first **D&D character builder and campaign tracker**.
Sibling project to the Budget Planner: same architecture, same Firebase project,
same build/test discipline.

> **Yarn** = spinning a tale. Not knitting. Numi guessed knitting. Numi was wrong.

---

## The core idea

One character can be played in **multiple campaigns at once**, at different levels,
with different gear and different HP. Yarn keeps the character's *identity* in one
place and their *progress* separate per campaign.

- **Shared core** (the character): name, species, class, background, base ability
  scores, portrait, backstory. Edit once, reflected everywhere.
- **Per-campaign progress**: level, XP, current HP, hit dice, inventory, currency,
  spell slots, conditions, session notes.

So Kaelen the Rogue is level 7 in Curse of Strahd and level 2 in the Tuesday game.
Same rogue. Two timelines. Switch with one dropdown.

---

## Decisions locked in (v1)

These were chosen by Numi as sensible defaults. **Any of them can be overruled.**

| Decision | Choice | Why |
|---|---|---|
| Edition | **5e 2014 SRD** | Freely usable data, widest table adoption. |
| Character/campaign split | **Shared core + per-campaign progress** | The whole point of the app. |
| Rules automation | **Auto-calc derived stats** | Mods, prof bonus, AC, save DC, skill totals. A sheet that cannot add is a Notes app. |
| v1 scope | Sheet + combat tracker + dice roller + campaign switcher | Ship the table-night essentials first. |
| Sharing | **Solo first**, Firestore door left open | Mirrors Budget's household model when we want it. |

Deferred to v2+: spellbook UI, full level-up wizard, party roster, homebrew content,
encounter/initiative tracker for DMs.

---

## Architecture

Straight lift from the Budget Planner, because it works: **vanilla JS, zero
dependencies, no npm, no framework, no bundler.** A Python script concatenates
the modules into one HTML file.

| File | Role |
|------|------|
| `yarn.html` | Markup + `<script>` include order. Loads rules -> core -> wizard -> ui. |
| `app.css` | All styling, hand-rolled, zero deps. Includes the wizard modal. |
| `app.rules.js` | Static 5e SRD data + generation tables (standard array, point-buy, suggested arrays, name parts). |
| `app.core.js` | Data model, `YARN.state`, `normalize()`, save/load, derived-stat math, dice, point-buy, clone. |
| `app.wizard.js` | The guided character-creation wizard (modal step machine). |
| `app.ui.js` | Top bar + character sheet renderer + all interaction wiring. |

Everything hangs off the global `window.YARN` namespace. (Earlier drafts of this
table listed `app.sheet.js` / `app.campaign.js` / `app.dice.js` / `app.main.js` /
`sw.js` / `build.py` - those never materialised; the UI was consolidated into
`app.ui.js` and dice live in `app.core.js`. PWA + build scripts are still TODO.)

### Data model (`YARN.state`)
```js
{
  characters: [{ id, name, species, klass, subclass, background, alignment,
                 abilities: {str,dex,con,int,wis,cha},   // BASE scores, pre-ASI
                 saveProfs: [], skillProfs: [], skillExpertise: [],
                 speed, size, portrait, backstory,
                 personality, ideals, bonds, flaws }],

  campaigns:  [{ id, name, dm, setting, notes, archived }],

  // campaignId -> characterId -> that character's state IN that campaign
  progress: {
    "<campaignId>": {
      "<characterId>": { level, xp, hpMax, hpCurrent, hpTemp,
                         hitDiceUsed, deathSaves: {success, fail},
                         armorWorn, shield, conditions: [],
                         inventory: [], currency: {cp,sp,ep,gp,pp},
                         spellSlotsUsed: {1..9}, notes, sessions: [],
                         asi: {str..cha} }
    }
  },

  ui: { activeCharId, activeCampaignId, tab }
}
```

**Why `progress[campaignId][charId]` and not a field on the character?** It is the
same shape as Budget's `paid["YYYY-MM"][billId]` - a proven pattern for "same
entity, independent buckets." Deleting a campaign drops one key and leaves every
character intact.

### Derived stats (never stored, always computed)
Single source of truth in `app.core.js`:
- `mod(score)` = `floor((score - 10) / 2)`
- `profBonus(level)` = `2 + floor((level - 1) / 4)`
- `abilityScore(char, prog, key)` = base + ASI (so the sheet shows the *campaign's* score)
- `skillTotal`, `saveTotal`, `ac`, `initiative`, `spellSaveDC`, `spellAttack`, `passivePerception`

Storing derived values is how sheets drift out of sync. We compute them every render.

---

## How to work on it

### Edit source, never the built files
Source of truth = `yarn.html` + the `app.*.js` modules + `sw.js`.
**Do not hand-edit `Yarn.html` or `docs/index.html`** - they are generated.

### Build
```
.venv\Scripts\python build.py         # -> Yarn.html (local offline, one file)
.venv\Scripts\python build_pages.py   # -> docs/ (hosted PWA)
```

### Bump the version when shipping
1. `build_pages.py` - the `__BUILD_TAG__` string
2. `sw.js` - the `CACHE` constant, so devices pull fresh
3. This DEVLOG's "Current build" line

---

## Environment notes (Walmart machine)

- **`git` IS installed** (2.55.0). The Budget tool's DEVLOG says otherwise - that is
  stale. Yarn is a real git repo from commit one.
- Python via `uv`. Use the Walmart index URL for installs.
- Emoji get filtered on this machine - avoid them in committed files.
- gstatic / firestore are intermittently blocked -> cloud-sync tests must mock Firebase.

---

## Build log

- **v1** - Project skeleton: git repo, data model, rules data, derived-stat math.
- **v1.1** - Opt-in **homebrew layer** (additive, never destructive):
  - `character.homebrew = { enabled, customSkills[], currencies[], resources[] }`.
    When `enabled` is false, custom skills/currencies/resources are invisible and
    SRD math is byte-for-byte unchanged.
  - Custom skills compute exactly like SRD skills (`abilityMod + profBonus` when
    proficient) and merge into `skillsFor` / `skillInfoFor` / `skillTotal` /
    `derived().skills`.
  - Per-campaign extra state: `progress.currencyExtra` (e.g. `mp`) and
    `progress.resourcesUsed` (e.g. Bardic Inspiration current/max).
  - Unknown species (not in the SRD table) degrade gracefully: base scores, no
    ancestry ASI, no crash.
  - `normalize()` backfills the homebrew block on legacy saves and round-trips
    homebrew state on new ones.
  - Coverage: `test_homebrew.py` (21 assertions, real modules in a real browser).
    Full suite now **57 green** (36 SRD + 21 homebrew).
- **v1.2** - **Guided character-creation wizard** + the app's first working UI.
  - New `app.wizard.js`: a modal step machine walking the D&D 2024 creation
    order (mode -> class -> species -> background -> abilities -> details ->
    review), feeding Yarn's 2014 SRD math. Steps validate before you can
    advance (e.g. every ability must be assigned).
  - **Standard vs Homebrew** chosen up front; Homebrew starts with homebrew
    mode on. New top-bar **"Homebrew copy"** button clones the active
    character into a fresh homebrew variant (`YARN.cloneAsHomebrew`) - the
    original is left untouched (deep copy).
  - Ability scores four ways: **standard array**, **point buy** (27-pt, live
    budget), **roll** (digital 4d6-drop-lowest *and* type-your-own physical
    totals), and **manual**. Plus **auto-assign** by class and a **random
    name** generator. Dice roller lives in `app.core.js` with an injectable
    RNG so it is deterministically testable.
  - Edition note: kept the **2014 species-ASI** model (unconfirmed default).
    The D&D Beyond page D linked is the 2024 rules (background-ASI); a clean
    seam is left to add that later.
  - **Fixed a latent syntax error in `app.ui.js`** (two single-quoted strings
    closed with `\"` instead of `'`, leaving them unterminated). The file had
    never been browser-loaded, so the UI had never actually rendered until now.
  - Coverage: `test_wizard.py` (33 assertions) + `test_wizard_e2e.py` (15,
    full click-through of the real page). Full suite now **105 green**.

---

## Possible next steps (not started)

- Spellbook: known/prepared spells, slots by class table, concentration tracker.
- Level-up wizard: HP roll or average, ASI/feat at 4/8/12/16/19, subclass prompts.
- Session log with XP awards and loot, per campaign.
- DM mode: party roster, initiative tracker, encounter builder.
- Cloud sync via the `kyodububb` Firebase project (mirror Budget's household model).
- Export a character to PDF / plain text for tables that want paper.
