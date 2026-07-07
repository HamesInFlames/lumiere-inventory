import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readSeedItems } from '../csv.js';
import { DEFAULT_UNITS } from '../config.js';

export function newNoteId() {
  return `note-${crypto.randomBytes(4).toString('hex')}`;
}

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

  async listNotes() {
    return this._read().notes || [];
  }

  async addNote(text, by, created) {
    const db = this._read();
    if (!db.notes) db.notes = [];
    const note = { id: newNoteId(), text, by: by || 'staff', created };
    db.notes.push(note);
    this._write(db);
    return note;
  }

  async deleteNote(id) {
    const db = this._read();
    if (!db.notes) db.notes = [];
    const idx = db.notes.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    db.notes.splice(idx, 1);
    this._write(db);
    return true;
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
