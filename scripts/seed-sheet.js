#!/usr/bin/env node
/**
 * Populate the Google Sheet from data/inventory_seed.csv:
 *   - Creates/clears the Inventory and Units tabs
 *   - Writes headers + all item rows
 *   - Writes the unit list and applies a dropdown (data validation) to the
 *     Unit column so it stays in sync with the app's dropdown
 *
 * Usage:
 *   GOOGLE_SERVICE_ACCOUNT_JSON=... SHEET_ID=... node scripts/seed-sheet.js
 *
 * The service account (its client_email) must be shared on the sheet as Editor.
 */
import { google } from 'googleapis';
import { readSeedItems } from '../server/src/csv.js';
import { config, DEFAULT_UNITS } from '../server/src/config.js';

const HEADER = ['ID', 'Category', 'Subcategory', 'Item Name', 'Unit', 'Quantity', 'Low Threshold', 'Last Updated', 'Updated By'];

async function main() {
  if (config.mode !== 'sheets') {
    console.error('Set GOOGLE_SERVICE_ACCOUNT_JSON and SHEET_ID before seeding.');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: config.serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = config.sheetId;

  const items = readSeedItems(config.seedCsv);
  console.log(`Loaded ${items.length} items from CSV.`);

  // Ensure the two tabs exist and get their sheetIds.
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Map(meta.data.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const requests = [];
  for (const title of [config.sheetTab, config.unitsTab]) {
    if (!existing.has(title)) requests.push({ addSheet: { properties: { title } } });
  }
  if (requests.length) {
    const res = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    for (const r of res.data.replies) {
      if (r.addSheet) existing.set(r.addSheet.properties.title, r.addSheet.properties.sheetId);
    }
  }
  const invSheetId = existing.get(config.sheetTab);

  // Write Units tab.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${config.unitsTab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Unit'], ...DEFAULT_UNITS.map((u) => [u])] },
  });

  // Write Inventory tab.
  const rows = items.map((it) => [
    it.id, it.category, it.subcategory, it.itemName,
    it.unit, it.quantity, it.lowThreshold, '', '',
  ]);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${config.sheetTab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER, ...rows] },
  });

  // Apply a dropdown to the Unit column (E) pointing at the Units tab range.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        setDataValidation: {
          range: {
            sheetId: invSheetId,
            startRowIndex: 1,
            endRowIndex: rows.length + 1,
            startColumnIndex: 4, // column E
            endColumnIndex: 5,
          },
          rule: {
            condition: {
              type: 'ONE_OF_RANGE',
              values: [{ userEnteredValue: `=${config.unitsTab}!$A$2:$A` }],
            },
            showCustomUi: true,
            strict: false,
          },
        },
      }, {
        // Freeze the header row.
        updateSheetProperties: {
          properties: { sheetId: invSheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      }],
    },
  });

  console.log(`Seeded ${rows.length} items into "${config.sheetTab}" with unit dropdowns.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}

main().catch((err) => {
  console.error(err.errors || err.message || err);
  process.exit(1);
});
