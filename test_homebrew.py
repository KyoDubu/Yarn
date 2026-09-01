"""test_homebrew.py - proves the opt-in homebrew layer is truly additive.

Standard SRD math must be untouched when homebrew is off; when it's on,
custom skills compute exactly like SRD skills and extra currency / resource
state round-trips through normalize(). Runs the real modules in a real
browser - no reimplementation of the math in Python.

    .venv\\Scripts\\python -u test_homebrew.py
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
MODULES = ["app.rules.js", "app.core.js"]

# Marei-ish: a Shadar-Kai (NOT in the SRD species table) Ranger. Unknown
# species must degrade gracefully - base scores, no ancestry ASI.
#   STR 12 -> +1, DEX 19 -> +4, CON 16 -> +3, WIS 18 -> +4
#   Level 5 -> prof bonus +3
#   Custom skills: Fisticuffs (str), Endurance (con), Lore (int)
MAREI = {
    "id": "char_marei",
    "name": "Marei",
    "species": "shadarkai",     # deliberately unknown to the SRD table
    "klass": "ranger",
    "background": "Outlander",
    "abilities": {"str": 12, "dex": 19, "con": 16, "int": 15, "wis": 18, "cha": 11},
    "saveProfs": [],
    "skillProfs": ["stealth", "fisticuffs"],   # one SRD, one homebrew
    "skillExpertise": [],
    "homebrew": {
        "enabled": True,
        "customSkills": [
            {"key": "fisticuffs", "name": "Fisticuffs", "ability": "str"},
            {"key": "endurance", "name": "Endurance", "ability": "con"},
            {"key": "lore", "name": "Lore", "ability": "int"},
        ],
        "currencies": [{"key": "mp", "name": "MP"}],
        "resources": [{"key": "bardic_inspiration", "name": "Bardic Inspiration"}],
    },
}


def main() -> int:
    src = "\n".join((HERE / m).read_text(encoding="utf-8") for m in MODULES)
    failures = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="msedge")
        page = browser.new_page()
        page.goto("about:blank")
        page.add_script_tag(content=src)

        page.evaluate(
            """(marei) => {
                YARN.state = YARN.normalize({
                    characters: [marei],
                    campaigns: [{id: 'camp_a', name: 'Curse of Strahd'}]
                });
                const p = YARN.getProgress('camp_a', marei.id);
                p.level = 5;
                p.armorWorn = 'studded';
                p.currencyExtra = {mp: 7};
                p.resourcesUsed = {bardic_inspiration: {current: 2, max: 4}};
                window.C = YARN.getCharacter(marei.id);
                window.P = p;
            }""",
            MAREI,
        )

        # ---- homebrew ON: custom skills compute like SRD skills ----
        print("  -- homebrew enabled --")
        cases = [
            # unknown species -> no ASI, base score straight through
            ("unknown species dex stays 19", "YARN.abilityScore(C, P, 'dex')", 19),
            ("dex mod +4", "YARN.abilityMod(C, P, 'dex')", 4),
            # custom str skill, proficient: +1 (str) + 3 (pb) = +4
            ("fisticuffs prof +4", "YARN.skillTotal(C, P, 'fisticuffs')", 4),
            # custom con skill, not proficient: just +3
            ("endurance untrained +3", "YARN.skillTotal(C, P, 'endurance')", 3),
            # custom int skill, not proficient: +2
            ("lore untrained +2", "YARN.skillTotal(C, P, 'lore')", 2),
            # SRD skill still correct alongside homebrew ones
            ("stealth prof +7", "YARN.skillTotal(C, P, 'stealth')", 7),
            # skillsFor merges SRD (18) + 3 custom = 21
            ("skillsFor has 21", "YARN.skillsFor(C).length", 21),
            ("skillInfoFor finds custom", "YARN.skillInfoFor(C, 'lore').ability", "int"),
            # derived bundle exposes custom skills too
            ("derived includes fisticuffs", "YARN.derived(C, P).skills.fisticuffs", 4),
            # ranger is a half-caster (wis): DC 8 + 3 + 4 = 15
            ("ranger spell DC 15", "YARN.spellSaveDC(C, P)", 15),
        ]
        for label, expr, expected in cases:
            actual = page.evaluate("() => " + expr)
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- homebrew OFF: custom skills vanish, SRD math unchanged ----
        print("\n  -- homebrew disabled (additive, not destructive) --")
        off = page.evaluate(
            """() => {
                C.homebrew.enabled = false;
                return {
                    skillCount: YARN.skillsFor(C).length,
                    fisticuffsInfo: YARN.skillInfoFor(C, 'fisticuffs'),
                    fisticuffsTotal: YARN.skillTotal(C, P, 'fisticuffs'),
                    stealthTotal: YARN.skillTotal(C, P, 'stealth'),
                    derivedHasFisticuffs: 'fisticuffs' in YARN.derived(C, P).skills
                };
            }"""
        )
        off_cases = [
            ("only 18 SRD skills", off["skillCount"], 18),
            ("custom skill info gone", off["fisticuffsInfo"], None),
            ("custom skill total 0", off["fisticuffsTotal"], 0),
            ("SRD stealth still +7", off["stealthTotal"], 7),
            ("derived drops custom skill", off["derivedHasFisticuffs"], False),
        ]
        for label, actual, expected in off_cases:
            ok = actual == expected
            print(("  PASS  " if ok else "  FAIL  ") + label
                  + "  expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- normalize round-trips the homebrew state ----
        print("\n  -- normalize / backward compat --")
        norm = page.evaluate(
            """() => {
                // Old save with NO homebrew block at all must not crash.
                const legacy = YARN.normalize({
                    characters: [{id: 'c1', name: 'Legacy'}],
                    campaigns: [{id: 'k1', name: 'Game'}],
                    progress: {k1: {c1: {level: 1}}}
                });
                // Save WITH homebrew + extra state must be preserved.
                const kept = YARN.normalize({
                    characters: [{id: 'c2', name: 'Homebrewer',
                        homebrew: {enabled: true, currencies: [{key: 'mp', name: 'MP'}]}}],
                    campaigns: [{id: 'k1', name: 'Game'}],
                    progress: {k1: {c2: {level: 3, currencyExtra: {mp: 9},
                        resourcesUsed: {rage: {current: 1, max: 3}}}}}
                });
                return {
                    legacyHomebrewOff: legacy.characters[0].homebrew.enabled,
                    legacyCustomSkillsArray: Array.isArray(legacy.characters[0].homebrew.customSkills),
                    legacyCurrencyExtra: typeof legacy.progress.k1.c1.currencyExtra,
                    keptEnabled: kept.characters[0].homebrew.enabled,
                    keptMp: kept.progress.k1.c2.currencyExtra.mp,
                    keptRage: kept.progress.k1.c2.resourcesUsed.rage.max
                };
            }"""
        )
        norm_cases = [
            ("legacy homebrew defaults off", norm["legacyHomebrewOff"], False),
            ("legacy customSkills is array", norm["legacyCustomSkillsArray"], True),
            ("legacy currencyExtra is object", norm["legacyCurrencyExtra"], "object"),
            ("kept homebrew enabled", norm["keptEnabled"], True),
            ("kept MP balance 9", norm["keptMp"], 9),
            ("kept resource max 3", norm["keptRage"], 3),
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
        print("test_homebrew.py FAILED (" + str(len(failures)) + "): " + ", ".join(failures))
        return 1
    print("test_homebrew.py PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
