# Yarn - DEVLOG

_Last updated: 2026-09-04 - Current build: **v1.8 "live on GitHub Pages, dragon logo and all"**_

> ## Handoff note (session restart pending)
> Tree is clean, everything committed through v1.8 and pushed to
> `https://github.com/KyoDubu/Yarn` (main branch). Nothing in flight.
>
> **LIVE URL:** https://kyodubu.github.io/Yarn/ - real GitHub Pages
> hosting, verified working end-to-end (real 200, app renders, zero
> console errors). Cloud sync's Firestore rules and the GitHub Pages
> domain ARE both confirmed live as of 2026-09-08 - sign-in and party
> sync verified working for a real (non-localhost) user.
>
> **2026-09-08 correction:** an earlier handoff note here claimed the
> `yarnParties` Firestore rules block had already been pasted into the
> `kyodububb` console - that was WRONG. The console only ever had
> Budget's `households` block; `yarnParties` was missing entirely,
> which silently denied every Yarn cloud-sync read/write with
> "Permission Denied" (first hit: the `findParty()` lookup query).
> Fixed by hand-merging both `match` blocks into one rules doc and
> publishing it in the console (see `firestore.rules` in this repo for
> the source of truth going forward - always paste that alongside
> Budget's block, never assume it's already there without checking the
> live Rules tab). Also confirmed for the record: signing in with
> Google does NOT require adding each player's email anywhere in the
> Firebase console - any Google account can authenticate; the
> `members` array per-party-doc is what actually gates data access.
>
> **Full test suite: 170 assertions across 7 files, all green** -
> `test_rules.py` (38), `test_homebrew.py` (21), `test_wizard.py` (33),
> `test_wizard_e2e.py` (27), `test_species.py` (27),
> `test_wizard_abilities_e2e.py` (12), `test_sync_mock.py` (12).
> Re-run any of them with `.venv\Scripts\python -u <file>.py`.
>
> **What happened since v1.7:**
> - Pushed the repo to GitHub for real (`git remote add origin` +
>   push) - it didn't exist as a remote before.
> - Fixed a GitHub Pages build failure: the `docs/` folder was tracked as
>   `Docs` (capital D) - fine on case-insensitive Windows, but GitHub's
>   Linux build runner is case-sensitive and couldn't find lowercase
>   `docs/.nojekyll`, so Jekyll ran instead of a raw static serve and
>   crashed. Renamed the tracked folder to `docs` via a two-step `git mv`.
>   `Docs/` also physically held local-only reference material (character
>   sheet PDF + screenshot) - excluded those two files by name in
>   `.gitignore` rather than the whole folder.
> - Fixed GitHub's default branch mismatch (repo defaulted to `master`,
>   local pushed to both `master`/`main` at different points) - settled on
>   `main` as the one true branch, deleted `master`.
> - Added a real logo: `Static/yarn.png` (a hand-drawn dragon wrapped
>   around a ball of yarn, red silhouette, no text - D found this after an
>   earlier attempt at hand-coded SVG vector art didn't land a convincing
>   dragon after several tries). Wired in as favicon + topbar branding
>   (replacing the yarn-ball emoji), sized at 56x56 in the topbar.
> - `build_pages.py` extended with an `ASSET_DIRS` list so subfolders like
>   `Static/` get copied into `docs/` on every rebuild. Also hardened
>   against a `PermissionError` from `shutil.rmtree` - this machine's repo
>   lives under OneDrive, which can transiently lock a just-synced folder;
>   switched to mkdir+overwrite-in-place instead of rmtree+copytree.
>
> **Open threads from prior sessions (D hasn't picked yet):**
> 1. Draconic ancestry breath-weapon mechanics are recorded as trait *text*
>    only (e.g. "Acid damage - 5x30 ft line, Dex save") - not an actual
>    computed/rollable feature.
> 2. Edition is still 2014 SRD (species-ASI) by default - D was shown the
>    2024 rules (background-ASI) and hasn't confirmed a switch. See the
>    "Key 2024 Rules Distinction" section below before touching ASI math.
> 3. Custom domain (D considered spinayarn.com) shelved - it's taken/
>    parked via Afternic. `kyodubu.github.io/Yarn` works fine as-is;
>    revisit only if D finds a name they actually want to buy.
>
> Everything else (character CRUD, campaigns, derived stats, homebrew layer,
> creation wizard, 41 species/subraces with stacking ASI, background
> proficiencies, subrace picker popup, ability-score usability fixes, cloud
> sync) is built, tested, and live. See the Build Log at the bottom for
> the full history.

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
| `app.rules.js` | Static 5e SRD data + generation tables (standard array, point-buy, suggested arrays, name parts) + lookup helpers. |
| `app.species.js` | Species + subspecies (subrace) data: size/speed/ASI/traits/languages. Big domain, own file. |
| `app.core.js` | Data model, `YARN.state`, `normalize()`, save/load, derived-stat math, dice, point-buy, clone. |
| `app.wizard.js` | The guided character-creation wizard (modal step machine). |
| `app.sync.js` | Firebase Auth (Google) + Firestore party sync. Optional - no-ops offline. |
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
- **v1.3** - **Species/subspecies data overhaul**. Went from 9 species with no
  subraces to **41 species**, most with real subraces (subraces STACK their
  ability bonus on top of the base species - a Hill Dwarf gets both the
  Dwarf's +2 CON and the Hill's +1 WIS). New `app.species.js` holds it all
  (own file - too big a domain for `app.rules.js`).
  - Added `YARN.speciesASI/speciesSpeed/speciesSize/speciesProfile` to
    `app.core.js`, replacing the old single-species lookup in `abilityScore`.
    A subrace can override its parent's speed (Wood Elf 35 ft) or size.
  - New **"Species Traits" panel** on the sheet: darkvision, resistances,
    languages and key features as display-only text (never fed back into
    the math).
  - Wizard's species step gained an **inline subrace picker** - appears the
    moment you pick a species that has one, and blocks Next until you choose
    (mirrors the rulebook: subraces aren't optional where they exist).
  - Sheet gained a matching **Subspecies dropdown**; switching species
    blanks a now-invalid subspecies automatically, on both the wizard and
    the sheet.
  - This is also **Marei's actual fix**: Shadar-Kai is now a real Elf
    subrace instead of an unrecognized species name.
  - Post-2020 species with floating (player's-choice) ability bonuses
    (Variant Human, Changeling, Harengon, Owlin, Fairy, Warforged's second
    bonus, Simic Hybrid's third) store `asi: {}` and say so in their trait
    text, rather than inventing a bonus nobody chose - apply those via the
    existing per-campaign ASI fields.
  - Coverage: `test_species.py` (27 assertions: data integrity across all
    41 species/subraces, stacking math, speed/size overrides, clone
    fidelity) + 4 new assertions in `test_wizard_e2e.py` covering the
    sheet's own species/subspecies dropdown and traits panel. A bug this
    caught: the subspecies `<select>` wasn't triggering a re-render, so the
    traits panel went stale - fixed before it ever shipped. Full suite now
    **140 green**.
- **v1.4** - **Background proficiencies wired up.** Backgrounds always grant
  two fixed skills in the 2014 PHB (never a player choice), so they're baked
  straight into `YARN.skillTotal` the exact same way class saves are baked
  into `saveTotal` - no separate "background skill profs" list to store,
  toggle, or let drift out of sync with whatever background is picked.
  - New `YARN.BACKGROUND_INFO` table in `app.rules.js`: skills, tool
    proficiencies, bonus-language count, and the background's roleplay
    feature for all 13 SRD backgrounds. `YARN.backgroundInfo(name)` looks
    it up; `YARN.backgroundSkills(char)` in `app.core.js` is the single
    source other code reads from.
  - Sheet's Skills panel: background-granted skills now render checked +
    disabled with a "background" badge, mirroring how class-granted saves
    already render in the Saving Throws panel. New display-only
    **Background panel** on the sheet lists granted skills, tool profs,
    bonus languages, and the feature name (tools/languages/feature are
    text only - Yarn has no tool-proficiency or language state to compute
    against, same reasoning as the Species Traits panel).
  - Wizard's background step now shows which two skills each background
    grants right on the picker card, so the choice isn't blind.
  - Coverage: 2 new assertions in `test_rules.py` (a Criminal's `deception`
    total auto-includes proficiency; `backgroundSkills` returns the right
    pair). Full suite now **142 green**.
- **v1.5** - **Subrace picker gets its own popup.** The inline subrace grid
  from v1.3 sat directly under a 41-species grid, which made the species
  step of the wizard sprawl. Subraces now live in a standalone modal on top
  of the wizard:
  - Picking a species with subraces (e.g. Elf, Dwarf) **auto-opens** the
    popup - matches the rulebook, where a subrace isn't optional if the
    species has one. Picking a subrace auto-closes it.
  - A persistent **subrace bar** on the species step shows the current
    choice (or "No subrace chosen yet") with a **Change subrace** button to
    reopen it any time.
  - Popup closes via its **Done** button, clicking the backdrop, or
    **Escape** (Escape closes the popup first if it's open, only closing
    the whole wizard on a second press).
  - New `.wz-sub-host` layer in the overlay markup keeps the popup's DOM
    separate from the step body, so re-rendering the wizard step doesn't
    have to know or care whether the popup is open.
  - Coverage: 4 new assertions in `test_wizard_e2e.py` (auto-open, blocked
    Next until chosen, auto-close on pick, reopen/Done roundtrip). Full
    suite now **146 green**.
- **v1.6** - **Abilities step stops lying to you.** Three usability bugs in
  "Determine Ability Scores," fixed:
  - **Standard array duplicate-slot guard.** You could silently assign the
    same pool value (e.g. "15") to two different abilities. Nothing warned
    you, and "Next" just stayed disabled forever because
    `poolFullyAssigned()` correctly rejects a repeated slot - it just never
    told you why. Now `assignTable()` disables any option already claimed
    by *another* ability (labeled "(used)"), so a duplicate is no longer
    physically selectable.
  - **Point buy's stepper buttons now reflect their own limits.** The 8-15
    cap is correct 5e SRD (it is not a bug that you cannot buy a 16 -
    species bonuses stack on top, shown in the Species column) but the +/-
    buttons previously gave zero feedback at the boundary - clicking + at
    15 just silently did nothing. They are real `disabled` buttons now at
    the floor (8), the cap (15), and when the remaining budget cannot
    afford the next point. Help text spells out the 15-cap explicitly.
  - **Dice-roll animation.** "Roll 4d6 (drop lowest) x6" used to just swap
    numbers instantly. It now runs a tumble - the six pool chips cycle
    random junk values with a CSS rotate/scale animation - before landing
    on the one real `YARN.rollAbilitySet()` result. The dice math itself
    still runs exactly once; the animation is cosmetic ticks on top, so
    nothing about determinism or testability changed. Respects
    `prefers-reduced-motion`. The roll button and pool inputs disable
    themselves mid-animation, and switching method tabs, stepping
    back-or-forward, or closing the wizard mid-roll all cleanly cancel the
    timer instead of leaking it.
  - Coverage: new `test_wizard_abilities_e2e.py` (12 assertions covering
    dup-slot disabling, point-buy boundary disabling, and roll animation
    start/finish/cleanup). Full suite now **158 green** across 6 files.
- **v1.7** - **Cloud sync joins the party.** Mirrors the Budget Planner's
  Firebase Auth + Firestore household-sync architecture almost exactly -
  same trusted Google-login project (`kyodububb`), same "shared document,
  invite by email" model - but reuses none of Budget's collection, so the
  two apps' data can never collide even though they share a project.
  - New `app.sync.js`, own Firestore collection `yarnParties`. A "party"
    doc holds the JSON-serialized `YARN.state` plus a `members` array of
    lowercased emails; anyone in `members` sees the same roster/campaigns
    live, on every device.
  - Sign in with Google -> no party yet -> "Create our party" -> invite
    your DM/players by email or copy a shareable invite link. Re-creating
    an existing party reconnects instead of wiping it (same regression
    Budget had to guard against).
  - Own-write echo detection (skip re-render when a Firestore snapshot is
    just your own save bouncing back) plus a focus-preserving deferred-
    apply guard: a genuine remote change that arrives while you're mid-
    edit in a field is held until you leave that field, so your cursor
    never gets yanked out from under you.
  - Widget mounts once onto `document.body` (same pattern `app.wizard.js`
    uses for its modal overlay) so `app.ui.js`'s full-page re-renders can
    never wipe out the sync panel or blow away its open/closed state.
  - Fully optional and safe offline: `yarn.html` loads the Firebase SDK +
    a public web config; if that fails (no network, blocked, ad-blocker),
    `YARN.hasSync()` is false and `YARN.initSync` becomes a no-op - the
    app behaves exactly as it always has, with zero console errors
    (verified via a real non-mocked headless-browser boot check).
  - New `firestore.rules` for the `yarnParties` collection - needs to be
    pasted into the Firebase console by hand (no `firebase`/`gcloud` CLI
    available here) before real sign-in will work end-to-end.
  - Coverage: new `test_sync_mock.py` (12 assertions, mocked Firebase -
    mirrors Budget's `test_auth_mock.py` pattern). Full suite now
    **170 green** across 7 files.
  - **Bonus fix, unrelated but found along the way:** `yarn.html` had been
    silently gitignored this entire project (Windows git case-folded a
    leftover `Yarn.html` build-artifact rule copied from Budget's
    `.gitignore`, even though Yarn has no build step yet per this very
    file). Every prior "clean tree" commit never actually included the
    real game file. Fixed the `.gitignore` and committed `yarn.html` for
    real.

---

## Possible next steps (not started)

- Spellbook: known/prepared spells, slots by class table, concentration tracker.
- Level-up wizard: HP roll or average, ASI/feat at 4/8/12/16/19, subclass prompts.
- Session log with XP awards and loot, per campaign.
- DM mode: party roster, initiative tracker, encounter builder.
- Cloud sync via the `kyodububb` Firebase project (mirror Budget's household model).
- Export a character to PDF / plain text for tables that want paper.
