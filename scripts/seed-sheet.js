#!/usr/bin/env node
/**
 * Standalone re-seed of the Google Sheet from data/inventory_seed.csv.
 *
 * You normally DON'T need this: the server auto-seeds an empty sheet on first
 * boot. Use this only to force a rebuild of the tabs (overwrites existing data).
 *
 * Usage:
 *   GOOGLE_SERVICE_ACCOUNT_JSON=... SHEET_ID=... node scripts/seed-sheet.js
 *
 * The service account (its client_email) must be shared on the sheet as Editor.
 */
import { google } from 'googleapis';
import { readSeedItems } from '../server/src/csv.js';
import { config } from '../server/src/config.js';
import { seedSheet } from '../server/src/sheetsSeed.js';

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

  const items = readSeedItems(config.seedCsv);
  console.log(`Loaded ${items.length} items from CSV.`);

  const result = await seedSheet({
    sheets,
    spreadsheetId: config.sheetId,
    sheetTab: config.sheetTab,
    unitsTab: config.unitsTab,
    items,
    force: true,
  });

  console.log(`Seeded ${result.count} items into "${config.sheetTab}" with unit dropdowns.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`);
}

main().catch((err) => {
  console.error(err.errors || err.message || err);
  process.exit(1);
});
