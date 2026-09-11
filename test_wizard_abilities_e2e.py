"""test_wizard_abilities_e2e.py - e2e coverage for the "Determine Ability
Scores" step: standard-array duplicate-slot guard, point-buy SRD boundary
clamping, and the dice-roll animation.

Split out from test_wizard_e2e.py to keep each e2e file focused on one
concern rather than growing one mega-file (same "own file per big domain"
philosophy as app.species.js getting split out of app.rules.js).

    .venv\\Scripts\\python -u test_wizard_abilities_e2e.py
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

    def open_wizard_to_abilities(page):
        page.click('[data-action="new-char"]')
        page.click('[data-wz="concept-pick:custom"]')
        page.click('[data-wz="next"]')
        page.click('[data-wz="pick:mode:standard"]')
        page.click('[data-wz="next"]')
        page.click('[data-wz="pick:klass:fighter"]')
        page.click('[data-wz="next"]')
        page.click('[data-wz="pick:species:halfOrc"]')  # no subraces, no popup detour
        page.click('[data-wz="next"]')
        page.click('[data-wz="pick:background:Folk Hero"]')
        # Folk Hero's 2024 ASI candidates are wis/str/con - spend the mandatory 3 points
        # (wis+2, str+1) so "Next" actually unlocks.
        page.click('[data-wz="bgasi:wis:1"]')
        page.click('[data-wz="bgasi:wis:1"]')
        page.click('[data-wz="bgasi:str:1"]')
        page.click('[data-wz="next"]')

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="msedge")
        page = browser.new_page()
        page.goto(URL)
        page.evaluate("() => { localStorage.clear(); }")
        page.reload()

        print("  -- standard array: duplicate-slot guard --")
        open_wizard_to_abilities(page)
        page.click('[data-wz="method:standard"]')
        page.select_option('select[data-wz="assign:str"]', "0")
        dex_opt0 = page.query_selector('select[data-wz="assign:dex"] option[value="0"]')
        check("slot claimed by STR shows disabled in DEX's dropdown",
              dex_opt0.get_attribute("disabled") is not None)
        str_opt0 = page.query_selector('select[data-wz="assign:str"] option[value="0"]')
        check("STR's own chosen slot stays enabled in its own dropdown",
              str_opt0.get_attribute("disabled") is None)
        # every other ability picks a distinct slot -> Next should enable
        for i, k in enumerate(["dex", "con", "int", "wis", "cha"], start=1):
            page.select_option(f'select[data-wz="assign:{k}"]', str(i))
        next_btn = page.query_selector('[data-wz="next"]')
        check("Next enables once all six slots are distinct",
              next_btn.get_attribute("disabled") is None)

        print("\n  -- point buy: stops dead at the SRD boundaries --")
        page.click('[data-wz="method:pointbuy"]')
        minus_btn = page.query_selector('[data-wz="buy:str:-1"]')
        check("decrease disabled at the floor (8)", minus_btn.get_attribute("disabled") is not None)
        plus_btn = None
        for _ in range(10):  # far more clicks than needed to hit 15 or run out of budget
            plus_btn = page.query_selector('[data-wz="buy:str:1"]')
            if plus_btn.get_attribute("disabled") is not None:
                break
            plus_btn.click()
        str_val = page.inner_text(".wz-abilities tbody tr:nth-child(1) .wz-buyval")
        check("point buy STR stops at 15", str_val == "15")
        check("increase button disabled once at the cap",
              page.query_selector('[data-wz="buy:str:1"]').get_attribute("disabled") is not None)

        print("\n  -- dice roll: animation plays then lands on a real result --")
        page.click('[data-wz="method:roll"]')
        page.click('[data-wz="roll-all"]')
        check("roll button disables itself mid-animation",
              page.query_selector('[data-wz="roll-all"]').get_attribute("disabled") is not None)
        check("pool chips get the tumbling class while rolling",
              page.query_selector(".wz-chip.tumbling") is not None)
        page.wait_for_selector('[data-wz="roll-all"]:not([disabled])', timeout=3000)
        check("roll button re-enables once the animation lands",
              page.query_selector('[data-wz="roll-all"]').get_attribute("disabled") is None)
        check("tumbling class is gone once landed",
              page.query_selector(".wz-chip.tumbling") is None)
        pool_after = page.evaluate(
            "() => Array.from(document.querySelectorAll('.wz-pool-inputs input')).map(i => i.value)"
        )
        check("landed pool has 6 real values in range 3-18",
              len(pool_after) == 6 and all(3 <= int(v) <= 18 for v in pool_after))

        page.click('[data-wz="cancel"]')
        check("wizard closes cleanly after a roll (no leaked timer errors)",
              page.query_selector(".wz-overlay") is None)

        print("\n  -- regression: opening a <select> must not wipe it (locked dropdown bug) --")
        # A real mouse click opens a native <select>'s dropdown BEFORE any
        # option is chosen - the browser fires a plain "click" on the select
        # itself at that moment, with no "change" yet. The wizard's overlay
        # click-delegate used to treat that click as "assign this ability",
        # which re-rendered the whole modal (innerHTML swap) and destroyed
        # the still-open dropdown out from under the browser - every
        # ability-score select looked permanently locked. This reproduces
        # exactly that click, with no accompanying "change" event.
        open_wizard_to_abilities(page)
        page.click('[data-wz="method:standard"]')
        sel = page.query_selector('select[data-wz="assign:str"]')
        page.evaluate("(el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))", sel)
        same_node = page.evaluate(
            "(el) => document.querySelector('select[data-wz=\"assign:str\"]') === el", sel)
        check("select survives a bare open-click - no premature re-render", same_node)
        check("clicking (not choosing) a select must not assign anything",
              page.evaluate("() => YARN.Wizard._debug.state().assign.str") is None)
        # The real interaction still works: a genuine change event assigns.
        page.select_option('select[data-wz="assign:str"]', "2")
        check("a real change event still assigns correctly",
              page.evaluate("() => YARN.Wizard._debug.state().assign.str") == 2)

        print("\n  -- default method is Roll dice (the classic way to start) --")
        page.click('[data-wz="cancel"]')
        open_wizard_to_abilities(page)
        check("ability step defaults to the 'roll' method",
              page.evaluate("() => YARN.Wizard._debug.state().method") == "roll")
        check("Roll dice tab shows as selected by default",
              "sel" in page.query_selector('[data-wz="method:roll"]').get_attribute("class"))

        browser.close()

    print("")
    if failures:
        print("test_wizard_abilities_e2e.py FAILED (" + str(len(failures)) + "): " + ", ".join(failures))
        return 1
    print("test_wizard_abilities_e2e.py PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
