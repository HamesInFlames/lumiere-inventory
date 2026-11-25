import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCount } from '../../scripts/apply-nov24-count.js';

const HEADER = ['ID', 'Category', 'Subcategory', 'Item Name', 'Unit', 'Quantity', 'Status', 'Last Updated', 'Updated By'];

// Ids present in the live sheet for these tests (new items + milk-small absent).
const PRESENT = [
  'milk', 'almond-milk', 'large-coffee-bags', 'small-coffee-bags', 'large-to-go-cups',
  'regular-to-go-cups', 'decaf-coffee-bags', 'mint', 'apple', 'brown-sugar',
  'plastic-gloves', 'napkins', 'lumiere-pastry-paper', 'paper-bags-12', 'cup-holders',
  'shopping-bags-large', 'small-boxes', 'one-biter-containers-4',
];

function mockSheets({ ids = PRESENT, header = HEADER } = {}) {
  const calls = [];
  return {
    calls,
    spreadsheets: {
      values: {
        get: async () => ({ data: { values: [header, ...ids.map((id) => [id])] } }),
        batchUpdate: async ({ requestBody }) => { calls.push({ op: 'batchUpdate', data: requestBody.data, valueInputOption: requestBody.valueInputOption }); return { data: {} }; },
        append: async ({ requestBody, insertDataOption }) => { calls.push({ op: 'append', values: requestBody.values, insertDataOption }); return { data: {} }; },
      },
    },
  };
}

const cellVal = (plan, suffix) => plan.cellUpdates.filter((c) => c.range.endsWith(suffix)).map((c) => c.values[0][0]);

test('applyCount builds the right surgical plan and nothing is missing', async () => {
  const sheets = mockSheets();
  const plan = await applyCount({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory', now: 'T', dryRun: true });

  assert.deepEqual(plan.missing, [], 'all expected ids present');

  // milk renamed to large bag, unit bag, qty 3 (D/E/F updates on milk's row = row 2).
  assert.deepEqual(cellVal(plan, 'D2'), ['Milk (large bag)']);
  assert.deepEqual(cellVal(plan, 'E2'), ['bag']);
  assert.deepEqual(cellVal(plan, 'F2'), [3]);

  // Five appended rows: milk-small + the four new catalog items.
  assert.equal(plan.appends.length, 5);
  const byId = Object.fromEntries(plan.appends.map((r) => [r[0], r]));
  assert.equal(byId['milk-small'][5], 7);           // quantity
  assert.equal(byId['milk-small'][6], 'have');       // status
  assert.equal(byId['maple-spice-syrup'][3], 'Maple spice');
  assert.equal(byId['maple-spice-syrup'][6], 'urgent');
  assert.equal(byId['receipt-paper'][3], 'Receipt / print paper');
  assert.equal(byId['coffee-cup-sleeves'][6], 'urgent');
  assert.equal(byId['small-garbage-bags'][6], 'urgent');
  // Appended rows carry the stamp + "count" author.
  assert.equal(byId['maple-spice-syrup'][7], 'T');
  assert.equal(byId['maple-spice-syrup'][8], 'count');

  // Every status value written is one of have/low/urgent.
  const statuses = new Set([
    ...plan.cellUpdates.filter((c) => /![A-Z]*G\d+$/.test(c.range) || /!G\d+$/.test(c.range)).map((c) => c.values[0][0]),
    ...plan.appends.map((r) => r[6]),
  ]);
  for (const s of statuses) assert.ok(['have', 'low', 'urgent'].includes(s), `bad status ${s}`);

  // dryRun writes nothing.
  assert.equal(sheets.calls.length, 0, 'dry run performs no writes');
});

test('applyCount writes exactly one batchUpdate and one append when applied', async () => {
  const sheets = mockSheets();
  const plan = await applyCount({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory', now: 'T', dryRun: false });
  const ops = sheets.calls.map((c) => c.op);
  assert.deepEqual(ops.sort(), ['append', 'batchUpdate']);
  const bu = sheets.calls.find((c) => c.op === 'batchUpdate');
  assert.equal(bu.valueInputOption, 'USER_ENTERED');
  assert.equal(bu.data.length, plan.cellUpdates.length);
  const ap = sheets.calls.find((c) => c.op === 'append');
  assert.equal(ap.insertDataOption, 'INSERT_ROWS');
  assert.equal(ap.values.length, 5);
});

test('applyCount aborts (no writes) if the sheet is not the Status schema', async () => {
  const badHeader = ['ID', 'Category', 'Subcategory', 'Item Name', 'Unit', 'Quantity', 'Low Threshold', 'Last Updated', 'Updated By'];
  const sheets = mockSheets({ header: badHeader });
  await assert.rejects(
    () => applyCount({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory', dryRun: false }),
    /Unexpected sheet layout/,
  );
  assert.equal(sheets.calls.length, 0);
});

test('applyCount records missing ids instead of failing', async () => {
  // Drop two ids that would otherwise be updated.
  const ids = PRESENT.filter((id) => id !== 'mint' && id !== 'cup-holders');
  const sheets = mockSheets({ ids });
  const plan = await applyCount({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory', now: 'T', dryRun: true });
  assert.deepEqual(plan.missing.sort(), ['cup-holders', 'mint']);
});

test('applyCount updates (not duplicates) a new item that already exists', async () => {
  const ids = [...PRESENT, 'maple-spice-syrup'];
  const sheets = mockSheets({ ids });
  const plan = await applyCount({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory', now: 'T', dryRun: true });
  assert.ok(!plan.appends.some((r) => r[0] === 'maple-spice-syrup'), 'existing item is not appended again');
  assert.equal(plan.appends.length, 4, 'only the still-missing new rows are appended');
});
