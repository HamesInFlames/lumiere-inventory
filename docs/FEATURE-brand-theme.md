# Feature Spec: Brand theme from lumierepatisserie.ca

Status: **planned** — palette is PROVISIONAL (see §2 note) but the spec is
buildable as-is; swapping final hex values later is a one-file change.
Scope: frontend-only (`web/`). No backend/sheet changes.

## 1. Goal

Restyle the app to match the Lumière Pâtisserie brand (lumierepatisserie.ca):
a warm, French-patisserie feel — dark espresso/charcoal surfaces or text,
gold/bronze accents, cream backgrounds, serif display type for headings.
The app should feel like an extension of the shop's site, while staying a
high-contrast, fast tool for staff.

## 2. Palette → Tailwind tokens

> **PROVISIONAL:** the site blocks scraping, so these values are derived from
> the shop's brand PDF (gold headings on cream). If `docs/brand/` contains
> site screenshots at build time, sample exact colors from them first
> (dominant background, heading color, button color) and update this table +
> `tailwind.config.js` before styling. Keep the token NAMES stable either way.

Replace the current ad-hoc `lumiere.{gold,dark,cream}` block in
`web/tailwind.config.js` with a full token set:

```js
colors: {
  brand: {
    gold:     '#8a6d1f',  // primary accent — buttons, active chips, links
    goldDark: '#6b551a',  // hover/active state of gold
    cream:    '#faf7ef',  // app background
    paper:    '#ffffff',  // card/surface background
    ink:      '#2a2420',  // primary text — warm near-black (espresso)
    inkSoft:  '#6f665e',  // secondary text (replaces stone-400/500 usages)
    line:     '#e7e0d2',  // borders/dividers (replaces stone-100/200/300)
    need:     '#b45309',  // low/need accent (amber-700 family, warmed)
    needBg:   '#fef3e2',  // low-row background (replaces amber-50)
  },
}
```

Migration: grep `web/src` for `lumiere-`, `stone-`, and `amber-` classes and
map them onto the tokens above (stone→ink/inkSoft/line/paper, amber→need/needBg,
lumiere→brand). Do not leave raw Tailwind grays behind in components.
WhatsApp button stays `#25D366` (product color, not brand).

## 3. Typography

- **Display font** for the wordmark/headings: `"Cormorant Garamond", Georgia, serif`
  — elegant French-serif feel, free on Google Fonts. Because the app is a PWA
  behind a strict single-host deploy, self-host it: download the woff2
  (latin, 500+700) into `web/public/fonts/`, declare `@font-face` in
  `index.css`, and add `font-display: swap`. Do NOT hotlink Google Fonts.
- **Body/UI stays system sans** (current default) for legibility and speed.
- Apply: `h1` wordmark, group headers ("DRINKS · COFFEE"), the Login title,
  and the ShareSheet title get `font-display` (new Tailwind
  `fontFamily.display` token). Everything else unchanged.
- Wordmark: render as "Lumière **Pâtisserie**" — title case with the accents,
  brand.gold, display font; subtitle "Inventory" in small caps inkSoft.

## 4. Component-level changes

| Component | Change |
|---|---|
| `index.css` / `tailwind.config.js` | tokens (§2), @font-face + `fontFamily.display`; body bg `brand.cream`, text `brand.ink` |
| `App.tsx` header | wordmark styling (§3); chips: active = brand.gold bg, inactive = paper bg + line border + inkSoft text; Low chip active = brand.need |
| `ItemRow.tsx` | low rows: `needBg` background + `need` badge; steppers: + button brand.gold, − paper w/ line border; borders → line |
| `Login.tsx` | cream page, paper card, display-font "Lumière Pâtisserie" title, gold button |
| `ShareSheet.tsx` | same surface/border/token swap; scope toggle active = brand.gold |
| `manifest.webmanifest` + `index.html` theme-color | `background_color: cream`, `theme_color: brand.gold` (update both to final gold) |
| `icon.svg` | keep the gold "L" tile but use final brand.gold + display serif |

Keep all layout/spacing exactly as-is (the mobile layout was just fixed) —
this change is colors + type only.

## 5. Accessibility guardrails

- Body text (`ink` on `cream`/`paper`) must be ≥ 4.5:1 contrast. (#2a2420 on
  #faf7ef ≈ 13:1 — fine; re-check if sampled site colors replace these.)
- brand.gold on white for text/icons must pass 4.5:1 for small text — #8a6d1f
  on #fff ≈ 5.5:1, OK; if the sampled site gold is lighter, use it for fills
  with white text (check that direction instead) and keep goldDark for text.
- The Need/Low badge (need on needBg) ≥ 4.5:1.
- Verify with a quick script or manual check; note results in the PR/commit.

## 6. Verification checklist

1. `npm run build` passes.
2. Headless Chromium at 390px and 1024px: screenshot login, main list (with a
   low item + a toggle item), ShareSheet open. Eyeball: cohesive warm palette,
   no leftover blue/gray Tailwind defaults, display font actually loaded
   (check `document.fonts.check('1rem "Cormorant Garamond"')`).
3. Confirm no layout shifts vs. before (font-display swap, same spacing).
4. Contrast spot-checks from §5.

## 7. Out of scope

- Dark mode, logo image assets from the site (don't hotlink or copy site
  photography), any layout changes.
