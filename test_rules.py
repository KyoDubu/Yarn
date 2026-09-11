"""test_rules.py - proves the derived-stat math in app.core.js is correct.

Runs the real modules in a real browser (no mocks, no reimplementation of the
math in Python - that would just test a copy). Every expectation below is a
hand-checked 5e SRD result.

    .venv\\Scripts\\python -u test_rules.py
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
MODULES = ["app.rules.js", "app.species.js", "app.core.js"]

# A level 5 elf rogue. Hand-computed expectations:
#   DEX 16 base + 2 background ASI (2024 rules: species grants none; Criminal's
#     candidates are cha/dex/con, so +2 DEX is a legal pick) = 18 -> +4 mod
#   CON 14 -> +2 mod, INT 12 -> +1, STR 8 -> -1
#   Prof bonus at level 5 = 3
#   Rogue saves = dex, int
#   Stealth = expertise -> +4 dex + (3 * 2) = +10
#   Perception = proficient -> +2 wis... WIS 10 -> +0, so +0 + 3 = +3
#   Passive perception = 10 + 3 = 13
#   Studded leather (12) + dex 4 (no cap) = AC 16
ROGUE = {
    "id": "char_rogue",
    "name": "Kaelen",
    "species": "elf",
    "klass": "rogue",
    "background": "Criminal",
    "abilities": {"str": 8, "dex": 16, "con": 14, "int": 12, "wis": 10, "cha": 13},
    "backgroundAsi": {"str": 0, "dex": 2, "con": 0, "int": 0, "wis": 0, "cha": 0},
    "saveProfs": [],
    "skillProfs": ["perception", "acrobatics"],
    "skillExpertise": ["stealth"],
}

CASES = [
    # (label, js expression, expected)
    ("mod(18)", "YARN.mod(18)", 4),
    ("mod(8)", "YARN.mod(8)", -1),
    ("mod(10)", "YARN.mod(10)", 0),
    ("profBonus(1)", "YARN.profBonus(1)", 2),
    ("profBonus(4)", "YARN.profBonus(4)", 2),
    ("profBonus(5)", "YARN.profBonus(5)", 3),
    ("profBonus(20)", "YARN.profBonus(20)", 6),
    # Species ASI is applied to the base score
    ("elf dex 16 + background ASI -> 18", "YARN.abilityScore(C, P, 'dex')", 18),
    ("dex mod +4", "YARN.abilityMod(C, P, 'dex')", 4),
    # Rogue is proficient in dex + int saves, not con
    ("dex save +7", "YARN.saveTotal(C, P, 'dex')", 7),
    ("int save +4", "YARN.saveTotal(C, P, 'int')", 4),
    ("con save +2 (no prof)", "YARN.saveTotal(C, P, 'con')", 2),
    # Expertise doubles proficiency
    ("stealth expertise +10", "YARN.skillTotal(C, P, 'stealth')", 10),
    ("acrobatics prof +7", "YARN.skillTotal(C, P, 'acrobatics')", 7),
    ("athletics untrained -1", "YARN.skillTotal(C, P, 'athletics')", -1),
    ("passive perception 13", "YARN.passivePerception(C, P)", 13),
    ("initiative +4", "YARN.initiative(C, P)", 4),
    # Background (Criminal) grants deception + stealth automatically, no
    # separate opt-in needed - CHA 13 -> +1 mod, pb 3 -> +4
    ("deception from background +4", "YARN.skillTotal(C, P, 'deception')", 4),
    ("background skills list", "YARN.backgroundSkills(C)", ["deception", "stealth"]),
    # AC: studded leather has no dex cap
    ("AC studded 16", "YARN.ac(C, P)", 16),
    # Non-caster has no spell DC
    ("rogue spell DC null", "YARN.spellSaveDC(C, P)", None),
    ("levelForXp(6500)", "YARN.levelForXp(6500)", 5),
    ("levelForXp(6499)", "YARN.levelForXp(6499)", 4),
    ("levelForXp(0)", "YARN.levelForXp(0)", 1),
]


def main() -> int:
    src = "\n".join((HERE / m).read_text(encoding="utf-8") for m in MODULES)
    failures = []

    with sync_playwright() as pw:
        # Use the installed Edge rather than a downloaded Chromium: browser
        # downloads are unreliable on this network. Same trick the Budget tool uses.
        browser = pw.chromium.launch(channel="msedge")
        page = browser.new_page()
        page.goto("about:blank")
        page.add_script_tag(content=src)

        # Build the test fixture inside the page.
        page.evaluate(
            """(rogue) => {
                YARN.state = YARN.normalize({
                    characters: [rogue],
                    campaigns: [{id: 'camp_a', name: 'Strahd'},
                                {id: 'camp_b', name: 'Tuesday Game'}]
                });
                // Level 5 in campaign A, level 2 in campaign B - the whole point.
                YARN.getProgress('camp_a', rogue.id).level = 5;
                YARN.getProgress('camp_a', rogue.id).armorWorn = 'studded';
                YARN.getProgress('camp_b', rogue.id).level = 2;
                window.C = YARN.getCharacter(rogue.id);
                window.P = YARN.getProgress('camp_a', rogue.id);
            }""",
            ROGUE,
        )

        for label, expr, expected in CASES:
            actual = page.evaluate("() => " + expr)
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- the headline feature: one character, two campaigns ----
        print("\n  -- same character, different campaigns --")
        multi = page.evaluate(
            """() => {
                const id = 'char_rogue';
                const a = YARN.getProgress('camp_a', id);
                const b = YARN.getProgress('camp_b', id);
                const C = YARN.getCharacter(id);
                return {
                    levelA: a.level, levelB: b.level,
                    pbA: YARN.profBonus(a.level), pbB: YARN.profBonus(b.level),
                    stealthA: YARN.skillTotal(C, a, 'stealth'),
                    stealthB: YARN.skillTotal(C, b, 'stealth'),
                    campaignCount: YARN.campaignsFor(id).length
                };
            }"""
        )
        multi_cases = [
            ("level in campaign A", multi["levelA"], 5),
            ("level in campaign B", multi["levelB"], 2),
            ("prof bonus A", multi["pbA"], 3),
            ("prof bonus B", multi["pbB"], 2),
            ("stealth A (expertise, pb3)", multi["stealthA"], 10),
            ("stealth B (expertise, pb2)", multi["stealthB"], 8),
            ("character is in 2 campaigns", multi["campaignCount"], 2),
        ]
        for label, actual, expected in multi_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- normalize must survive garbage + prune orphans ----
        print("\n  -- normalize / backward compat --")
        norm = page.evaluate(
            """() => {
                // A save from a hypothetical older version: missing fields,
                // plus a progress bucket for a campaign that no longer exists.
                const s = YARN.normalize({
                    characters: [{id: 'c1', name: 'Old Save'}],
                    campaigns: [{id: 'k1', name: 'Real'}],
                    progress: {
                        k1: {c1: {level: 3}},
                        ghost: {c1: {level: 99}}
                    }
                });
                return {
                    hasAbilities: !!s.characters[0].abilities,
                    strDefault: s.characters[0].abilities.str,
                    skillProfsIsArray: Array.isArray(s.characters[0].skillProfs),
                    ghostPruned: s.progress.ghost === undefined,
                    realKept: s.progress.k1.c1.level,
                    currencyBackfilled: s.progress.k1.c1.currency.gp,
                    uiPresent: !!s.ui
                };
            }"""
        )
        norm_cases = [
            ("abilities backfilled", norm["hasAbilities"], True),
            ("str defaults to 10", norm["strDefault"], 10),
            ("skillProfs is array", norm["skillProfsIsArray"], True),
            ("orphan campaign pruned", norm["ghostPruned"], True),
            ("real progress kept", norm["realKept"], 3),
            ("currency backfilled", norm["currencyBackfilled"], 0),
            ("ui block present", norm["uiPresent"], True),
        ]
        for label, actual, expected in norm_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- background data integrity (20 backgrounds: 13 original + 7
        # added for real 2024 PHB parity, additive not a rename) ----------
        print("\n  -- background data integrity --")
        bg_report = page.evaluate(
            """() => {
                const problems = [];
                const validSkills = YARN.SKILLS.map(s => s.key);
                YARN.BACKGROUNDS.forEach(name => {
                    const info = YARN.BACKGROUND_INFO[name];
                    if (!info) { problems.push(name + ' missing BACKGROUND_INFO'); return; }
                    if (!Array.isArray(info.skills) || info.skills.length !== 2) {
                        problems.push(name + ' does not grant exactly 2 skills');
                    } else {
                        info.skills.forEach(k => {
                            if (validSkills.indexOf(k) === -1) { problems.push(name + ' has unknown skill ' + k); }
                        });
                    }
                    const hasFeature = !!info.feature, hasOriginFeat = !!info.originFeat;
                    if (hasFeature === hasOriginFeat) {
                        problems.push(name + ' must have exactly one of feature/originFeat, has feature=' +
                            hasFeature + ' originFeat=' + hasOriginFeat);
                    }
                    if (!info.blurb) { problems.push(name + ' has no blurb'); }
                    const choices = YARN.backgroundAbilityChoices(name);
                    if (choices.length !== 3) { problems.push(name + ' ability choices should be 3, got ' + choices.length); }
                    if (new Set(choices).size !== choices.length) { problems.push(name + ' ability choices has duplicates'); }
                    choices.forEach(k => {
                        if (YARN.ABILITY_KEYS.indexOf(k) === -1) { problems.push(name + ' has unknown ability ' + k); }
                    });
                });
                return { count: YARN.BACKGROUNDS.length, problems };
            }"""
        )
        bg_cases = [
            ("20 backgrounds total (13 original + 7 added for 2024 parity)", bg_report["count"], 20),
            ("no background data-integrity problems", bg_report["problems"], []),
        ]
        for label, actual, expected in bg_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # spot-check one of the new 2024-only backgrounds end to end
        guide = page.evaluate(
            """() => {
                const info = YARN.BACKGROUND_INFO['Guide'];
                return {
                    skills: info.skills,
                    tools: info.tools,
                    originFeat: info.originFeat,
                    hasFeature: !!info.feature,
                    abilityChoices: YARN.backgroundAbilityChoices('Guide')
                };
            }"""
        )
        guide_cases = [
            ("Guide grants stealth + survival (real 2024 PHB data)", guide["skills"], ["stealth", "survival"]),
            ("Guide grants Cartographer's tools", guide["tools"], ["Cartographer's tools"]),
            ("Guide grants the Magic Initiate (Druid) origin feat, not a 2014 feature",
             (guide["originFeat"], guide["hasFeature"]), ("Magic Initiate (Druid)", False)),
            ("Guide's ability candidates are dex/con/wis", guide["abilityChoices"], ["dex", "con", "wis"]),
        ]
        for label, actual, expected in guide_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- multiclassing: real RAW math, opt-in via prog.classLevels ----
        print("\n  -- multiclassing (Fighter 3 / Wizard 2, starting class Fighter) --")
        mc = page.evaluate(
            """() => {
                const full = YARN.normalize({ characters: [{
                    id: 'mc1', name: 'Multi', klass: 'fighter', species: 'human',
                    background: 'Soldier',
                    abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 }
                }] });
                const ch = full.characters[0];
                const prog = { level: 1, classLevels: { fighter: 3, wizard: 2 } };
                return {
                    totalLevel: YARN.totalLevel(ch, prog),
                    profBonus: YARN.profBonus(YARN.totalLevel(ch, prog)),
                    saveStr: YARN.saveTotal(ch, prog, 'str') > YARN.abilityMod(ch, prog, 'str'),
                    saveInt: YARN.saveTotal(ch, prog, 'int') === YARN.abilityMod(ch, prog, 'int'),
                    hp: YARN.suggestedHpMax(ch, prog),
                    slots: YARN.spellSlots(ch, prog)
                };
            }"""
        )
        mc_cases = [
            ("Fighter 3/Wizard 2 totals to character level 5", mc["totalLevel"], 5),
            ("prof bonus uses the COMBINED total level (+3, not +2)", mc["profBonus"], 3),
            ("STR save is proficient (Fighter is the starting class)", mc["saveStr"], True),
            ("INT save is NOT proficient (multiclass levels don't add save profs)", mc["saveInt"], True),
            ("HP: max d10 at lvl1, avg d10 x2, avg d6 x2, +2 CON every level = 40", mc["hp"], 40),
            ("spell slots come only from the 2 Wizard levels (combined caster level 2)",
             mc["slots"], {"slots": [3, 0, 0, 0, 0, 0, 0, 0, 0], "pact": None}),
        ]
        for label, actual, expected in mc_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        print("\n  -- multiclassing: Warlock 5 / Sorcerer 3 (Pact Magic stays separate) --")
        mc2 = page.evaluate(
            """() => {
                const full = YARN.normalize({ characters: [{
                    id: 'mc2', name: 'Patchwork', klass: 'warlock', species: 'human',
                    background: 'Sage',
                    abilities: { str:10,dex:10,con:10,int:10,wis:10,cha:14 }
                }] });
                const ch = full.characters[0];
                const prog = { level: 1, classLevels: { warlock: 5, sorcerer: 3 } };
                return { totalLevel: YARN.totalLevel(ch, prog), slots: YARN.spellSlots(ch, prog) };
            }"""
        )
        mc2_cases = [
            ("Warlock 5/Sorcerer 3 totals to character level 8", mc2["totalLevel"], 8),
            ("Pact slots (from 5 Warlock levels) + separate full-caster slots (from 3 Sorcerer levels)",
             mc2["slots"], {"slots": [4, 2, 0, 0, 0, 0, 0, 0, 0], "pact": {"count": 2, "level": 3}}),
        ]
        for label, actual, expected in mc2_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        print("\n  -- multiclassing: empty classLevels falls back to single-class, unchanged --")
        fallback = page.evaluate(
            """() => {
                const C = YARN.getCharacter('char_rogue');
                const P = YARN.getProgress('camp_a', 'char_rogue');
                return { classLevelsEmpty: Object.keys(P.classLevels).length === 0,
                         totalLevelMatchesProgLevel: YARN.totalLevel(C, P) === P.level };
            }"""
        )
        fb_cases = [
            ("the level-5 rogue fixture never touched classLevels", fallback["classLevelsEmpty"], True),
            ("totalLevel() falls back to prog.level for single-class characters", fallback["totalLevelMatchesProgLevel"], True),
        ]
        for label, actual, expected in fb_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- feats: origin (free, level 1, from Background) vs general
        # (chosen instead of an ASI, level 4/8/12/16/19 only) --------------
        print("\n  -- feats: Origin feat (Tough) auto-granted by Background, no level gate --")
        tough_case = page.evaluate(
            """() => {
                const full = YARN.normalize({ characters: [{
                    id: 'ft1', name: 'Sodbuster', klass: 'fighter', species: 'human',
                    background: 'Farmer',
                    abilities: { str:10,dex:10,con:14,int:10,wis:10,cha:10 }
                }] });
                const ch = full.characters[0];
                const prog = { level: 1, classLevels: {} };
                return {
                    originFeatKey: YARN.originFeatKey(ch),
                    hpWithFeat: YARN.suggestedHpMax(ch, prog),
                    neverTouchedProgFeats: prog.feats === undefined
                };
            }"""
        )
        tough_cases = [
            ("Farmer's originFeatKey resolves to 'tough'", tough_case["originFeatKey"], "tough"),
            ("HP = 10 (d10) + 2 (CON) + 2 (Tough, x1 level) = 14, at level 1, no ASI gate needed",
             tough_case["hpWithFeat"], 14),
            ("origin feat never touches prog.feats - it's free, not a chosen slot",
             tough_case["neverTouchedProgFeats"], True),
        ]
        for label, actual, expected in tough_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        print("\n  -- feats: General feat (Resilient) chosen at level 4, grants +1 CON and a CON save --")
        resilient_case = page.evaluate(
            """() => {
                const full = YARN.normalize({ characters: [{
                    id: 'ft2', name: 'Grit', klass: 'wizard', species: 'human',
                    background: 'Sage',
                    abilities: { str:10,dex:10,con:10,int:14,wis:10,cha:10 }
                }] });
                const ch = full.characters[0];
                const progNoFeat = { level: 4, classLevels: {}, feats: [], featAbilityChoice: {} };
                const progWithFeat = { level: 4, classLevels: {}, feats: ['resilient'], featAbilityChoice: { resilient: 'con' } };
                return {
                    conBefore: YARN.abilityScore(ch, progNoFeat, 'con'),
                    conAfter: YARN.abilityScore(ch, progWithFeat, 'con'),
                    saveBefore: YARN.saveTotal(ch, progNoFeat, 'con'),
                    saveAfter: YARN.saveTotal(ch, progWithFeat, 'con')
                };
            }"""
        )
        resilient_cases = [
            ("CON is 10 before taking Resilient", resilient_case["conBefore"], 10),
            ("CON is 11 after Resilient (+1, ability choice = con)", resilient_case["conAfter"], 11),
            ("CON save is +0 before Resilient (Wizard isn't con-proficient)", resilient_case["saveBefore"], 0),
            ("CON save is +2 after Resilient (mod 0 -> +1 score bump is 0 rounded, + pb 2 from new proficiency)",
             resilient_case["saveAfter"], 2),
        ]
        for label, actual, expected in resilient_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        print("\n  -- feats: Alert (origin, via Guard background) adds proficiency bonus to initiative --")
        alert_case = page.evaluate(
            """() => {
                const full = YARN.normalize({ characters: [{
                    id: 'ft3', name: 'Watchful', klass: 'fighter', species: 'human',
                    background: 'Guard',
                    abilities: { str:10,dex:14,con:10,int:10,wis:10,cha:10 }
                }] });
                const ch = full.characters[0];
                const prog = { level: 4, classLevels: {} };
                return { initiative: YARN.initiative(ch, prog) };
            }"""
        )
        alert_cases = [
            ("initiative = +2 (DEX mod) + 2 (prof bonus at level 4, from Alert) = 4", alert_case["initiative"], 4),
        ]
        for label, actual, expected in alert_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        print("\n  -- feats: ASI/feat slots are level-gated to 4/8/12/16/19 --")
        slots_case = page.evaluate(
            """() => {
                const ch = { klass: 'fighter', background: 'Soldier' };
                return [1, 3, 4, 7, 8, 19, 20].map(lvl =>
                    YARN.asiSlotsAvailable(ch, { level: lvl, classLevels: {} }));
            }"""
        )
        slots_cases = [
            ("asiSlotsAvailable at levels [1,3,4,7,8,19,20]", slots_case, [0, 0, 1, 1, 2, 5, 5]),
        ]
        for label, actual, expected in slots_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- tool proficiencies + languages: fixed grants vs. "One X"/
        # "of choice" slots the player has to fill in themselves ----------
        print("\n  -- tool tracker: 'One X' background tools need a player pick, literal ones don't --")
        tools_case = page.evaluate(
            """() => {
                const full = YARN.normalize({ characters: [
                    { id: 'tt1', name: 'Watcher', klass: 'fighter', species: 'human',
                      background: 'Guard', toolProfs: ['Dice set'] },
                    { id: 'tt2', name: 'Pathfinder', klass: 'ranger', species: 'human',
                      background: 'Guide' }
                ] });
                const guard = full.characters[0], guide = full.characters[1];
                return {
                    guardFixed: YARN.backgroundToolProfs(guard),
                    guardSlots: YARN.toolChoiceSlots(guard),
                    guardAll: YARN.allToolProfs(guard),
                    guideFixed: YARN.backgroundToolProfs(guide),
                    guideSlots: YARN.toolChoiceSlots(guide),
                    guideAll: YARN.allToolProfs(guide)
                };
            }"""
        )
        tools_cases = [
            ("Guard ('One gaming set') has zero FIXED tools", tools_case["guardFixed"], []),
            ("Guard has exactly 1 tool-choice slot", tools_case["guardSlots"], 1),
            ("Guard's allToolProfs is just the player's chosen 'Dice set'", tools_case["guardAll"], ["Dice set"]),
            ("Guide ('Cartographer's tools') has it as a FIXED grant", tools_case["guideFixed"], ["Cartographer's tools"]),
            ("Guide has zero tool-choice slots (nothing to pick)", tools_case["guideSlots"], 0),
            ("Guide's allToolProfs is just the fixed grant", tools_case["guideAll"], ["Cartographer's tools"]),
        ]
        for label, actual, expected in tools_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        print("\n  -- language tracker: species 'of choice' slots + background's bonus-language count --")
        langs_case = page.evaluate(
            """() => {
                const full = YARN.normalize({ characters: [{
                    id: 'tl1', name: 'Scholar', species: 'human', klass: 'wizard',
                    background: 'Sage', languages: ['Draconic']
                }] });
                const ch = full.characters[0];
                return {
                    fixed: YARN.speciesFixedLanguages(ch),
                    slots: YARN.languageChoiceSlots(ch),
                    all: YARN.allLanguages(ch)
                };
            }"""
        )
        langs_cases = [
            ("Human's FIXED language is just Common ('one language of choice' filtered out)",
             langs_case["fixed"], ["Common"]),
            ("slots = 1 (Human's own choice) + 2 (Sage's bonus languages) = 3", langs_case["slots"], 3),
            ("allLanguages = fixed Common + the player's chosen Draconic", langs_case["all"], ["Common", "Draconic"]),
        ]
        for label, actual, expected in langs_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        browser.close()

    print("")
    if failures:
        print("test_rules.py FAILED (" + str(len(failures)) + "): " + ", ".join(failures))
        return 1
    print("test_rules.py PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
