# Yarn - DEVLOG

_Last updated: 2026-09-11 - Current build: **v1.12 "real feats (Origin + General + one legacy racial)"**_

> ## Handoff note (session restart pending)
> Tree is clean, everything committed through v1.12 and pushed to
> `https://github.com/KyoDubu/Yarn` (main branch). Nothing in flight.
>
> **LIVE URL:** https://kyodubu.github.io/Yarn/ - real GitHub Pages
> hosting, verified working end-to-end.
>
> **The big-picture ask, epic order:** multiclassing (v1.11, done) ->
> **feats (v1.12, done, this entry)** -> spellbook -> subclasses ->
> equipment catalog. D asked to tackle these in the order a person
> actually builds a level-1 character rather than the original priority
> order: Feats comes right after Background (which hands you an Origin
> feat automatically) and before Equipment/Spellbook, with Subclasses
> last since the 2024 rules push every class's subclass choice to level 3.
>
> **v1.12 - Feats, with a real level gate D specifically asked to keep in
> mind:** Two genuinely different rules, both modeled correctly instead
> of flattened into one:
> - **Origin feats** (Alert, Crafter, Healer, Lucky, Magic Initiate,
>   Musician, Savage Attacker, Skilled, Tavern Brawler, Tough) are FREE,
>   granted automatically at level 1 by a 2024-style Background - no
>   choice, no level gate, never occupy a slot. New `originFeatKey` field
>   added to the 7 backgrounds that already carried a display-only
>   `originFeat` string (Artisan/Farmer/Guard/Guide/Merchant/Scribe/
>   Wayfarer) - the existing string stays for display, the new key is
>   what the math actually reads. `YARN.originFeatKey(char)` resolves it.
> - **General feats** (Actor, Athlete, Charger, Durable, Great Weapon
>   Master, Heavily/Lightly/Moderately Armored, Keen Mind, Mobile,
>   Observant, Resilient, Sharpshooter, Shield Master, Weapon Master) are
>   CHOSEN instead of an Ability Score Improvement, and only at levels 4,
>   8, 12, 16, or 19 - `YARN.asiSlotsAvailable(char, prog)` counts how
>   many of those thresholds the character's total level has reached, and
>   the sheet's new "+ Add feat" button refuses (with an explanation) to
>   add a feat past that count. Chosen feats live in a new per-campaign
>   `prog.feats` array (never the origin feat - that one's free and lives
>   nowhere but the background lookup).
> - Also added **Elven Accuracy** as a third category, `"racial"` -
>   the legacy 2014 Xanathar's Guide feat from the conversation that
>   kicked this whole epic off. Never reprinted for 2024, so it's kept
>   distinct from `"general"` and carries a `prereqText` ("Elf or
>   Half-Elf") that the sheet asks the player to self-confirm via a
>   `window.confirm` before adding it - Yarn has no hard species-lock
>   anywhere else either, so this matches the app's existing "trust the
>   table" philosophy rather than inventing new validation machinery.
>
> **Real math, not just labels - three feats actually compute something:**
> `mechanic: "flatHpPerLevel"` (Tough: +2 x total level, folded into
> `suggestedHpMax`), `mechanic: "abilityBonus"` (Resilient, Actor,
> Athlete, Durable, Elven Accuracy, etc.: +1 to a chosen ability, folded
> into `abilityScore` via new `YARN.featAbilityBonus`), and Alert's
> initiative bonus (real 2024 wording: +proficiency bonus, not the 2014
> flat +5 - special-cased directly in `YARN.initiative` since it's the
> only feat that needs that exact formula). Resilient additionally sets
> `grantsSaveProf: true`, which `YARN.featGrantsSaveProf` folds into
> `saveTotal` for whichever ability was picked. Everything else
> (Sharpshooter's -5/+10, Great Weapon Master's bonus attack, Lucky's
> luck-point pool, Magic Initiate's actual spells...) is real, accurate
> catalog data with `mechanic: null` - same honest "display only for now"
> treatment Origin feats already got in v1.10, because simulating a
> combat-trigger or resource-pool feat needs systems Yarn doesn't have
> yet (a real attack-roll flow, a resource tracker hook, a spell list -
> the last of which is literally the next epic).
>
> New `YARN.allFeatKeys(char, prog)` in `app.core.js` is the single list
> every feat-driven calc reads from (origin feat + chosen general/racial
> feats, deduped). New sheet **Feats panel**: shows the level-gate math
> plainly ("ASI/feat slots reached so far: N"), lists chosen feats with a
> "computed" or "manual" badge so it's obvious at a glance which ones
> actually move a number, and a remove button per feat. Background panel
> also upgraded to show the origin feat's real blurb + the same badge,
> not just a bare name.
>
> **Known, deliberate simplification** (documented in the Feats panel
> copy itself): `asiSlotsAvailable` counts ASI thresholds against TOTAL
> character level, not per-class - real 5e can grant more slots than that
> to a multiclassed character (each class has its own ASI progression).
> Same simplification spirit as multiclass spellcasting from v1.11;
> revisit if/when a proper Level-up wizard gets built (it's on the
> roadmap below) since that's the natural place to track "which ASI slot
> came from which class level" precisely.
>
> **Full test suite: 229 assertions across 7 files, all green** -
> `test_rules.py` (63, +9 new feat-math cases: Tough's HP via an
> auto-granted origin feat, Resilient's ability+save stacking, Alert's
> proficiency-bonus initiative, and the exact level-gate table for all 7
> character levels that matter), `test_wizard_e2e.py` (44, +3 new,
> driving the real Feats panel through Playwright: add Resilient with its
> ability-choice prompt, watch the CON score tile move, remove it, watch
> it move back), `test_species.py` (28), `test_homebrew.py` (21),
> `test_wizard.py` (45), `test_wizard_abilities_e2e.py` (17),
> `test_sync_mock.py` (11). Re-run any of them with
> `.venv\Scripts\python -u <file>.py`.
>
> Along the way, fixed a latent multi-dialog bug in `test_wizard_e2e.py`
> itself: stacking two `page.once("dialog", ...)` handlers before a click
> doesn't queue them one-per-dialog like you'd expect - Playwright calls
> every currently-registered listener for EACH dialog, so both fired on
> the first one and the second crashed trying to accept an already-
> handled dialog. Replaced with one persistent FIFO queue
> (`dialog_answers`, popped in order as dialogs actually occur) shared
> for the whole test file.
>
> **v1.11 - multiclassing, done with real RAW math, not just a free-text
> field:** Added `prog.classLevels` - a per-CAMPAIGN breakdown like
> `{fighter: 3, wizard: 2}`. It lives on progress, not the character,
> because multiclassing is something that happens THROUGH PLAY (you
> can't multiclass at level 1 chargen), so the wizard is untouched - it
> stays single-class, which is RAW-correct. Empty `classLevels` (the
> default) means "never multiclassed", falling back byte-for-byte to the
> old single-class math - verified with an explicit regression test that
> the level-5 rogue fixture's `classLevels` stays empty and its behavior
> is bit-identical to before this change.
>
> New `YARN.classBreakdown(char, prog)` in `app.core.js` is the single
> source of truth every level-dependent calc now reads from - always
> orders `char.klass` (the class chosen at creation) first, because RAW
> cares which class you STARTED as for two things: saving throw
> proficiencies only ever come from that one class, and only your very
> first character level ever gets a MAX (not average) hit die roll.
> `YARN.totalLevel()` sums it for proficiency bonus/XP display.
>
> Rebuilt from that breakdown: **`suggestedHpMax`** (mixed hit dice per
> class, correct "only level 1 is max" rule), **`spellSlots`** (full
> casters contribute their whole level, half casters floor(level/2),
> third casters floor(level/3), summed and looked up on the existing
> full-caster table - this is the real Multiclass Spellcasting formula
> from the PHB). Also added **`YARN.PACT_SLOTS`** to `app.rules.js` and
> fixed a bug that predates multiclassing entirely: Warlock's Pact Magic
> was silently being computed on the FULL-caster table (wrong even for a
> single-classed Warlock - Pact Magic is its own tiny short-rest pool).
> `spellSlots()`'s return shape changed from a bare array to
> `{slots, pact}` - safe, since nothing in the UI or tests consumed the
> old shape yet (spell slots aren't surfaced on the sheet at all - that's
> the still-open "Spellbook" epic).
>
> **Known, deliberate simplification:** `spellSaveDC`/`spellAttack` still
> use only the STARTING class's casting ability - true multiclass 5e has
> a separate DC per casting class. Flagged in-code; fixing it properly
> needs the same real spell-list data the Spellbook epic needs anyway,
> so it's not worth half-building here.
>
> New sheet UI: a **Classes panel** folded into the existing identity
> panel. Single-classed (the default): just a small "+ Multiclass" link,
> zero visual change otherwise. Click it and answer two prompts (which
> class, how many levels) and it seeds the breakdown, locking in the
> starting class's current level so nothing resets to 1; the plain Level
> field becomes a computed, disabled display showing the true total, and
> a "Revert to single class" button collapses it back down (preserving
> the total, not losing progress). Followed the same `window.prompt`
> pattern already used for custom skills/currencies - no new UI paradigm
> introduced. Added `YARN.hitDicePool()` too (hit dice grouped by die
> size) - not wired into a rest-tracker UI yet, but it's what one will
> need, and it fell straight out of the same breakdown for free.
>
> **Full test suite: 216 assertions across 7 files, all green** - 10 new
> hand-verified RAW math cases in `test_rules.py` (Fighter 3/Wizard 2 and
> Warlock 5/Sorcerer 3, covering total level, prof bonus, saves, HP, and
> both spell-slot pools) plus a real end-to-end UI test in
> `test_wizard_e2e.py` that drives the actual Classes panel through
> Playwright, including answering the real `window.prompt` dialogs.
>
> **v1.10 - the 7 missing 2024 PHB backgrounds, additive:** v1.9 moved
> the ASI math to 2024 rules but kept Yarn's original 13 background
> *names* (2014 PHB list) rather than the real 2024 PHB's renamed
> 16-background list. D asked for a deep-dive comparison, which showed
> the two lists are NOT interchangeable - only 9 names survive as-is
> (Acolyte, Charlatan, Criminal, Entertainer, Hermit, Noble, Sage,
> Sailor, Soldier); the 4 Yarn-only 2014 names (Folk Hero, Guild
> Artisan, Outlander, Urchin) don't map cleanly onto any single 2024
> equivalent (their skills split across two different new backgrounds
> each, e.g. Outlander's Athletics/Survival spreads across Guard's
> Athletics and Guide's Survival). Renaming/merging would have silently
> changed which skills an existing character has, so D confirmed:
> **add the missing 7, don't touch the 13.**
>
> Added, with real 2024 PHB data (skills, tool, Origin feat, ability
> candidates - verified via 5etools' `backgrounds.json`, which cleanly
> separates 2014 `PHB` and 2024 `XPHB` entries):
> **Artisan, Farmer, Guard, Guide, Merchant, Scribe, Wayfarer.**
> `YARN.BACKGROUNDS` is now 20 entries, fully alphabetized (no test
> depended on the old order).
>
> The interesting wrinkle: 2024 backgrounds don't grant a roleplay
> **feature** like 2014 ones do (Guild Membership, Rustic Hospitality,
> etc.) - they grant an **Origin feat** instead (Crafter, Tough, Alert,
> Lucky...). Yarn doesn't simulate feat mechanics at all, so `originFeat`
> is display-only, same spirit as `feature` always was. Each
> `BACKGROUND_INFO` entry now has **exactly one** of `feature` /
> `originFeat`, never both - `backgroundPanel()` in `app.ui.js` renders
> whichever one is present. Everything else (skills baked into
> `skillTotal`, the 2024 ability-choice picker from v1.9) is 100%
> shared code - the 7 new backgrounds needed zero new plumbing, only
> new data, because the background system was already generic.
>
> Added a background data-integrity test to `test_rules.py` (mirrors
> `test_species.py`'s pattern): loops every background, checks it has
> exactly 2 real skills, exactly one of feature/originFeat, a blurb, and
> exactly 3 unique valid ability candidates. Plus an end-to-end spot
> check on Guide (one of the new ones) and a sheet-rendering check that
> its origin feat actually shows up in the Background panel.
>
> **Full test suite: 199 assertions across 7 files, all green** -
> `test_rules.py` (44), `test_species.py` (28), `test_homebrew.py` (21),
> `test_wizard.py` (45), `test_wizard_e2e.py` (33),
> `test_wizard_abilities_e2e.py` (17), `test_sync_mock.py` (11).
> Re-run any of them with `.venv\Scripts\python -u <file>.py`.
>
> **v1.9 - the big rules migration, 2014 -> 2024:** D confirmed Yarn
> should follow the 2024 PHB's ability-score model: **species now
> grants ZERO ability bonus**, full stop, for every species and every
> subrace. The bonus moved to **Background** instead - at character
> creation you spend exactly 3 points across your background's 3
> candidate abilities, either +2 to one and +1 to a different one, or
> +1 to all three (never more than +2 on any single ability).
>
> What changed, file by file:
> - `app.core.js` - `YARN.abilityScore()` no longer calls `speciesASI()`;
>   it now reads `char.backgroundAsi[key]` instead. Added
>   `YARN.backgroundAsiSpent()` / `YARN.backgroundAsiValid()` (the only
>   validity rule that matters: total spent === 3 and no ability > +2 -
>   with only 3 slots capped at 0-2 each, that's mathematically enough
>   to guarantee a legal {2,1,0} or {1,1,1} split, nothing else can sum
>   to 3). `blankCharacter()` gained a `backgroundAsi` field, backfilled
>   for old saves via `normalize()`.
> - `YARN.speciesASI()` / the old 2014 per-species/subrace `asi` data in
>   `app.species.js` were **deliberately left in place, not deleted** -
>   they're now pure historical/reference data with zero effect on the
>   math. Ripping out ~110 `asi: {...}` entries across 41 species + all
>   their subraces for a purely cosmetic cleanup was judged not worth
>   the diff risk; `speciesASI()`'s doc comment now says clearly that
>   it's unused by `abilityScore()`. `speciesProfile()` (feeds the sheet's
>   "Species Traits" panel) had its now-pointless `asi` field removed
>   from the bundle since nothing rendered it anyway.
> - `app.rules.js` - added `YARN.BACKGROUND_ABILITY_CHOICES` / 
>   `YARN.backgroundAbilityChoices(name)`, a 3-ability trio per
>   background. Yarn kept its original 13-background list rather than
>   swapping in the 2024 PHB's renamed 16-background set (Acolyte,
>   Artisan, Farmer, Guide, Wayfarer, etc.) - that would be a much
>   bigger, separate content migration. Each existing background's trio
>   was picked to match its already-defined skills (e.g. Hermit's
>   medicine/religion skills -> wis/int/con candidates), not lifted
>   verbatim from the real PHB text.
> - `app.wizard.js` - the Background step now shows a point-buy-style
>   stepper picker (reusing the existing `.wz-step`/`.wz-buyval`/
>   `.wz-points` styling from the point-buy ability step) for its 3
>   candidate abilities. `canAdvance()` blocks "Next" until exactly 3
>   points are spent. Picking a *new* background resets the allocation
>   to zero (a different background has a different 3-ability set, so a
>   prior allocation may not even be legal anymore). The abilities step's
>   assign/direct tables swapped their always-now-zero "Species" bonus
>   column for a "Background" column showing the real contributor. The
>   species step's card hints and the subrace popup dropped their now-
>   inactive "+2 DEX"-style text since it no longer means anything.
> - `app.ui.js` - the character sheet's Background dropdown grew an
>   inline 3-input ability-bonus picker (plain numbers, no hard
>   validation - matches the sheet's existing "no guard rails, type what
>   your table agreed on" philosophy elsewhere). Changing background on
>   the sheet resets the allocation to zero, mirroring the wizard.
> - Tests updated across the board (`test_species.py`, `test_rules.py`,
>   `test_wizard.py`, `test_wizard_e2e.py`,
>   `test_wizard_abilities_e2e.py`) to stop asserting species contributes
>   an ability bonus, and to cover the new background-ASI plumbing
>   (validity math, wizard gating + stepper clicks, sheet-side inputs,
>   reset-on-change in both places).
>
> **Full test suite: 191 assertions across 7 files, all green** -
> `test_rules.py` (38), `test_species.py` (28), `test_homebrew.py` (21),
> `test_wizard.py` (45), `test_wizard_e2e.py` (31),
> `test_wizard_abilities_e2e.py` (17), `test_sync_mock.py` (11).
> Re-run any of them with `.venv\Scripts\python -u <file>.py`.
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
> 2. ~~Edition is still 2014 SRD (species-ASI) by default~~ - **RESOLVED in
>    v1.9**: D confirmed the 2024 rules (background-ASI). Species now grants
>    zero ability bonus everywhere; Background grants a player-chosen +2/+1
>    or +1/+1/+1 split across 3 candidate abilities. See the v1.9 handoff
>    note above for the full breakdown.
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

## Possible next steps (agreed priority order as of v1.12 - "flesh out
## Standard mode" epic, re-ordered to match actual character-build order,
## each one scoped separately, do NOT batch these)

- ~~Multiclassing~~ - done, v1.11.
- ~~Feats~~ - done, v1.12 (Origin + General + Elven Accuracy as a legacy
  racial example). Only the flat-math and ability-bonus feats compute a
  real number so far - Lucky's luck points, Magic Initiate's spells, and
  every attack-roll-trigger feat (Sharpshooter, Great Weapon Master,
  Charger, Shield Master...) are accurate catalog data but still
  display-only, same as documented in the v1.12 entry above.
- **Equipment & gear catalog** (next up): item data (cost/weight/
  properties), real starting-equipment rules by class + background
  instead of a blank free-text inventory list.
- Spellbook: real spell catalog, known/prepared spells, concentration
  tracker. Also unblocks fixing the multiclass spell-save-DC
  simplification noted in v1.11, and would let Magic Initiate/Lucky-
  adjacent feats finally compute their real effects.
- Subclasses: currently a free-text field: turn it into real tracked
  features by class and level. Deliberately last - the 2024 rules push
  every class's subclass choice to level 3, so it's not part of the
  initial character-build flow the other four items are.
- Level-up wizard: HP roll or average, prompts for ASI-or-feat at
  4/8/12/16/19 (now with a real feat catalog to choose from) and picking
  up a new class (now that multiclassing itself exists). Also the right
  place to fix the "total level, not per-class" ASI-slot simplification
  from v1.12.
- Session log with XP awards and loot, per campaign.
- DM mode: party roster, initiative tracker, encounter builder.
- Export a character to PDF / plain text for tables that want paper.
