import fs from 'node:fs';
import path from 'node:path';
import { readSeedItems } from '../csv.js';
import { DEFAULT_UNITS } from '../config.js';

/**
 * Local JSON-backed store. Used automatically when no Google credentials are
 * configured, so the whole app runs and is fully editable with zero setup.
 * The on-disk file (gitignored) persists edits across restarts.
 */
export class LocalStore {
  constructor({ dbPath, seedCsv }) {
    this.dbPath = dbPath;
    this.seedCsv = seedCsv;
  }

  async init() {
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      const items = readSeedItems(this.seedCsv);
      this._write({ items, units: DEFAULT_UNITS });
    }
  }

  _read() {
    return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
  }

  _write(db) {
    fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
  }

  async list() {
    return this._read().items;
  }

  async getUnits() {
    return this._read().units;
  }

  async updateItem(id, patch, updatedBy) {
    const db = this._read();
    const item = db.items.find((it) => it.id === id);
    if (!item) return null;
    if (typeof patch.quantity === 'number' && !Number.isNaN(patch.quantity)) {
      item.quantity = Math.max(0, patch.quantity);
    }
    if (typeof patch.unit === 'string' && patch.unit) {
      item.unit = patch.unit;
      if (!db.units.includes(patch.unit)) db.units.push(patch.unit);
    }
    if (typeof patch.lowThreshold === 'number' && !Number.isNaN(patch.lowThreshold)) {
      item.lowThreshold = Math.max(0, patch.lowThreshold);
    }
    item.lastUpdated = patch.lastUpdated;
    item.updatedBy = updatedBy || 'staff';
    this._write(db);
    return item;
  }
}
