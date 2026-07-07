import { config } from './config.js';
import { LocalStore } from './stores/localStore.js';
import { SheetsStore } from './stores/sheetsStore.js';

/**
 * Facade over the active store. Keeps an in-memory cache so all reads are
 * instant, polls the source of truth on an interval as a sync safety net, and
 * lets callers subscribe to change notifications (used by the SSE endpoint).
 */
class InventoryStore {
  constructor() {
    this.backend = config.mode === 'sheets'
      ? new SheetsStore(config)
      : new LocalStore({ dbPath: config.localDbPath, seedCsv: config.seedCsv });
    this.cache = { items: [], units: [], notes: [], lastSync: null };
    this.listeners = new Set();
    this._timer = null;
  }

  async start() {
    await this.backend.init();
    await this.refresh();
    this._timer = setInterval(() => {
      this.refresh().catch((err) => console.error('Poll refresh failed:', err.message));
    }, config.pollIntervalMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
  }

  /** Attach derived fields (low-stock flag) to a raw item. */
  _decorate(item) {
    // Toggle items are "low" (needed) when off; count items when at/below threshold.
    const low = item.type === 'toggle'
      ? item.quantity <= 0
      : item.quantity <= item.lowThreshold;
    return { ...item, low };
  }

  async refresh() {
    const [items, units, notes] = await Promise.all([
      this.backend.list(),
      this.backend.getUnits(),
      this.backend.listNotes(),
    ]);
    this.cache = {
      items: items.map((it) => this._decorate(it)),
      units,
      notes,
      lastSync: nowIso(),
    };
    this._emit({ type: 'full-refresh', items: this.cache.items });
    this._emit({ type: 'notes-updated', notes: this.cache.notes });
    return this.cache;
  }

  getItems() {
    return this.cache.items;
  }

  getUnits() {
    return this.cache.units;
  }

  getNotes() {
    return this.cache.notes;
  }

  async addNote(text, by) {
    const note = await this.backend.addNote(text, by, nowIso());
    this.cache.notes = [...this.cache.notes, note];
    this._emit({ type: 'notes-updated', notes: this.cache.notes });
    return note;
  }

  async deleteNote(id) {
    const ok = await this.backend.deleteNote(id);
    if (!ok) return false;
    this.cache.notes = this.cache.notes.filter((n) => n.id !== id);
    this._emit({ type: 'notes-updated', notes: this.cache.notes });
    return true;
  }

  getLastSync() {
    return this.cache.lastSync;
  }

  async updateItem(id, patch, updatedBy) {
    const stamped = { ...patch, lastUpdated: nowIso() };
    const updated = await this.backend.updateItem(id, stamped, updatedBy);
    if (!updated) return null;
    const decorated = this._decorate(updated);
    // Refresh just this item in the cache.
    const idx = this.cache.items.findIndex((it) => it.id === id);
    if (idx !== -1) this.cache.items[idx] = decorated;
    if (patch.unit && !this.cache.units.includes(patch.unit)) {
      this.cache.units.push(patch.unit);
    }
    this._emit({ type: 'item-updated', item: decorated });
    return decorated;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(event) {
    for (const fn of this.listeners) {
      try { fn(event); } catch (err) { console.error('SSE listener error:', err.message); }
    }
  }
}

function nowIso() {
  // Wall-clock timestamp for audit fields.
  return new Date().toISOString();
}

export const store = new InventoryStore();
