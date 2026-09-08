"""test_wizard.py - proves the creation wizard's pure guts and the clone flow.

Covers the deterministic dice roller (seeded RNG), point-buy math, the random
name generator, character cloning (deep copy + homebrew fork), and the wizard
state machine's score assembly. Runs the real modules in a real browser so we
exercise the exact code the app ships - no Python reimplementation of the math.

    .venv\\Scripts\\python -u test_wizard.py
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
MODULES = ["app.rules.js", "app.species.js", "app.core.js", "app.wizard.js"]


def main() -> int:
    src = "\n".join((HERE / m).read_text(encoding="utf-8") for m in MODULES)
    failures = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="msedge")
        page = browser.new_page()
        page.goto("about:blank")
        page.add_script_tag(content=src)

        def check(label, expr, expected):
            actual = page.evaluate("() => " + expr)
            ok = actual == expected
            print(("  PASS " if ok else "  FAIL ") + label +
                  " expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- deterministic dice ----------------------------------------
        print("  -- dice (seeded rng) --")
        # rng=0 -> die=1 ; rng=0.999 -> die=6
        check("rollDie rng0 -> 1", "YARN.rollDie(6, () => 0)", 1)
        check("rollDie rng.999 -> 6", "YARN.rollDie(6, () => 0.999)", 6)
        # 4d6 with [1,6,6,6]: drop the 1, total 18
        check("4d6 drop lowest total 18",
              "(() => { const s=[0,0.999,0.999,0.999]; let i=0; "
              "return YARN.roll4d6DropLowest(() => s[i++]).total; })()", 18)
        check("4d6 dropped is 1",
              "(() => { const s=[0,0.999,0.999,0.999]; let i=0; "
              "return YARN.roll4d6DropLowest(() => s[i++]).dropped; })()", 1)
        check("rollAbilitySet returns 6",
              "YARN.rollAbilitySet(() => 0.5).length", 6)

        # ---- point buy --------------------------------------------------
        print("\n  -- point buy --")
        check("cost of 15 is 9", "YARN.pointBuyCostFor(15)", 9)
        check("cost of 14 is 7", "YARN.pointBuyCostFor(14)", 7)
        check("cost of 8 is 0", "YARN.pointBuyCostFor(8)", 0)
        check("cost of 16 is Infinity", "YARN.pointBuyCostFor(16) === Infinity", True)
        check("all 8s -> 27 remaining",
              "YARN.pointBuyRemaining({str:8,dex:8,con:8,int:8,wis:8,cha:8})", 27)
        check("15/15/15/8/8/8 spends exactly 27",
              "YARN.pointBuySpent({str:15,dex:15,con:15,int:8,wis:8,cha:8})", 27)
        check("15/15/15/8/8/8 is valid",
              "YARN.pointBuyValid({str:15,dex:15,con:15,int:8,wis:8,cha:8})", True)
        check("all 13s (cost 30) is invalid",
              "YARN.pointBuyValid({str:13,dex:13,con:13,int:13,wis:13,cha:13})", False)

        # ---- random name ------------------------------------------------
        print("\n  -- random name --")
        # rng=0 picks the first prefix + first suffix
        check("random name is deterministic", "YARN.randomName(() => 0)", "Aerade")

        # ---- clone ------------------------------------------------------
        print("\n  -- clone / homebrew fork --")
        page.evaluate(
            """() => {
                YARN.state = YARN.normalize({
                    characters: [{id: 'src', name: 'Kaelen', klass: 'rogue',
                                  abilities: {str:8, dex:16, con:12, int:14, wis:10, cha:12}}],
                    campaigns: []
                });
                window.CLONE = YARN.cloneAsHomebrew('src');
                window.SRC = YARN.getCharacter('src');
            }"""
        )
        check("clone got a new id", "CLONE.id !== 'src'", True)
        check("clone name suffixed", "CLONE.name", "Kaelen (Homebrew)")
        check("clone homebrew enabled", "CLONE.homebrew.enabled", True)
        check("original name untouched", "SRC.name", "Kaelen")
        check("original still standard", "SRC.homebrew.enabled", False)
        check("clone pushed to state", "YARN.state.characters.length", 2)
        # deep copy: mutating the clone must not bleed into the source
        page.evaluate("() => { CLONE.abilities.dex = 20; }")
        check("clone is a deep copy", "SRC.abilities.dex", 16)

        # ---- wizard state machine --------------------------------------
        print("\n  -- wizard assembly --")
        page.evaluate(
            """() => {
                YARN.state = YARN.normalize({characters: [], campaigns: []});
                YARN.Wizard.open({ onCreate: (c) => { window.MADE = c; } });
                const S = YARN.Wizard._debug.state();
                S.step = 4;              // the abilities step
                S.method = 'standard';
                S.klass = 'wizard';
                S.species = 'elf';       // +2 DEX
                S.background = 'Sage';
                S.mode = 'homebrew';
                S.name = 'Testina';
                S.pool = [15, 14, 13, 12, 10, 8];
                S.assign = {str: 5, dex: 0, con: 2, int: 1, wis: 3, cha: 4};
            }"""
        )
        check("pool fully assigned", "YARN.Wizard._debug.poolFullyAssigned()", True)
        check("can advance when assigned", "YARN.Wizard._debug.canAdvance()", True)
        # base scores follow the assignment (pre-species)
        check("base str = 8 (slot 5)", "YARN.Wizard._debug.baseScores().str", 8)
        check("base dex = 15 (slot 0)", "YARN.Wizard._debug.baseScores().dex", 15)
        check("base int = 14 (slot 1)", "YARN.Wizard._debug.baseScores().int", 14)
        # built character carries the choices
        check("built char is homebrew",
              "YARN.Wizard._debug.buildCharacter().homebrew.enabled", True)
        check("built char klass", "YARN.Wizard._debug.buildCharacter().klass", "wizard")
        check("built char name", "YARN.Wizard._debug.buildCharacter().name", "Testina")
        # species ASI is gone under 2024 rules - elf dex 15 base stays 15.
        check("2024 rules: elf gets no species dex bonus",
              "(() => { const c = YARN.Wizard._debug.buildCharacter(); "
              "return YARN.abilityScore(c, YARN.blankProgress(), 'dex'); })()", 15)
        # the Background ASI picker is what actually adds a bonus now.
        page.evaluate("() => { const S = YARN.Wizard._debug.state(); S.bgAsi.int = 2; S.bgAsi.wis = 1; }")
        check("Sage background ASI (+2 INT) lands on the built character",
              "(() => { const c = YARN.Wizard._debug.buildCharacter(); "
              "return YARN.abilityScore(c, YARN.blankProgress(), 'int'); })()", 16)
        # a missing assignment blocks advancement
        page.evaluate("() => { YARN.Wizard._debug.state().assign.cha = null; }")
        check("incomplete pool blocks Next",
              "YARN.Wizard._debug.poolFullyAssigned()", False)
        # duplicate slot also blocks
        page.evaluate("() => { const S = YARN.Wizard._debug.state(); "
                      "S.assign.cha = 0; S.assign.dex = 0; }")
        check("duplicate slot blocks Next",
              "YARN.Wizard._debug.poolFullyAssigned()", False)
        YARN_close = page.evaluate("() => { YARN.Wizard.close(); return YARN.Wizard._debug.state(); }")
        check("close tears down state", "YARN.Wizard._debug.state()", None)

        # ---- suggested-array data sanity --------------------------------
        print("\n  -- suggested array --")
        check("wizard suggests DEX 15 for rogue",
              "YARN.SUGGESTED_ARRAY.rogue.dex", 15)
        check("standard array is the classic six",
              "YARN.STANDARD_ARRAY.join(',')", "15,14,13,12,10,8")

        # ---- 2024 background ASI (replaces the old species-ASI model) ----
        print("\n  -- background ASI (2024 rules) --")
        check("Sage offers int/wis/con as candidates",
              "JSON.stringify(YARN.backgroundAbilityChoices('Sage'))", '["int","wis","con"]')
        check("unknown background offers nothing",
              "JSON.stringify(YARN.backgroundAbilityChoices('Nonsense'))", "[]")
        check("2/1 split (int+2, wis+1) is valid",
              "YARN.backgroundAsiValid({str:0,dex:0,con:0,int:2,wis:1,cha:0})", True)
        check("1/1/1 spread (int+1,wis+1,con+1) is valid",
              "YARN.backgroundAsiValid({str:0,dex:0,con:1,int:1,wis:1,cha:0})", True)
        check("only 2 points spent is invalid (must total exactly 3)",
              "YARN.backgroundAsiValid({str:0,dex:0,con:0,int:2,wis:0,cha:0})", False)
        check("+3 to one ability is invalid (cap is +2)",
              "YARN.backgroundAsiValid({str:0,dex:0,con:0,int:3,wis:0,cha:0})", False)
        check("backgroundAsiSpent sums correctly",
              "YARN.backgroundAsiSpent({str:0,dex:0,con:1,int:1,wis:1,cha:0})", 3)

        page.evaluate(
            """() => {
                YARN.state = YARN.normalize({characters: [], campaigns: []});
                YARN.Wizard.open({ onCreate: () => {} });
                const S = YARN.Wizard._debug.state();
                S.step = 3;              // the background step
                S.background = 'Sage';
            }"""
        )
        check("background step blocks Next until 3 points are spent",
              "YARN.Wizard._debug.canAdvance()", False)
        page.evaluate("() => { const S = YARN.Wizard._debug.state(); S.bgAsi.int = 2; S.bgAsi.wis = 1; }")
        check("background step allows Next once exactly 3 are spent",
              "YARN.Wizard._debug.canAdvance()", True)
        # picking a new background wipes the prior allocation - covered in the e2e suite
        page.evaluate("() => { YARN.Wizard.close(); }")

        browser.close()

    print("")
    if failures:
        print("test_wizard.py FAILED (" + str(len(failures)) + "): " + ", ".join(failures))
        return 1
    print("test_wizard.py PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
