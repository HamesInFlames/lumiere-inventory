#!/usr/bin/env node
/**
 * One-time SURGICAL update of the live inventory sheet from the Nov 24 floor
 * count. Unlike `npm run seed`, this NEVER clears or overwrites the sheet — it
 * only updates the quantity/status of the specific items listed below and
 * appends the new items if they are missing. Every other row is left untouched.
 *
 * Preview first (no writes):   DRY_RUN=1 railway run node scripts/apply-nov24-count.js
 * Apply for real:              railway run node scripts/apply-nov24-count.js
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON + SHEET_ID in the environment (injected
 * by `railway run`). Idempotent: running it twice yields the same result.
 */
import { google } from 'googleapis';
import { config } from '../server/src/config.js';

// Column layout: A id | B category | C subcategory | D itemName | E unit |
// F quantity | G status | H lastUpdated | I updatedBy.
const COL = { id: 0, category: 1, subcategory: 2, itemName: 3, unit: 4, quantity: 5, status: 6, lastUpdated: 7, updatedBy: 8 };

// Existing items (by id) to set to [quantity, status].
const UPDATES = {
  'almond-milk': [4, 'have'],
  'large-coffee-bags': [5, 'have'],
  'small-coffee-bags': [4, 'have'],
  'large-to-go-cups': [5, 'have'],
  'regular-to-go-cups': [8, 'have'],
  'decaf-coffee-bags': [1, 'low'],
  'mint': [0, 'low'],
  'apple': [0, 'low'],
  'brown-sugar': [0, 'low'],
  'plastic-gloves': [0, 'low'],
  'napkins': [0, 'low'],
  'lumiere-pastry-paper': [0, 'low'],
  'paper-bags-12': [1, 'low'],
  'cup-holders': [0, 'urgent'],
  'shopping-bags-large': [0, 'urgent'],
  'small-boxes': [0, 'urgent'],
  'one-biter-containers-4': [0, 'urgent'],
};

// Rename the existing single `milk` row into the "large bag" item.
const MILK_RENAME = { id: 'milk', itemName: 'Milk (large bag)', quantity: 3, status: 'have' };

// Rows that must exist (append if missing, else update quantity/status).
const ENSURE = [
  { id: 'milk-small', category: 'DRINKS', subcategory: 'Milk & Dairy', itemName: 'Milk (small bag)', unit: 'bag', quantity: 7, status: 'have' },
  { id: 'maple-spice-syrup', category: 'DRINKS', subcategory: 'Syrups', itemName: 'Maple spice', unit: 'bottle', quantity: 0, status: 'urgent' },
  { id: 'coffee-cup-sleeves', category: 'CONTAINERS', subcategory: 'Cups & Lids', itemName: 'Coffee cup sleeves', unit: 'sleeve', quantity: 0, status: 'urgent' },
  { id: 'small-garbage-bags', category: 'SUPPLIES', subcategory: 'General', itemName: 'Small coffee garbage bags', unit: 'box', quantity: 0, status: 'urgent' },
  { id: 'receipt-paper', category: 'SUPPLIES', subcategory: 'General', itemName: 'Receipt / print paper', unit: 'roll', quantity: 0, status: 'urgent' },
];

/**
 * Compute and (unless dryRun) apply the surgical changes. Returns a plan so the
 * logic is testable without a live sheet.
 * @returns {{cellUpdates: Array, appends: Array, missing: string[], log: string[]}}
 */
export async function applyCount({ sheets, spreadsheetId, sheetTab, now, dryRun = false }) {
  const stamp = now || new Date().toISOString();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetTab}!A1:I` });
  const rows = res.data.values || [];
  const header = rows[0] || [];
  if (String(header[COL.status] || '').trim() !== 'Status') {
    throw new Error(`Unexpected sheet layout: column G header is "${header[COL.status]}", expected "Status". Aborting without any writes.`);
  }

  // Map id -> 1-based sheet row number (row 2 is the first data row).
  const rowOf = new Map();
  for (let i = 1; i < rows.length; i++) {
    const id = (rows[i][COL.id] || '').toString().trim();
    if (id) rowOf.set(id, i + 1);
  }

  const cellUpdates = []; // {range, values}
  const appends = [];     // full A:I rows
  const missing = [];
  const log = [];

  const setCells = (row, { itemName, quantity, status }) => {
    if (itemName !== undefined) cellUpdates.push({ range: `${sheetTab}!D${row}`, values: [[itemName]] });
    if (quantity !== undefined) cellUpdates.push({ range: `${sheetTab}!F${row}`, values: [[quantity]] });
    if (status !== undefined) cellUpdates.push({ range: `${sheetTab}!G${row}`, values: [[status]] });
    cellUpdates.push({ range: `${sheetTab}!H${row}`, values: [[stamp]] });
    cellUpdates.push({ range: `${sheetTab}!I${row}`, values: [['count']] });
  };

  // 1. Simple quantity/status updates on existing rows.
  for (const [id, [quantity, status]] of Object.entries(UPDATES)) {
    const row = rowOf.get(id);
    if (!row) { missing.push(id); log.push(`MISSING (skipped): ${id}`); continue; }
    setCells(row, { quantity, status });
    log.push(`update ${id} -> qty ${quantity}, ${status}`);
  }

  // 2. Rename + set the milk row.
  {
    const row = rowOf.get(MILK_RENAME.id);
    if (!row) { missing.push(MILK_RENAME.id); log.push(`MISSING (skipped): ${MILK_RENAME.id}`); }
    else { setCells(row, MILK_RENAME); log.push(`rename ${MILK_RENAME.id} -> "${MILK_RENAME.itemName}", qty ${MILK_RENAME.quantity}`); }
  }

  // 3. Ensure new rows exist (update if already present, else append).
  for (const it of ENSURE) {
    const row = rowOf.get(it.id);
    if (row) {
      setCells(row, { itemName: it.itemName, quantity: it.quantity, status: it.status });
      log.push(`update existing ${it.id} -> qty ${it.quantity}, ${it.status}`);
    } else {
      appends.push([it.id, it.category, it.subcategory, it.itemName, it.unit, it.quantity, it.status, stamp, 'count']);
      log.push(`APPEND new ${it.id} ("${it.itemName}")`);
    }
  }

  if (!dryRun) {
    if (cellUpdates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', data: cellUpdates },
      });
    }
    if (appends.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetTab}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: appends },
      });
    }
  }

  return { cellUpdates, appends, missing, log };
}

async function main() {
  if (config.mode !== 'sheets') {
    console.error('Set GOOGLE_SERVICE_ACCOUNT_JSON and SHEET_ID (use `railway run`).');
    process.exit(1);
  }
  const dryRun = process.env.DRY_RUN === '1';
  const auth = new google.auth.GoogleAuth({
    credentials: config.serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(dryRun ? '--- DRY RUN (no writes) ---' : '--- APPLYING to the live sheet ---');
  const plan = await applyCount({ sheets, spreadsheetId: config.sheetId, sheetTab: config.sheetTab, dryRun });
  for (const line of plan.log) console.log('  ' + line);
  if (plan.missing.length) console.log(`\nWARNING: ${plan.missing.length} id(s) not found and skipped: ${plan.missing.join(', ')}`);
  console.log(`\n${dryRun ? 'Would change' : 'Changed'}: ${plan.cellUpdates.length} cells, ${plan.appends.length} new rows.`);
  if (dryRun) console.log('Re-run without DRY_RUN=1 to apply.');
  else console.log(`Sheet: https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`);
}

// Run only when invoked directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '')) {
  main().catch((err) => { console.error(err.message || err); process.exit(1); });
}
