# Feature Spec: Brand theme from lumierepatisserie.ca

Status: **planned — palette FINAL**, sampled from a homepage screenshot
provided by the owner (2026-07-05). Scope: frontend-only (`web/`). No
backend/sheet changes. Colors + type only — zero layout changes (the mobile
layout was just fixed; do not touch spacing/structure).

## 1. The brand look (from the screenshot)

The site is **minimal and white**: pure-white background, neutral dark-gray
text, light-gray card surfaces, generous whitespace. The ONE colorful element
is the wordmark "LUMIÈRE" — thin, wide-tracked uppercase letters filled with a
soft **pastel gradient** (rose → lavender/sky → mint → butter yellow), echoed
by a small gradient underline under the active nav item. Buttons are plain
(white/dark), photography provides the color.

Translation for the app: white surfaces, dark-ink controls, and the pastel
gradient used **sparingly** as the brand signature (wordmark, one accent
underline, app icon) — never for body text or small UI text.

## 2. Palette → Tailwind tokens (FINAL)

Replace the `lumiere.{gold,dark,cream}` block in `web/tailwind.config.js`:

```js
colors: {
  brand: {
    ink:      '#3d3d3d',  // primary text & filled controls (site heading gray)
    inkSoft:  '#8a8a8a',  // secondary text
    bg:       '#ffffff',  // app background (pure white, like the site)
    surface:  '#f6f6f6',  // card/section surfaces (product-card gray)
    line:     '#e8e8e8',  // borders/dividers
    rose:     '#f2a9bb',  // pastel 1 (gradient start)
    sky:      '#aecbf2',  // pastel 2
    mint:     '#a9dfc3',  // pastel 3
    butter:   '#f6de96',  // pastel 4 (gradient end)
    need:     '#c25b74',  // low/need accent — deepened rose, AA on white
    needBg:   '#fdf0f3',  // low-row background (rose-tinted, subtle)
  },
}
```

Plus a reusable gradient. In `index.css`:

```css
.brand-gradient { background-image: linear-gradient(90deg, #f2a9bb, #aecbf2, #a9dfc3, #f6de96); }
.text-gradient  { @apply brand-gradient bg-clip-text text-transparent; }
```

Migration: grep `web/src` for `lumiere-`, `stone-`, and `amber-` classes and
map them: stone-800→ink, stone-400/500→inkSoft, stone-100/200/300→line or
surface, white cards→bg/surface, amber-*→need/needBg, lumiere-gold (fills,
active states)→ink for controls (see §4) — the gradient replaces gold only in
the wordmark/underline/icon. WhatsApp button stays `#25D366`.

## 3. Typography

- **Wordmark**: match the logo's airy look — uppercase, thin, wide-tracked.
  Self-host **Raleway** Light (300) woff2 (latin subset) in
  `web/public/fonts/`, `@font-face` with `font-display: swap`; Tailwind token
  `fontFamily.display`. Render the header as:
  `LUMIÈRE` (display font, uppercase, `tracking-[0.3em]`, `.text-gradient`)
  with `PATISSERIE` beneath in tiny tracked inkSoft caps — mirroring the logo
  lockup. Login title and ShareSheet title use the same treatment (gradient
  only on the wordmark; titles like "Share inventory" are ink).
- **Everything else stays system sans** — this is a staff tool; body text,
  numbers, buttons unchanged.
- Group headers ("DRINKS · COFFEE") stay sans but move to inkSoft on surface.

## 4. Component-level changes

| Component | Change |
|---|---|
| `tailwind.config.js` / `index.css` | tokens + gradient utilities (§2), @font-face + `fontFamily.display`; body: bg `brand.bg`, text `brand.ink` |
| `App.tsx` header | wordmark lockup (§3) + a 2px `.brand-gradient` underline bar beneath the header block (the site's nav-underline motif); header bg white with `line` bottom border; chips: active = ink bg/white text, inactive = white bg/`line` border/inkSoft text; Low chip active = `need` bg/white text; status text + Share button = ink (Share icon may use `need`? no — keep ink) |
| `ItemRow.tsx` | rows on white; low rows `needBg` + badge `need` on `needBg` border; + button = ink bg/white text (replaces gold), − unchanged gray; unit select border `line`; toggle switch: "Need" active = `need` bg/white text, "Have" active = surface/ink |
| `Login.tsx` | white page, `surface` card (or white card + `line` border), wordmark lockup with gradient, submit button = ink bg/white text |
| `ShareSheet.tsx` | white sheet, `line` borders; scope toggle active = ink bg/white text; Copy/Share buttons = surface bg/ink text |
| `index.html` + `manifest.webmanifest` | `theme_color`/`background_color` → `#ffffff` |
| `icon.svg` | white rounded tile, thin uppercase "L" filled with the 4-stop gradient (SVG linearGradient), subtle `line` border so it reads on white home screens |

## 5. Accessibility guardrails

- Pastels are decorative only — never small text. The gradient wordmark is
  large display text; fine.
- ink (#3d3d3d) on white ≈ 10.4:1 — AA/AAA ok.
- need (#c25b74) on white ≈ 4.6:1 — passes AA for the badge text; verify, and
  darken toward #b34e68 if measured below 4.5:1.
- White text on ink fills ≈ 10:1 — ok. White on need fills (Low chip/Need
  switch) ≈ 4.6:1 — acceptable for large/bold UI text; verify.
- inkSoft (#8a8a8a) is for secondary text ≥ 12px only.

## 6. Verification checklist

1. `npm run build` passes.
2. Headless Chromium at 390px and 1024px: screenshot login, main list (include
   a low count item + a toggle item), and ShareSheet open. Eyeball against the
   site screenshot: white, minimal, gradient only in the wordmark/underline.
3. `document.fonts.check('300 1rem Raleway')` is true after load.
4. Contrast spot-checks from §5 (compute, don't eyeball).
5. No layout shift vs. current build (colors/type only).

## 7. Out of scope

- Dark mode; copying site photography or the actual logo file; layout changes;
  favicon PNG set (SVG icon is enough for the PWA).
