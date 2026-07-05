# Feature Spec: Mobile-friendly item rows (no truncated names)

Status: **planned** — ready for implementation.
Scope: frontend-only, essentially all in `web/src/components/ItemRow.tsx` with
one small tweak in `web/src/App.tsx`. No backend/sheet/API changes.

## 1. Problem

On phone widths (~375–430px) the single-row layout crushes the item name:
the stepper (36px + 48px + 36px), unit select (96px), gaps, and padding leave
~60px for text, so names render as "D…", "Al…", "Cr…" (see screenshot from
2026-07-05). The name is the most important thing on the row and is currently
the *least* readable.

## 2. Solution — stack the row on small screens

Restructure `ItemRow` from one horizontal flex row into a **two-line card on
mobile, single row on `sm:` (≥640px) and up**. Mobile-first classes, `sm:`
restores today's layout.

### Mobile (< 640px) — default classes

```
┌───────────────────────────────────────────┐
│ Decaf coffee bags  [LOW]                   │  ← name wraps, never truncates
│ Coffee                    − [1] +  bag ▾   │  ← meta left, controls right
└───────────────────────────────────────────┘
```

- Outer container: `flex flex-col gap-2` (instead of `flex items-center gap-3`).
- **Line 1**: item name + Low/Need badge. Name uses normal wrapping
  (`break-words`), NOT `truncate`. Long names ("12 one-biter containers",
  "Lactose free milk") wrap to a second line rather than clipping. Badge stays
  `shrink-0` beside the name.
- **Line 2**: `flex items-center justify-between gap-2`:
  - left: the subcategory text (existing `text-xs text-stone-400`), allowed to
    truncate — it's redundant info (the group header already shows it), so IT
    absorbs the squeeze instead of the name.
  - right: the controls, `shrink-0`:
    - count items: − / qty / + stepper and unit select, exactly today's
      elements. Trim fixed widths slightly on mobile: qty input `w-11`,
      unit select `w-[4.5rem]` with `text-xs`; restore `w-12` / `w-24` /
      `text-sm` at `sm:`. Keep tap targets ≥ 36px (current w-9 h-9 is fine).
    - toggle items: the Need/Have segmented switch, unchanged.

### Desktop (`sm:` ≥ 640px)

`sm:flex-row sm:items-center` etc. to reproduce today's one-line layout
(name flex-1 truncate is acceptable there — width is plentiful, but prefer
keeping `break-words` + `line-clamp-2` if it needs no extra effort).

## 3. Other small-screen tidy-ups (same PR)

1. **Meta row** in `App.tsx` ("71 items · synced to Sheets" + Share + Sort):
   currently wraps awkwardly. Make it `flex-wrap gap-y-1` so it breaks
   cleanly, and shorten the status text on mobile to "71 items · synced"
   (keep full text at `sm:`; simplest: two spans with `hidden sm:inline` /
   `sm:hidden`).
2. **"Your name" input** in the header: `w-28` clips longer names like
   "James Willy" — widen to `w-32` and keep it `shrink-0`; the title already
   truncates gracefully.
3. Do NOT touch: chips row (already scrolls horizontally), ShareSheet (already
   mobile-first bottom sheet), Login.

## 4. Verification (Playwright, headless Chromium)

Run the app locally (local mode) and test at **viewport 375×812** (iPhone) and
**320×568** (worst case):

1. No item name is clipped: for every row, assert the name element's
   `scrollWidth <= clientWidth` (with wrapping allowed there should be no
   horizontal overflow) — spot-check "Decaf coffee bags",
   "12 one-biter containers", "Lactose free milk".
2. Stepper +/− still updates quantity; unit select still opens/changes.
3. A toggle item (set one in local db) shows the Need/Have switch on its
   second line, right-aligned.
4. At 1024px viewport the row is single-line again (controls and name on one
   row).
5. `npm run build` passes (tsc strict).

## 5. Out of scope

- Virtualized lists, swipe gestures, per-row threshold editing.
- Any change to message formatting or sync.
