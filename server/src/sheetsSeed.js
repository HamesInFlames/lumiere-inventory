import { DEFAULT_UNITS } from './config.js';

// Column layout of the Inventory tab (see ARCHITECTURE.md §3).
export const HEADER = ['ID', 'Category', 'Subcategory', 'Item Name', 'Unit', 'Quantity', 'Low Threshold', 'Last Updated', 'Updated By'];

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
    it.unit, it.quantity, it.lowThreshold, '', '',
  ]);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER, ...rows] },
  });

  // Unit dropdown on column E + frozen header row.
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
