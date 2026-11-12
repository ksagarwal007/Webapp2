# Salarist build

The live site is the repository root (deployed by Hostinger). This folder holds the sources and is blocked from the web by `.htaccess`.

- `src/` — pages' data, CSS, JS, fonts, images, partials
- `build.py` — generates the site into `dist/` (needs Python 3 and Node for `tools/static_lists.js`)

To update: edit `src/`, run `python3 build.py`, copy `dist/*` (including `.htaccess`) to the repository root.
