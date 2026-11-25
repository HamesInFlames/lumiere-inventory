import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normStatus } from '../src/csv.js';
import { migrateSchema } from '../src/sheetsSeed.js';

// ---- normStatus ---------------------------------------------------------

test('normStatus passes valid statuses and coerces everything else to have', () => {
  assert.equal(normStatus('low'), 'low');
  assert.equal(normStatus('urgent'), 'urgent');
  assert.equal(normStatus('have'), 'have');
  // Case/whitespace tolerant.
  assert.equal(normStatus(' URGENT '), 'urgent');
  assert.equal(normStatus('Low'), 'low');
  // Old low-threshold numbers and junk -> have (so a pre-migration cell is safe).
  assert.equal(normStatus('2'), 'have');
  assert.equal(normStatus(2), 'have');
  assert.equal(normStatus(''), 'have');
  assert.equal(normStatus('nope'), 'have');
  assert.equal(normStatus(null), 'have');
  assert.equal(normStatus(undefined), 'have');
});

// ---- migrateSchema ------------------------------------------------------

const OLD_HEADER = ['ID', 'Category', 'Subcategory', 'Item Name', 'Unit', 'Quantity', 'Low Threshold', 'Last Updated', 'Updated By', 'Type'];
const NEW_HEADER = ['ID', 'Category', 'Subcategory', 'Item Name', 'Unit', 'Quantity', 'Status', 'Last Updated', 'Updated By'];

/**
 * Build a fake googleapis Sheets client. `header` is row 1; `n` is the number
 * of data rows. Every mutating call is appended to `calls` in order so tests
 * can assert both content and sequencing.
 */
function mockSheets({ header, n }) {
  const calls = [];
  return {
    calls,
    spreadsheets: {
      get: async () => ({ data: { sheets: [{ properties: { title: 'Inventory', sheetId: 777 } }] } }),
      batchUpdate: async ({ requestBody }) => { calls.push({ op: 'batchUpdate', requests: requestBody.requests }); return { data: {} }; },
      values: {
        get: async ({ range }) => {
          if (range.endsWith('A1:J1')) return { data: { values: header ? [header] : [] } };
          if (range.endsWith('A2:A')) return { data: { values: Array.from({ length: n }, (_, i) => [`id-${i}`]) } };
          return { data: { values: [] } };
        },
        batchUpdate: async ({ requestBody }) => { calls.push({ op: 'values.batchUpdate', data: requestBody.data }); return { data: {} }; },
        clear: async ({ range }) => { calls.push({ op: 'values.clear', range }); return { data: {} }; },
        update: async ({ range, requestBody }) => { calls.push({ op: 'values.update', range, values: requestBody.values }); return { data: {} }; },
      },
    },
  };
}

test('migrateSchema is a no-op when the sheet already has the Status header', async () => {
  const sheets = mockSheets({ header: NEW_HEADER, n: 5 });
  const res = await migrateSchema({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory' });
  assert.deepEqual(res, { migrated: false, count: 0 });
  assert.equal(sheets.calls.length, 0, 'no mutating calls when already migrated');
});

test('migrateSchema is a no-op on an empty (unseeded) sheet', async () => {
  const sheets = mockSheets({ header: null, n: 0 });
  const res = await migrateSchema({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory' });
  assert.deepEqual(res, { migrated: false, count: 0 });
  assert.equal(sheets.calls.length, 0);
});

test('migrateSchema converts an old-schema sheet: G->have, J cleared, Status dropdown, header flipped last', async () => {
  const sheets = mockSheets({ header: OLD_HEADER, n: 3 });
  const res = await migrateSchema({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory' });
  assert.deepEqual(res, { migrated: true, count: 3 });

  // G2:G4 all set to 'have'.
  const gWrite = sheets.calls.find((c) => c.op === 'values.batchUpdate');
  assert.ok(gWrite, 'wrote the status column');
  assert.equal(gWrite.data[0].range, 'Inventory!G2:G4');
  assert.deepEqual(gWrite.data[0].values, [['have'], ['have'], ['have']]);

  // Type column J cleared.
  const jClear = sheets.calls.find((c) => c.op === 'values.clear');
  assert.ok(jClear && jClear.range === 'Inventory!J1:J', 'cleared the Type column');

  // Validation swap: clear J, add Status dropdown on G with the three values.
  const val = sheets.calls.find((c) => c.op === 'batchUpdate');
  assert.ok(val, 'applied data-validation batchUpdate');
  const gRule = val.requests.find((r) => r.setDataValidation?.rule)?.setDataValidation;
  assert.equal(gRule.range.startColumnIndex, 6, 'status dropdown on column G');
  assert.deepEqual(gRule.rule.condition.values.map((v) => v.userEnteredValue), ['have', 'low', 'urgent']);
  // Non-destructive: never deletes rows/columns.
  for (const c of sheets.calls) {
    if (c.requests) assert.ok(!c.requests.some((r) => r.deleteDimension), 'no deleteDimension');
  }

  // The header flip (completion marker) must be the LAST mutating call.
  const last = sheets.calls[sheets.calls.length - 1];
  assert.equal(last.op, 'values.update');
  assert.equal(last.range, 'Inventory!G1');
  assert.deepEqual(last.values, [['Status']]);
});

test('migrateSchema handles an old-schema sheet with zero data rows', async () => {
  const sheets = mockSheets({ header: OLD_HEADER, n: 0 });
  const res = await migrateSchema({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory' });
  assert.deepEqual(res, { migrated: true, count: 0 });
  // No G data write when there are no rows.
  assert.ok(!sheets.calls.some((c) => c.op === 'values.batchUpdate'), 'no empty status write');
  // Still clears J and flips the header.
  assert.ok(sheets.calls.some((c) => c.op === 'values.clear'));
  assert.equal(sheets.calls[sheets.calls.length - 1].range, 'Inventory!G1');
});
