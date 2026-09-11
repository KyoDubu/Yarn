"""test_wizard_e2e.py - full click-through of the creation wizard in the real app.

Loads the actual yarn.html (all modules, real DOM, real event wiring) and drives
the wizard the way a human would: open it, walk every step, auto-assign the
standard array, create the character, then confirm it lands on the sheet. Also
exercises the "Homebrew copy" clone button from the top bar.

    .venv\\Scripts\\python -u test_wizard_e2e.py
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
URL = (HERE / "yarn.html").as_uri()


def main() -> int:
    failures = []

    def check(label, cond):
        print(("  PASS " if cond else "  FAIL ") + label)
        if not cond:
            failures.append(label)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="msedge")
        page = browser.new_page()

        # One persistent FIFO dialog handler for the whole test, rather than
        # a fresh listener per action. Playwright doesn't route dialogs to
        # "the next once() in line" - EVERY currently-registered listener
        # gets called for EACH dialog, so two pre-registered once() handlers
        # both fire on the very first dialog and the second crashes trying
        # to accept an already-handled one. A single shared queue, popped
        # FIFO as dialogs actually occur, is the correct way to answer a
        # sequence of window.prompt()/confirm() calls.
        dialog_answers = []
        page.on("dialog", lambda d: d.accept(dialog_answers.pop(0) if dialog_answers else ""))
        # start from a clean slate so the roster is empty
        page.goto(URL)
        page.evaluate("() => { localStorage.clear(); }")
        page.reload()

        print("  -- create a Homebrew character via the wizard --")
        page.click('[data-action="new-char"]')
        check("wizard overlay opened", page.query_selector(".wz-overlay") is not None)

        # Step 1: mode -> Homebrew
        page.click('[data-wz="pick:mode:homebrew"]')
        page.click('[data-wz="next"]')
        # Step 2: class -> ranger
        page.click('[data-wz="pick:klass:ranger"]')
        page.click('[data-wz="next"]')
        # Step 3: species -> elf, then its Shadar-Kai subrace (fitting, for Marei)
        page.click('[data-wz="pick:species:elf"]')
        check("subrace popup auto-opens for a species with subraces", page.query_selector(".wz-submodal") is not None)
        next_btn = page.query_selector('[data-wz="next"]')
        check("Next disabled before picking a subrace", next_btn.get_attribute("disabled") is not None)
        page.click('[data-wz="pick:subspecies:shadarKai"]')
        check("subrace popup auto-closes once a subrace is picked", page.query_selector(".wz-submodal") is None)
        next_btn = page.query_selector('[data-wz="next"]')
        check("Next enabled after picking a subrace", next_btn.get_attribute("disabled") is None)
        page.click('[data-wz="open-subrace"]')
        check("Change subrace reopens the popup", page.query_selector(".wz-submodal") is not None)
        page.click('[data-wz="close-subrace"]')
        check("Done button closes the popup", page.query_selector(".wz-submodal") is None)
        page.click('[data-wz="next"]')
        # Step 4: background -> Outlander, then spend its 2024 ASI (str+2, wis+1)
        page.click('[data-wz="pick:background:Outlander"]')
        next_btn = page.query_selector('[data-wz="next"]')
        check("Next disabled before spending the background's ability points",
              next_btn.get_attribute("disabled") is not None)
        page.click('[data-wz="bgasi:str:1"]')
        page.click('[data-wz="bgasi:str:1"]')
        page.click('[data-wz="bgasi:wis:1"]')
        next_btn = page.query_selector('[data-wz="next"]')
        check("Next enabled once exactly 3 background points are spent",
              next_btn.get_attribute("disabled") is None)
        page.click('[data-wz="next"]')
        # Step 5: abilities -> auto-assign standard array for the class
        next_btn = page.query_selector('[data-wz="next"]')
        check("Next disabled before assigning scores", next_btn.get_attribute("disabled") is not None)
        page.click('[data-wz="method:standard"]')
        page.click('[data-wz="suggest"]')
        next_btn = page.query_selector('[data-wz="next"]')
        check("Next enabled after auto-assign", next_btn.get_attribute("disabled") is None)
        page.click('[data-wz="next"]')
        # Step 6: details -> name it
        page.fill('[data-wz="name"]', "Marei")
        page.click('[data-wz="next"]')
        # Step 7: review -> create
        check("review shows the name", "Marei" in page.inner_text(".wz-modal"))
        page.click('[data-wz="create"]')

        check("wizard closed after create", page.query_selector(".wz-overlay") is None)

        made = page.evaluate("() => YARN.getCharacter(YARN.state.ui.activeCharId)")
        check("character was created", made is not None)
        check("name is Marei", made and made["name"] == "Marei")
        check("class is ranger", made and made["klass"] == "ranger")
        check("species is elf", made and made["species"] == "elf")
        check("subspecies is shadarKai", made and made["subspecies"] == "shadarKai")
        check("homebrew is on", made and made["homebrew"]["enabled"] is True)
        # 2024 rules: species contributes nothing - ranger's suggested DEX 15 stays 15.
        dex = page.evaluate("() => YARN.abilityScore(YARN.getCharacter(YARN.state.ui.activeCharId), "
                            "YARN.blankProgress(), 'dex')")
        check("elf ranger DEX stays at the suggested 15 (no species bonus)", dex == 15)
        # ...but the Outlander background ASI we spent (str+2, wis+1) does land.
        str_score = page.evaluate("() => YARN.abilityScore(YARN.getCharacter(YARN.state.ui.activeCharId), "
                                  "YARN.blankProgress(), 'str')")
        wis = page.evaluate("() => YARN.abilityScore(YARN.getCharacter(YARN.state.ui.activeCharId), "
                            "YARN.blankProgress(), 'wis')")
        suggested_str = page.evaluate("() => YARN.SUGGESTED_ARRAY.ranger.str")
        suggested_wis = page.evaluate("() => YARN.SUGGESTED_ARRAY.ranger.wis")
        check("Outlander background ASI (+2 STR) landed on the built character", str_score == suggested_str + 2)
        check("Outlander background ASI (+1 WIS) landed on the built character", wis == suggested_wis + 1)

        print("\n  -- clone an existing character into a homebrew copy --")
        # make a plain standard character directly, select it, then clone
        page.evaluate(
            """() => {
                const c = YARN.blankCharacter();
                c.name = 'Standard Sam';
                c.homebrew.enabled = false;
                YARN.state.characters.push(c);
                YARN.state.ui.activeCharId = c.id;
                YARN.save();
                YARN.UI.render();
            }"""
        )
        page.click('[data-action="clone-homebrew"]')
        result = page.evaluate(
            """() => {
                const names = YARN.state.characters.map(c => c.name);
                const active = YARN.getCharacter(YARN.state.ui.activeCharId);
                const sam = YARN.state.characters.find(c => c.name === 'Standard Sam');
                return {
                    hasCopy: names.indexOf('Standard Sam (Homebrew)') !== -1,
                    activeIsCopy: active.name === 'Standard Sam (Homebrew)',
                    activeHomebrew: active.homebrew.enabled,
                    originalUntouched: sam.homebrew.enabled === false,
                    count: YARN.state.characters.length
                };
            }"""
        )
        check("homebrew copy exists", result["hasCopy"])
        check("active char is the copy", result["activeIsCopy"])
        check("copy has homebrew on", result["activeHomebrew"] is True)
        check("original stays standard", result["originalUntouched"])

        print("\n  -- sheet's species/subspecies dropdown + traits panel --")
        # The active character is now the homebrew clone of a plain Human, but
        # it has no campaign yet - give it one so the sheet (not the empty
        # "needs a campaign" state) actually renders.
        page.evaluate(
            """() => {
                const camp = YARN.blankCampaign();
                camp.name = 'Test Campaign';
                YARN.state.campaigns.push(camp);
                YARN.state.ui.activeCampaignId = camp.id;
                YARN.getProgress(camp.id, YARN.state.ui.activeCharId);
                YARN.save();
                YARN.UI.render();
            }"""
        )
        page.select_option('select[data-model="char.species"]', "dwarf")
        traits_text_before = page.inner_text(".wrap")
        check("no subrace picked yet -> traits panel shows base Dwarf only",
              "Darkvision 60 ft" in traits_text_before and "Dwarven Toughness" not in traits_text_before)
        page.select_option('select[data-model="char.subspecies"]', "hill")
        traits_text_after = page.inner_text(".wrap")
        check("picking Hill subrace updates the traits panel",
              "Dwarven Toughness: +1 HP per level" in traits_text_after)
        wis_mod = page.evaluate(
            "() => { const c = YARN.getCharacter(YARN.state.ui.activeCharId); "
            "return YARN.speciesASI(c).wis; }"
        )
        check("Hill Dwarf's 2014-reference data still reports +1 WIS (historical only, not applied to the score)",
              wis_mod == 1)
        # switching species back to Human should blank the stale subspecies
        page.select_option('select[data-model="char.species"]', "human")
        sub_after_switch = page.evaluate(
            "() => YARN.getCharacter(YARN.state.ui.activeCharId).subspecies"
        )
        check("switching species clears the stale subspecies", sub_after_switch == "")

        print("\n  -- sheet's Background ability-bonus picker (2024 rules) --")
        # Give the character a background with known candidates and drive its
        # 3 numeric inputs directly, same generic data-model binding as any
        # other sheet field.
        page.select_option('select[data-model="char.background"]', "Sage")
        page.fill('input[data-model="char.backgroundAsi.int"]', "2")
        page.fill('input[data-model="char.backgroundAsi.wis"]', "1")
        int_score = page.evaluate(
            "() => YARN.abilityScore(YARN.getCharacter(YARN.state.ui.activeCharId), null, 'int')"
        )
        check("Sage's +2 INT (typed on the sheet) lands on the ability score", int_score == 12)
        # switching to a different background should wipe the stale allocation
        page.select_option('select[data-model="char.background"]', "Soldier")
        int_after_switch = page.evaluate(
            "() => YARN.getCharacter(YARN.state.ui.activeCharId).backgroundAsi.int"
        )
        check("switching background clears the stale ability allocation", int_after_switch == 0)

        print("\n  -- sheet's Background panel handles the new 2024-only backgrounds too --")
        # Guide is one of the 7 newly-added 2024 PHB backgrounds - it has an
        # originFeat, not a 2014-style feature, and the panel must render
        # accordingly (real UI check, not just the underlying data lookup).
        page.select_option('select[data-model="char.background"]', "Guide")
        panel_text = page.inner_text(".wrap")
        check("Guide's origin feat renders on the sheet", "Magic Initiate (Druid)" in panel_text)
        check("Guide's granted skills render on the sheet", "Stealth" in panel_text and "Survival" in panel_text)

        print("\n  -- sheet's Classes panel: real multiclassing, driven through the UI --")
        page.select_option('select[data-model="char.klass"]', "fighter")
        page.fill('input[data-model="prog.level"]', "3")
        single_class_text = page.inner_text(".wrap")
        check("single-classed state shows the '+ Multiclass' prompt", "+ Multiclass" in single_class_text)

        # "+ Multiclass" triggers two real window.prompt() dialogs (which
        # class, how many levels) - answer them the way a player would.
        dialog_answers.extend(["wizard", "2"])
        page.click('[data-action="add-class"]')

        multi_text = page.inner_text(".wrap")
        check("Classes panel now lists both Fighter and Wizard", "Fighter" in multi_text and "Wizard" in multi_text)
        check("total level combines to 5 (3 Fighter + 2 Wizard)", "total level 5" in multi_text)
        level_input_disabled = page.eval_on_selector(
            'div.panel.span-2 input[type="number"][disabled]', "el => el.value"
        )
        check("the plain Level field becomes a computed, disabled 5 once multiclassed", level_input_disabled == "5")
        prof_bonus_text = page.inner_text('[data-out="profBonus"]')
        check("Prof. Bonus tile reflects the COMBINED level (+3 at total level 5)", prof_bonus_text == "+3")

        page.click('[data-action="revert-multiclass"]')
        reverted_text = page.inner_text(".wrap")
        check("reverting drops back to the plain single-class Level field", "+ Multiclass" in reverted_text)
        level_after_revert = page.eval_on_selector('input[data-model="prog.level"]', "el => el.value")
        check("reverting preserves the total (5) rather than losing it", level_after_revert == "5")

        print("\n  -- sheet's Feats panel: real general feat, driven through the UI --")
        # Character is level 5 here (from the multiclass section above), well
        # past the level-4 ASI gate. Tough is deliberately NOT pickable here -
        # it's an Origin feat (only auto-granted by Background), so use a
        # real General feat instead: Resilient, which needs a second dialog
        # for its ability choice.
        con_before = page.inner_text('[data-out="score.con"]')
        dialog_answers.extend(["resilient", "con"])
        page.click('[data-action="add-feat"]')

        feats_text = page.inner_text(".wrap")
        check("Feats panel now lists Resilient", "Resilient" in feats_text)
        con_after = page.inner_text('[data-out="score.con"]')
        check("Resilient(CON) bumps the CON score tile by +1", int(con_after) - int(con_before) == 1)
        # Save-proficiency stacking from Resilient is precisely covered at
        # the math level in test_rules.py (Wizard, not already CON-proficient);
        # this e2e character is a Fighter, whose class already grants a CON
        # save, so asserting a visible save-tile CHANGE here would be
        # asserting the wrong thing for this particular character.

        page.click('[data-action="del-feat:resilient"]')
        con_removed = page.inner_text('[data-out="score.con"]')
        check("removing the feat drops the CON score back down", con_removed == con_before)

        browser.close()

    print("")
    if failures:
        print("test_wizard_e2e.py FAILED (" + str(len(failures)) + "): " + ", ".join(failures))
        return 1
    print("test_wizard_e2e.py PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
