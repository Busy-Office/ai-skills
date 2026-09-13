# Pulling a source mark from a brand/tech icon library

Use this when the user names a company or technology ("make me an app icon
for Stripe", "generate an icon using the Docker logo") instead of handing you
a file. All of these give you a **bare vector mark**, not a finished app
icon — no padding, often no background, sometimes a single fixed color. Fetch
the SVG, then run it through `generate-icons.sh` with `--pad` and `--bg` set
appropriately (0.1–0.2 padding is usually right for a dense mark; 0 for a
mark that's already fairly full-bleed).

Always confirm you're allowed to use the mark this way — most of these are
open-source icon sets for referencing a brand/technology (e.g. "built with
X"), not a license to claim the brand's identity as your own app icon. If the
user is building their own product's icon, a brand mark is rarely the right
choice unless the app *is* explicitly a companion/plugin for that brand.

## simple-icons — best for brand/company logos

~3200 single-color brand marks, kebab-case slugs. Fetch directly from the
jsdelivr CDN, no auth, no API key:

```
https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/{slug}.svg
```

Slugs are usually just the lowercased brand name with spaces/punctuation
stripped (`github`, `stripe`, `nodedotjs`, `visualstudiocode`). If unsure of
the exact slug, browse https://simpleicons.org/ or check the package's
`_data/simple-icons.json` in the GitHub repo. These SVGs are a single flat
color (usually the brand's primary color as the `fill`, sometimes just
`currentColor`) — you'll likely want to set an explicit fill or composite
onto a brand-appropriate background with `--bg`.

## devicon — best for programming languages / dev tools

Icons for languages, frameworks, and dev tools, each with `plain`,
`original`, and sometimes `line`/`wordmark` variants:

```
https://cdn.jsdelivr.net/gh/devicons/devicon/icons/{name}/{name}-{variant}.svg
```

e.g. `icons/python/python-original.svg`, `icons/react/react-original.svg`.
`original` usually preserves the tool's real brand colors; `plain` is
typically monochrome and easier to recolor.

## svgl.app — curated, includes light/dark variants

Has a documented API at `/docs/api` for querying by name/category and
getting both light and dark versions of a logo. Useful when the target
platform needs to adapt to system theme (e.g. picking the dark variant for
an Android adaptive background that's already dark). Fetch the API docs page
if you need the exact query shape — it wasn't fully inlined here since API
surfaces are exactly the kind of thing that drifts.

## thesvg.org — large general brand-SVG collection

No documented API found at time of writing; treat as browse-and-download
only. If the user points you at a specific icon page there, fetch that page
and extract the direct SVG asset link/download URL from it rather than
guessing a CDN pattern.

## Iconify search API — best for generic concept icons (not a brand mark)

When the user wants an icon for a *concept* — a shopping cart, a clipboard,
a package, a truck, a warehouse — rather than a specific company's logo,
don't hand-draw it. [Iconify](https://iconify.design) aggregates well over
100 open-license icon sets (Lucide, Streamline, Phosphor, Element Plus,
IconMind, Material Symbols, and many more), each drawn by an actual icon
designer on a consistent grid, and exposes a free search API with no auth:

```
https://api.iconify.design/search?query={keywords}&limit=40
```

Returns a list of `{prefix}:{name}` icon IDs plus per-collection metadata
(including `license`). Fetch a candidate's raw SVG with:

```
https://api.iconify.design/{prefix}/{name}.svg?color=white
```

(`color=white` (or any hex) recolors a `currentColor`/monochrome icon inline
— handy since most concept icons ship as single-color line or solid glyphs
meant to be recolored by whoever uses them.)

**Workflow that actually works well:**
1. Search with a few different keyword phrasings (e.g. "cart full", "cart
   package", "clipboard check") — results vary a lot by exact wording, and
   the obvious query sometimes returns nothing while a rephrase finds
   exactly the right icon.
2. Pull 3-5 candidates across different sets/styles (outline vs. solid —
   solid/bold styles generally hold up better at favicon sizes than thin
   outlines).
3. Check each candidate set's license via `https://api.iconify.design/collections?prefix={prefix}`
   — MIT/ISC/Apache-2.0 need no attribution; CC-BY-4.0 (Streamline is a
   common example) requires crediting the author somewhere in the app. Tell
   the user which license applies before they commit to one, since CC-BY on
   an app icon specifically is easy to forget about later.
4. Render each candidate at both a large size (~400px) and a small one
   (~32px) on the actual target background color, and let the user choose —
   don't just pick the first result yourself. What reads well large doesn't
   always survive shrinking.

## allogo (github.com/callback-io/allogo)

A browsable logo directory / React-Vue-Angular-Svelte component library, not
a CDN or API. If the user wants a logo from here, they'll need to grab the
raw SVG/PNG from the repo (or the rendered site) directly — there's no
predictable URL pattern to construct.
