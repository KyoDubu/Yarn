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
        # Step 3: species -> elf
        page.click('[data-wz="pick:species:elf"]')
        page.click('[data-wz="next"]')
        # Step 4: background -> Outlander
        page.click('[data-wz="pick:background:Outlander"]')
        page.click('[data-wz="next"]')
        # Step 5: abilities -> auto-assign standard array for the class
        next_btn = page.query_selector('[data-wz="next"]')
        check("Next disabled before assigning scores", next_btn.get_attribute("disabled") is not None)
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
        check("homebrew is on", made and made["homebrew"]["enabled"] is True)
        # ranger suggested array puts 15 in DEX; elf adds +2 -> final 17
        dex = page.evaluate("() => YARN.abilityScore(YARN.getCharacter(YARN.state.ui.activeCharId), "
                            "YARN.blankProgress(), 'dex')")
        check("elf ranger DEX ends at 17", dex == 17)

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

        browser.close()

    print("")
    if failures:
        print("test_wizard_e2e.py FAILED (" + str(len(failures)) + "): " + ", ".join(failures))
        return 1
    print("test_wizard_e2e.py PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
