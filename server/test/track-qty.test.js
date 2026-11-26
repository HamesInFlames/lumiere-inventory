import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrackQty } from '../src/csv.js';
import { ensureTrackQtyHeader } from '../src/sheetsSeed.js';

// ---- parseTrackQty ------------------------------------------------------

test('parseTrackQty: blank/undefined and anything not explicitly off → tracked (true)', () => {
  for (const v of ['', ' ', undefined, null, 'true', 'TRUE', 'yes', '1', 'count', 'anything']) {
    assert.equal(parseTrackQty(v), true, `${JSON.stringify(v)} should be tracked`);
  }
});

test('parseTrackQty: explicit off words → not tracked (false)', () => {
  for (const v of ['false', 'FALSE', 'False', 'no', 'No', 'off', 'OFF', '0']) {
    assert.equal(parseTrackQty(v), false, `${JSON.stringify(v)} should be untracked`);
  }
});

// ---- ensureTrackQtyHeader ----------------------------------------------

function mockSheets({ j1 }) {
  const calls = [];
  return {
    calls,
    spreadsheets: {
      values: {
        get: async ({ range }) => { calls.push({ op: 'get', range }); return { data: { values: j1 == null ? [] : [[j1]] } }; },
        update: async ({ range, requestBody }) => { calls.push({ op: 'update', range, values: requestBody.values }); return { data: {} }; },
      },
    },
  };
}

test('ensureTrackQtyHeader sets J1 when it is blank, touching no data cell', async () => {
  const sheets = mockSheets({ j1: null });
  const res = await ensureTrackQtyHeader({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory' });
  assert.deepEqual(res, { set: true });
  const update = sheets.calls.find((c) => c.op === 'update');
  assert.ok(update, 'wrote the header');
  assert.equal(update.range, 'Inventory!J1', 'only J1 is written — no data cell');
  assert.deepEqual(update.values, [['Track Qty']]);
});

test('ensureTrackQtyHeader is a no-op when J1 already says Track Qty', async () => {
  const sheets = mockSheets({ j1: 'Track Qty' });
  const res = await ensureTrackQtyHeader({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory' });
  assert.deepEqual(res, { set: false });
  assert.ok(!sheets.calls.some((c) => c.op === 'update'), 'no write when already set');
});

test('ensureTrackQtyHeader sets J1 when it holds some other value (e.g. a stale header)', async () => {
  const sheets = mockSheets({ j1: 'Type' });
  const res = await ensureTrackQtyHeader({ sheets, spreadsheetId: 'x', sheetTab: 'Inventory' });
  assert.deepEqual(res, { set: true });
  assert.equal(sheets.calls.filter((c) => c.op === 'update').length, 1);
});
