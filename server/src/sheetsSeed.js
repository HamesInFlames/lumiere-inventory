import { DEFAULT_UNITS } from './config.js';

// Column layout of the Inventory tab (see ARCHITECTURE.md §3).
// G Status = 'have' | 'low' | 'urgent' (staff-set restock flag).
export const HEADER = ['ID', 'Category', 'Subcategory', 'Item Name', 'Unit', 'Quantity', 'Status', 'Last Updated', 'Updated By'];

export const STATUS_VALUES = ['have', 'low', 'urgent'];

/** Ensure the given tab titles exist; returns a title -> sheetId map. */
export async function ensureTabs(sheets, spreadsheetId, titles) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const map = new Map(meta.data.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const requests = [];
  for (const title of titles) {
    if (!map.has(title)) requests.push({ addSheet: { properties: { title } } });
  }
  if (requests.length) {
    const res = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    for (const r of res.data.replies) {
      if (r.addSheet) map.set(r.addSheet.properties.title, r.addSheet.properties.sheetId);
    }
  }
  return map;
}

/**
 * Populate the Inventory + Units tabs from the seed items and apply the unit
 * dropdown validation. By default this is a no-op if the Inventory tab already
 * has data rows, so it is safe to call on every server boot. Pass force:true
 * to overwrite (used by the standalone seed script).
 *
 * @returns {{seeded: boolean, count: number}}
 */
export async function seedSheet({ sheets, spreadsheetId, sheetTab, unitsTab, items, force = false }) {
  const tabMap = await ensureTabs(sheets, spreadsheetId, [sheetTab, unitsTab]);
  const invSheetId = tabMap.get(sheetTab);

  if (!force) {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTab}!A2:A`,
    });
    const hasData = (existing.data.values || []).some((r) => r[0]);
    if (hasData) return { seeded: false, count: 0 };
  }

  // Units tab.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${unitsTab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Unit'], ...DEFAULT_UNITS.map((u) => [u])] },
  });

  // Inventory tab.
  const rows = items.map((it) => [
    it.id, it.category, it.subcategory, it.itemName,
    it.unit, it.quantity, it.status || 'have', '', '',
  ]);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER, ...rows] },
  });

  // Unit dropdown (col E, non-strict so new units can be typed), Status
  // dropdown (col G), and frozen header row.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId: invSheetId,
              startRowIndex: 1,
              endRowIndex: rows.length + 1,
              startColumnIndex: 4,
              endColumnIndex: 5,
            },
            rule: {
              condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: `=${unitsTab}!$A$2:$A` }] },
              showCustomUi: true,
              strict: false,
            },
          },
        },
        {
          // Status dropdown on column G: have / low / urgent.
          setDataValidation: {
            range: {
              sheetId: invSheetId,
              startRowIndex: 1,
              endRowIndex: rows.length + 1,
              startColumnIndex: 6, // column G
              endColumnIndex: 7,
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: STATUS_VALUES.map((v) => ({ userEnteredValue: v })),
              },
              showCustomUi: true,
              strict: false,
            },
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: invSheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    },
  });

  return { seeded: true, count: rows.length };
}

/**
 * One-time, idempotent in-place migration of an existing (already-seeded) sheet
 * from the old schema (G = Low Threshold, J = Type) to the new one
 * (G = Status, no Type). Non-destructive: no columns or rows are deleted. The
 * old threshold numbers are intentionally discarded and every item starts at
 * 'have'; the Type column's values are cleared. Safe on every boot — it detects
 * the new header and returns early once migrated.
 *
 * Crash-safe: the `G1 = 'Status'` header write — which is what the early-return
 * check keys on — is done LAST, after the data, the J clear and the validation
 * swap. So if the process dies partway, the header still reads 'Low Threshold'
 * and the next boot re-runs the whole (idempotent) migration from the top.
 *
 * @returns {{migrated: boolean, count: number}}
 */
export async function migrateSchema({ sheets, spreadsheetId, sheetTab }) {
  const hdrRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTab}!A1:J1`,
  });
  const header = (hdrRes.data.values && hdrRes.data.values[0]) || [];
  // Column G is index 6. Already migrated -> nothing to do.
  if (String(header[6] || '').trim() === 'Status') return { migrated: false, count: 0 };
  // Empty sheet (no header yet) -> seedSheet handles it, not this.
  if (header.length === 0) return { migrated: false, count: 0 };

  // Count data rows by the ID column.
  const idsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTab}!A2:A`,
  });
  const n = (idsRes.data.values || []).filter((r) => r[0]).length;

  // Data G -> 'have' (old threshold numbers discarded). Header stays untouched
  // for now so a crash here leaves the migration re-runnable.
  if (n > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [{
          range: `${sheetTab}!G2:G${n + 1}`,
          values: Array.from({ length: n }, () => ['have']),
        }],
      },
    });
  }

  // Retire the Type column (J): clear its header + values.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetTab}!J1:J` });

  // Swap data-validation: drop the Type (J) dropdown, add a Status (G) dropdown.
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const invSheet = meta.data.sheets.find((s) => s.properties.title === sheetTab);
  if (invSheet) {
    const sheetId = invSheet.properties.sheetId;
    const endRowIndex = Math.max(n + 1, 2);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            // Clear validation on the old Type column (J).
            setDataValidation: {
              range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: 9, endColumnIndex: 10 },
            },
          },
          {
            // Status dropdown on column G.
            setDataValidation: {
              range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: 6, endColumnIndex: 7 },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: STATUS_VALUES.map((v) => ({ userEnteredValue: v })),
                },
                showCustomUi: true,
                strict: false,
              },
            },
          },
        ],
      },
    });
  }

  // Finally, flip the header. This is the completion marker the early-return
  // check above reads, so it must be the last write.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTab}!G1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Status']] },
  });

  return { migrated: true, count: n };
}
