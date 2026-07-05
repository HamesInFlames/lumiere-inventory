import { google } from 'googleapis';
import { readSeedItems } from '../csv.js';
import { seedSheet } from '../sheetsSeed.js';

// A ID | B Category | C Subcategory | D Item Name | E Unit | F Quantity |
// G Low Threshold | H Last Updated | I Updated By | J Type (ARCHITECTURE.md §3).
const DATA_RANGE = 'A2:J';

/**
 * Google Sheets-backed store. The sheet is the source of truth. Reads pull the
 * whole data range; writes target only the changed cells for one row, addressed
 * by the stable ID column so re-sorting rows in the sheet never corrupts writes.
 */
export class SheetsStore {
  constructor({ serviceAccount, sheetId, sheetTab, unitsTab, seedCsv }) {
    this.sheetId = sheetId;
    this.sheetTab = sheetTab;
    this.unitsTab = unitsTab;
    this.seedCsv = seedCsv;
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async init() {
    // Auto-seed on first boot so no terminal/seed script is needed. This is a
    // no-op once the Inventory tab has data, so it's safe on every restart.
    const result = await seedSheet({
      sheets: this.sheets,
      spreadsheetId: this.sheetId,
      sheetTab: this.sheetTab,
      unitsTab: this.unitsTab,
      items: readSeedItems(this.seedCsv),
    });
    if (result.seeded) {
      console.log(`Auto-seeded ${result.count} items into the sheet on first boot.`);
    }
  }

  _range(a1) {
    return `${this.sheetTab}!${a1}`;
  }

  async list() {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: this._range(DATA_RANGE),
    });
    const rows = res.data.values || [];
    return rows
      .filter((r) => r[0])
      .map((r) => ({
        id: String(r[0]).trim(),
        category: r[1] || '',
        subcategory: r[2] || '',
        itemName: r[3] || '',
        unit: r[4] || 'unit',
        quantity: Number(r[5]) || 0,
        lowThreshold: Number(r[6]) || 0,
        lastUpdated: r[7] || '',
        updatedBy: r[8] || '',
        type: String(r[9] || '').trim() === 'toggle' ? 'toggle' : 'count',
      }));
  }

  async getUnits() {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.unitsTab}!A2:A`,
    });
    return (res.data.values || []).map((r) => r[0]).filter(Boolean);
  }

  /** Find the 1-based sheet row number for an item id (accounts for header). */
  async _rowNumber(id) {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: this._range('A2:A'),
    });
    const ids = (res.data.values || []).map((r) => (r[0] ? String(r[0]).trim() : ''));
    const zeroBased = ids.indexOf(id);
    return zeroBased === -1 ? null : zeroBased + 2; // +2: header + 1-based
  }

  async updateItem(id, patch, updatedBy) {
    const row = await this._rowNumber(id);
    if (!row) return null;

    const data = [];
    if (typeof patch.unit === 'string' && patch.unit) {
      data.push({ range: this._range(`E${row}`), values: [[patch.unit]] });
    }
    if (typeof patch.quantity === 'number' && !Number.isNaN(patch.quantity)) {
      data.push({ range: this._range(`F${row}`), values: [[Math.max(0, patch.quantity)]] });
    }
    if (typeof patch.lowThreshold === 'number' && !Number.isNaN(patch.lowThreshold)) {
      data.push({ range: this._range(`G${row}`), values: [[Math.max(0, patch.lowThreshold)]] });
    }
    data.push({ range: this._range(`H${row}`), values: [[patch.lastUpdated]] });
    data.push({ range: this._range(`I${row}`), values: [[updatedBy || 'staff']] });

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.sheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });

    const items = await this.list();
    return items.find((it) => it.id === id) || null;
  }
}
