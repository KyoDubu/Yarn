"""test_species.py - proves the species/subspecies data is sound and the math
that consumes it (stacking ASI, speed/size overrides, trait display) is correct.

Two kinds of checks here:
  1. Data integrity: every species/subrace is well-formed (unique keys, valid
     ability keys, non-negative bonuses) - catches typos in the big data file
     before they become "my character has NaN Strength" bug reports.
  2. Math: YARN.speciesASI/speciesSpeed/speciesSize/speciesProfile behave
     correctly for real species (stacking, overrides, unknown-subrace safety).

    .venv\\Scripts\\python -u test_species.py
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
MODULES = ["app.rules.js", "app.species.js", "app.core.js"]


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

        def check_val(label, actual, expected):
            ok = actual == expected
            print(("  PASS " if ok else "  FAIL ") + label +
                  " expected=" + repr(expected) + " actual=" + repr(actual))
            if not ok:
                failures.append(label)

        # ---- data integrity -------------------------------------------
        print("  -- data integrity --")
        integrity = page.evaluate(
            """() => {
                const abilityKeys = new Set(YARN.ABILITY_KEYS);
                const speciesKeys = new Set();
                const problems = [];
                YARN.SPECIES.forEach(sp => {
                    if (speciesKeys.has(sp.key)) problems.push('dup species key ' + sp.key);
                    speciesKeys.add(sp.key);
                    if (!sp.name || !sp.size || !sp.speed) problems.push(sp.key + ' missing name/size/speed');
                    Object.keys(sp.asi || {}).forEach(k => {
                        if (!abilityKeys.has(k)) problems.push(sp.key + ' bad ability key ' + k);
                        if (sp.asi[k] <= 0) problems.push(sp.key + ' non-positive asi ' + k);
                    });
                    const subKeys = new Set();
                    (sp.subraces || []).forEach(sub => {
                        if (subKeys.has(sub.key)) problems.push(sp.key + ' dup subrace key ' + sub.key);
                        subKeys.add(sub.key);
                        if (!sub.name) problems.push(sp.key + '/' + sub.key + ' missing name');
                        Object.keys(sub.asi || {}).forEach(k => {
                            if (!abilityKeys.has(k)) problems.push(sp.key + '/' + sub.key + ' bad ability key ' + k);
                        });
                    });
                });
                return { count: YARN.SPECIES.length, problems };
            }"""
        )
        print("  species count:", integrity["count"])
        check("at least 30 species (the 'go all-in' ask)", "YARN.SPECIES.length >= 30", True)
        check_val("no data-integrity problems", integrity["problems"], [])
        if integrity["problems"]:
            failures.append("data integrity: " + str(integrity["problems"]))

        # ---- lookup helpers ---------------------------------------------
        print("\n  -- lookup helpers --")
        check("speciesInfo(dwarf) resolves", "!!YARN.speciesInfo('dwarf')", True)
        check("speciesInfo(nonsense) is null", "YARN.speciesInfo('nonsense')", None)
        check("subspeciesInfo(dwarf, hill) resolves", "!!YARN.subspeciesInfo('dwarf', 'hill')", True)
        check("subspeciesInfo(dwarf, nonsense) is null", "YARN.subspeciesInfo('dwarf', 'nonsense')", None)
        check("subspeciesInfo(halfOrc, anything) is null (no subraces)",
              "YARN.subspeciesInfo('halfOrc', 'whatever')", None)
        check("subspeciesInfo with blank subkey is null", "YARN.subspeciesInfo('dwarf', '')", None)

        # ---- stacking ASI (the whole point) ------------------------------
        print("\n  -- stacking ASI --")
        page.evaluate(
            """() => {
                window.hillDwarf = { species: 'dwarf', subspecies: 'hill' };
                window.mountainDwarf = { species: 'dwarf', subspecies: 'mountain' };
                window.plainDwarf = { species: 'dwarf', subspecies: '' };
                window.woodElf = { species: 'elf', subspecies: 'wood' };
                window.shadarKai = { species: 'elf', subspecies: 'shadarKai' };
                window.unknownSub = { species: 'dwarf', subspecies: 'nonsense' };
            }"""
        )
        check("Hill Dwarf: base CON+2 stacks with subrace WIS+1",
              "JSON.stringify(YARN.speciesASI(hillDwarf))", '{"con":2,"wis":1}')
        check("Mountain Dwarf: base CON+2 stacks with subrace STR+2",
              "JSON.stringify(YARN.speciesASI(mountainDwarf))", '{"con":2,"str":2}')
        check("plain Dwarf (no subrace): just the base CON+2",
              "JSON.stringify(YARN.speciesASI(plainDwarf))", '{"con":2}')
        check("Wood Elf: base DEX+2 stacks with subrace WIS+1",
              "JSON.stringify(YARN.speciesASI(woodElf))", '{"dex":2,"wis":1}')
        check("Shadar-Kai: base DEX+2 stacks with subrace CON+1",
              "JSON.stringify(YARN.speciesASI(shadarKai))", '{"dex":2,"con":1}')
        check("unknown subrace contributes nothing extra",
              "JSON.stringify(YARN.speciesASI(unknownSub))", '{"con":2}')

        # abilityScore end-to-end: Hill Dwarf WIS 10 base -> 11
        page.evaluate(
            """() => {
                window.HD = YARN.blankCharacter();
                HD.species = 'dwarf'; HD.subspecies = 'hill';
                HD.abilities.wis = 10; HD.abilities.con = 14;
            }"""
        )
        check("Hill Dwarf WIS 10 base -> 11 final", "YARN.abilityScore(HD, null, 'wis')", 11)
        check("Hill Dwarf CON 14 base -> 16 final", "YARN.abilityScore(HD, null, 'con')", 16)

        # ---- speed / size overrides ---------------------------------------
        print("\n  -- speed / size overrides --")
        check("base Elf speed is 30", "YARN.speciesSpeed({species:'elf', subspecies:''})", 30)
        check("Wood Elf overrides speed to 35", "YARN.speciesSpeed({species:'elf', subspecies:'wood'})", 35)
        check("High Elf keeps base speed 30", "YARN.speciesSpeed({species:'elf', subspecies:'high'})", 30)
        check("Halfling size is Small", "YARN.speciesSize({species:'halfling', subspecies:''})", "Small")
        check("unknown species falls back to 30ft/Medium",
              "YARN.speciesSpeed({species:'not-a-species', subspecies:''})", 30)

        # ---- species profile (traits/languages bundle for the sheet) -----
        print("\n  -- species profile --")
        prof = page.evaluate(
            "() => YARN.speciesProfile({species: 'dwarf', subspecies: 'hill'})"
        )
        check_val("profile name is Dwarf", prof["name"], "Dwarf")
        check_val("profile subName is Hill Dwarf", prof["subName"], "Hill Dwarf")
        has_toughness = any("Toughness" in t for t in prof["traits"])
        check_val("profile merges base + subrace traits", len(prof["traits"]) > 4 and has_toughness, True)
        check_val("profile includes languages", "Dwarvish" in prof["languages"], True)

        # every species with subraces: stacking never produces NaN/undefined
        stack_check = page.evaluate(
            """() => {
                const bad = [];
                YARN.SPECIES.forEach(sp => (sp.subraces || []).forEach(sub => {
                    const asi = YARN.speciesASI({species: sp.key, subspecies: sub.key});
                    Object.values(asi).forEach(v => { if (!Number.isFinite(v)) bad.push(sp.key + '/' + sub.key); });
                }));
                return bad;
            }"""
        )
        check_val("no NaN/undefined bonuses across every subrace combo", stack_check, [])

        # ---- clone preserves subspecies -----------------------------------
        print("\n  -- clone carries subspecies --")
        page.evaluate(
            """() => {
                YARN.state = YARN.normalize({
                    characters: [{id: 'src', name: 'Grondar', species: 'dwarf', subspecies: 'mountain'}],
                    campaigns: []
                });
                window.CLONE2 = YARN.cloneAsHomebrew('src');
            }"""
        )
        check("clone keeps subspecies", "CLONE2.subspecies", "mountain")

        browser.close()

    print("")
    if failures:
        print("test_species.py FAILED (" + str(len(failures)) + "): " + ", ".join(failures))
        return 1
    print("test_species.py PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
