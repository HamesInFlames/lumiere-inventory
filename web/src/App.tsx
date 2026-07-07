import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Item, Note, SortKey } from './types';
import { Login } from './components/Login';
import { ItemRow } from './components/ItemRow';
import { ShareSheet } from './components/ShareSheet';
import { NotesPanel } from './components/NotesPanel';

const CATEGORY_ORDER = ['DRINKS', 'INGREDIENTS', 'CONTAINERS', 'SUPPLIES'];

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [mode, setMode] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState(() => localStorage.getItem('lumiere_name') || '');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const [lowOnly, setLowOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('category');
  const [shareOpen, setShareOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => { localStorage.setItem('lumiere_name', name); }, [name]);

  useEffect(() => {
    api.session().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  async function load() {
    const data = await api.getItems();
    setItems(data.items);
    setUnits(data.units);
    setNotes(data.notes || []);
    setMode(data.mode);
    setLoaded(true);
  }

  useEffect(() => {
    if (!authed) return;
    load();
    // Live updates via Server-Sent Events.
    const es = new EventSource('/api/stream');
    es.addEventListener('item-updated', (e) => {
      const { item } = JSON.parse((e as MessageEvent).data);
      setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)));
    });
    es.addEventListener('full-refresh', (e) => {
      const { items: fresh } = JSON.parse((e as MessageEvent).data);
      setItems(fresh);
    });
    es.addEventListener('notes-updated', (e) => {
      const { notes: fresh } = JSON.parse((e as MessageEvent).data);
      setNotes(fresh);
    });
    return () => es.close();
  }, [authed]);

  async function addNote(text: string) {
    try {
      const note = await api.addNote(text, name || 'staff');
      // SSE will also deliver this; de-dupe by id.
      setNotes((cur) => (cur.some((n) => n.id === note.id) ? cur : [...cur, note]));
    } catch { /* ignore; nothing persisted */ }
  }

  async function deleteNote(id: string) {
    const prev = notes;
    setNotes((cur) => cur.filter((n) => n.id !== id)); // optimistic
    try {
      await api.deleteNote(id);
    } catch {
      setNotes(prev); // rollback
    }
  }

  async function patch(id: string, p: { quantity?: number; unit?: string; lowThreshold?: number }) {
    const prev = items;
    // Optimistic update.
    setItems((cur) =>
      cur.map((it) => {
        if (it.id !== id) return it;
        const q = p.quantity ?? it.quantity;
        const low = it.type === 'toggle' ? q <= 0 : q <= (p.lowThreshold ?? it.lowThreshold);
        return { ...it, ...p, low };
      }),
    );
    try {
      const updated = await api.patchItem(id, p, name || 'staff');
      setItems((cur) => cur.map((it) => (it.id === id ? updated : it)));
      if (p.unit && !units.includes(p.unit)) setUnits((u) => [...u, p.unit!]);
    } catch {
      setItems(prev); // rollback
    }
  }

  const lowCount = useMemo(() => items.filter((it) => it.low).length, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((it) => {
      if (category !== 'ALL' && it.category !== category) return false;
      if (lowOnly && !it.low) return false;
      if (q && !it.itemName.toLowerCase().includes(q) && !it.subcategory.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'name': return a.itemName.localeCompare(b.itemName);
        case 'quantity': return a.quantity - b.quantity;
        case 'updated': return (b.lastUpdated || '').localeCompare(a.lastUpdated || '');
        case 'category':
        default: {
          const ci = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
          if (ci !== 0) return ci;
          if (a.subcategory !== b.subcategory) return a.subcategory.localeCompare(b.subcategory);
          return a.itemName.localeCompare(b.itemName);
        }
      }
    });
    return list;
  }, [items, search, category, lowOnly, sort]);

  // Group into subcategory sections when sorting by category.
  const groups = useMemo(() => {
    if (sort !== 'category') return [{ key: '', label: '', items: visible }];
    const map = new Map<string, Item[]>();
    for (const it of visible) {
      const key = `${it.category} · ${it.subcategory}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return [...map.entries()].map(([label, its]) => ({ key: label, label, items: its }));
  }, [visible, sort]);

  if (authed === null) {
    return <div className="min-h-screen flex items-center justify-center text-brand-inkSoft">Loading…</div>;
  }
  if (!authed) return <Login onAuthed={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur border-b border-brand-line">
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-gradient font-display font-light text-2xl leading-none tracking-[0.28em]">
                LUMIÈRE
              </div>
              <div className="text-[10px] tracking-[0.35em] text-brand-inkSoft font-display">
                PÂTISSERIE
              </div>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-32 shrink-0 text-sm rounded-lg border border-brand-line px-2 py-1 bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-rose"
            />
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="mt-2 w-full rounded-lg border border-brand-line px-3 py-2 bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-rose"
          />

          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            <Chip active={category === 'ALL' && !lowOnly} onClick={() => { setCategory('ALL'); setLowOnly(false); }}>
              All
            </Chip>
            {CATEGORY_ORDER.map((c) => (
              <Chip key={c} active={category === c && !lowOnly} onClick={() => { setCategory(c); setLowOnly(false); }}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </Chip>
            ))}
            <Chip active={lowOnly} tone="need" onClick={() => { setLowOnly((v) => !v); }}>
              Low{lowCount ? ` (${lowCount})` : ''}
            </Chip>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-y-1 text-xs text-brand-inkSoft">
            <span>
              {visible.length} items
              <span className="hidden sm:inline">{mode === 'local' ? ' · local mode' : ' · synced to Sheets'}</span>
              <span className="sm:hidden">{mode === 'local' ? ' · local' : ' · synced'}</span>
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNotesOpen(true)}
                className="lg:hidden flex items-center gap-1 text-brand-ink font-medium"
              >
                Notes{notes.length ? ` (${notes.length})` : ''}
              </button>
              <button
                onClick={() => setShareOpen(true)}
                className="flex items-center gap-1 text-brand-ink font-medium"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
                </svg>
                Share
              </button>
              <label className="flex items-center gap-1">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded border border-brand-line bg-brand-bg px-1.5 py-0.5"
              >
                <option value="category">Category</option>
                <option value="name">Name</option>
                <option value="quantity">Quantity</option>
                <option value="updated">Last updated</option>
              </select>
              </label>
            </div>
          </div>
        </div>
        {/* Brand gradient underline — the site's nav-accent motif. */}
        <div className="h-[2px] brand-gradient" />
      </header>

      <main className="max-w-2xl lg:max-w-4xl mx-auto px-4 mt-3 lg:flex lg:gap-4 lg:items-start">
        <div className="lg:flex-1 lg:min-w-0">
          {!loaded ? (
            <p className="text-center text-brand-inkSoft py-10">Loading inventory…</p>
          ) : visible.length === 0 ? (
            <p className="text-center text-brand-inkSoft py-10">No items match.</p>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-brand-line shadow-sm">
              {groups.map((g) => (
                <div key={g.key || 'all'}>
                  {g.label && (
                    <div className="px-4 py-1.5 bg-brand-surface text-xs font-semibold uppercase tracking-wide text-brand-inkSoft border-b border-brand-line">
                      {g.label}
                    </div>
                  )}
                  {g.items.map((it) => (
                    <ItemRow key={it.id} item={it} units={units} onPatch={(p) => patch(it.id, p)} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes: right column on desktop (always visible). */}
        <aside className="hidden lg:block lg:w-72 shrink-0 lg:sticky lg:top-24">
          <NotesPanel notes={notes} onAdd={addNote} onDelete={deleteNote} />
        </aside>
      </main>

      {shareOpen && (
        <ShareSheet
          allItems={items}
          viewItems={visible}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Notes as a bottom sheet on mobile. */}
      {notesOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 lg:hidden"
          onClick={() => setNotesOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-brand-bg rounded-t-2xl sm:rounded-2xl shadow-xl p-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end -mt-1 -mr-1 mb-1">
              <button onClick={() => setNotesOpen(false)} aria-label="Close" className="w-8 h-8 rounded-full text-brand-inkSoft hover:bg-brand-surface text-xl leading-none">
                ×
              </button>
            </div>
            <NotesPanel notes={notes} onAdd={addNote} onDelete={deleteNote} />
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  active, onClick, children, tone = 'ink',
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'ink' | 'need';
}) {
  const activeCls = tone === 'need'
    ? 'bg-brand-need text-white border-brand-need'
    : 'bg-brand-ink text-white border-brand-ink';
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-sm rounded-full px-3 py-1 border transition ${
        active ? activeCls : 'bg-brand-bg text-brand-inkSoft border-brand-line'
      }`}
    >
      {children}
    </button>
  );
}
