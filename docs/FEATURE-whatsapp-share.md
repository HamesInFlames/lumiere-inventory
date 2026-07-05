# Feature Spec: Share Restock List to WhatsApp

Status: **planned** — ready for implementation.
Scope: frontend-only. No backend or sheet changes required (the client already
holds all item data). One new component + one pure formatter module.

## 1. What the user wants

Staff finish a count, see what's low, and need to send a restock/order request
to a manager or supplier over WhatsApp. Today they'd retype it. Instead: one
tap produces a clean, WhatsApp-formatted message — grouped by category, each
item showing **how much is left** (and its unit) — that they can send via
WhatsApp directly, the native share sheet, or clipboard.

## 2. Message format

WhatsApp renders `*bold*` and `_italic_`. Target output:

```
*Inventory*

*DRINKS*
• Milk: 0 carton left
• Oat milk: 1 carton left

*CONTAINERS*
• Blue lids: 1 sleeve left
• Shopping bags: 0 pack left

*SUPPLIES*
• CO2: 0 tank left

5 items need restocking.
```

Formatting rules:
- Header line is exactly `*Inventory*`; no date/time or staff-name line — go
  straight to the first category group.
- Group by **Category** (bold, in the existing CATEGORY_ORDER), items sorted
  by subcategory then name within each group. Skip empty groups.
- Each line: `• {itemName}: {quantity} {unit} left` — nothing else. No
  threshold/min annotations in either scope.
- Footer: `{n} items need restocking.` — or, when nothing is low:
  `All items are stocked. ✅` (message still sendable as an all-good report).
- Keep it plain text; no tables (WhatsApp has no alignment), no markdown links.

## 3. UX

**Entry point:** a "Share" button (share icon + label) in the sticky header
row, next to the sort selector. Always visible; especially natural after
tapping the Low chip.

**Tapping it opens a bottom-sheet modal** (mobile-first) containing:

1. **Scope toggle** — two segmented options:
   - **Low stock only** (default): items where `low === true`, regardless of
     current filters.
   - **Current view**: exactly the items the list is showing now (respects
     search, category chip, sort) — lets staff share e.g. "all DRINKS".
2. **Preview textarea** — the generated message, pre-filled and **editable**,
   so staff can delete a line or add a note before sending. Regenerated when
   the toggle changes (discarding edits is fine; note it in a caption).
3. **Action buttons** (in this order):
   - **WhatsApp** — opens `https://wa.me/?text=<encodeURIComponent(message)>`
     via an anchor with `target="_blank" rel="noopener"`. WhatsApp opens with
     the message pre-filled; the user picks the chat. If the café later wants
     a fixed supplier/group number, support env-driven default:
     `VITE_WHATSAPP_PHONE` → `https://wa.me/<phone>?text=...` (digits only,
     country code, no `+`).
   - **Share…** — `navigator.share({ text })`, only rendered when
     `typeof navigator.share === 'function'` (native sheet on iOS/Android;
     covers SMS, email, etc.).
   - **Copy** — `navigator.clipboard.writeText(text)`; button label flips to
     "Copied ✓" for 2s. Fallback if clipboard API unavailable: select the
     textarea content and `document.execCommand('copy')`.

Modal closes on backdrop tap or an X; no state persists.

## 4. Implementation plan

New files:
- `web/src/lib/formatShareMessage.ts` — **pure function**:
  ```ts
  formatShareMessage(items: Item[], opts: {
    scope: 'low' | 'view';
    staffName: string;
    now: Date;
  }): string
  ```
  Contains all grouping/sorting/wording logic above. Pure and dependency-free
  so it's trivially unit-testable.
- `web/src/components/ShareSheet.tsx` — the bottom-sheet modal (scope toggle,
  textarea, three actions). Plain Tailwind, consistent with existing components
  (rounded-2xl card, lumiere-gold accents).

Changes:
- `web/src/App.tsx` — add Share button to header; pass `visible` (current
  view items), `items` (all), `name`, and an `onClose` into `ShareSheet`;
  render it conditionally.

No changes to: server, sheet schema, auth, SSE, seed data.

## 5. Edge cases & constraints

- **URL length:** all 70 items ≈ 3–4 KB encoded; wa.me handles this, but keep
  the "current view" scope so huge shares are a choice, not the default.
- **Emoji/accents** (é in Lumière, ✅): `encodeURIComponent` handles them; do
  NOT hand-escape.
- **Desktop:** wa.me falls back to WhatsApp Web — works; `navigator.share`
  hidden when unsupported; Copy always present.
- **iOS PWA (standalone):** wa.me must open via a real anchor click (not
  `location.href`) to reliably leave the PWA shell.
- **Stale counts:** the modal formats from live client state, which SSE keeps
  fresh; timestamp line makes staleness visible in the message itself.

## 6. Verification checklist (for the implementing session)

1. Unit-test `formatShareMessage`: grouping, ordering, empty-low case,
   missing staff name.
2. `npm run build` passes (tsc strict).
3. Run locally: seed → mark 2–3 items low → open Share → verify preview text
   matches §2 exactly; toggle scopes; edit textarea; Copy works.
4. Verify the wa.me anchor href is correctly encoded (spot-check `%0A`
   newlines, no raw `&`).

## 7. Future (not in this build)

- **Scheduled reports:** a small server cron that posts the low-stock message
  to a WhatsApp Business API / Twilio number every morning — needs paid API,
  deferred until asked.
- **Selection mode:** checkboxes to hand-pick items for the message.
- **Order quantities:** suggest `need N` = threshold − quantity + buffer.
