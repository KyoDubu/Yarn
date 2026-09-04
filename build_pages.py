"""Build the GitHub Pages deploy folder (docs/) for Yarn.

Yarn has no PWA assets yet (no manifest/service worker/icons - see DEVLOG
"possible next steps"), so this stays deliberately minimal: it just copies
the real source files into docs/ with yarn.html renamed to index.html
(GitHub Pages serves index.html at the repo root automatically). No
inlining/bundling needed - Yarn already loads its modules as separate
<script> tags, so "building" is just "copying".

Run this after any change you want live on GitHub Pages:
    .venv\\Scripts\\python build_pages.py
Then commit + push docs/ - GitHub Pages serves it straight from there
(Settings -> Pages -> Deploy from a branch -> /docs).
"""
import pathlib
import shutil

OUT = pathlib.Path("docs")

# Every file yarn.html actually references via <script>/<link>, in the same
# order as yarn.html - kept as one explicit list so a forgotten new module
# fails loudly (missing file) instead of silently shipping a stale build.
ASSETS = [
    "app.css",
    "app.rules.js",
    "app.species.js",
    "app.core.js",
    "app.wizard.js",
    "app.sync.js",
    "app.ui.js",
]

# Subfolders referenced by yarn.html (e.g. the logo/icon), copied whole.
ASSET_DIRS = [
    "Static",
]


def main():
    OUT.mkdir(exist_ok=True)

    html = pathlib.Path("yarn.html").read_text(encoding="utf-8")
    (OUT / "index.html").write_text(html, encoding="utf-8")

    for name in ASSETS:
        src = pathlib.Path(name)
        if not src.exists():
            raise SystemExit("Missing asset referenced by yarn.html: " + name)
        shutil.copyfile(src, OUT / name)

    for name in ASSET_DIRS:
        src = pathlib.Path(name)
        if not src.exists():
            raise SystemExit("Missing asset folder referenced by yarn.html: " + name)
        dest = OUT / name
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(src, dest)

    # GitHub Pages: skip Jekyll processing (needed since files start with "app.").
    (OUT / ".nojekyll").write_text("", encoding="utf-8")

    print("Built docs/ for GitHub Pages:")
    for p in sorted(OUT.iterdir()):
        if p.is_file():
            print("  docs/%s  (%d bytes)" % (p.name, p.stat().st_size))


if __name__ == "__main__":
    main()
