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
#   DEX 16 base + 2 elf = 18 -> +4 mod
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
    ("elf dex 16 -> 18", "YARN.abilityScore(C, P, 'dex')", 18),
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

        browser.close()

    print("")
    if failures:
        print("test_rules.py FAILED (" + str(len(failures)) + "): " + ", ".join(failures))
        return 1
    print("test_rules.py PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
