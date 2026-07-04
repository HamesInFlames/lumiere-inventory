import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Item, SortKey } from './types';
import { Login } from './components/Login';
import { ItemRow } from './components/ItemRow';
import { ShareSheet } from './components/ShareSheet';

const CATEGORY_ORDER = ['DRINKS', 'INGREDIENTS', 'CONTAINERS', 'SUPPLIES'];

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [mode, setMode] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState(() => localStorage.getItem('lumiere_name') || '');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const [lowOnly, setLowOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('category');
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => { localStorage.setItem('lumiere_name', name); }, [name]);

  useEffect(() => {
    api.session().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  async function load() {
    const data = await api.getItems();
    setItems(data.items);
    setUnits(data.units);
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
    return () => es.close();
  }, [authed]);

  async function patch(id: string, p: { quantity?: number; unit?: string; lowThreshold?: number }) {
    const prev = items;
    // Optimistic update.
    setItems((cur) =>
      cur.map((it) =>
        it.id === id
          ? { ...it, ...p, low: (p.quantity ?? it.quantity) <= (p.lowThreshold ?? it.lowThreshold) }
          : it,
      ),
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
    return <div className="min-h-screen flex items-center justify-center text-stone-400">Loading…</div>;
  }
  if (!authed) return <Login onAuthed={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-10 bg-lumiere-cream/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-bold text-lumiere-gold">Lumière Inventory</h1>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-28 text-sm rounded-lg border border-stone-200 px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-lumiere-gold"
            />
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lumiere-gold"
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
            <Chip active={lowOnly} tone="amber" onClick={() => { setLowOnly((v) => !v); }}>
              Low{lowCount ? ` (${lowCount})` : ''}
            </Chip>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs text-stone-400">
            <span>{visible.length} items{mode === 'local' ? ' · local mode' : ' · synced to Sheets'}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShareOpen(true)}
                className="flex items-center gap-1 text-lumiere-gold font-medium"
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
                className="rounded border border-stone-200 bg-white px-1.5 py-0.5"
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
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-3">
        {!loaded ? (
          <p className="text-center text-stone-400 py-10">Loading inventory…</p>
        ) : visible.length === 0 ? (
          <p className="text-center text-stone-400 py-10">No items match.</p>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-sm">
            {groups.map((g) => (
              <div key={g.key || 'all'}>
                {g.label && (
                  <div className="px-4 py-1.5 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500 border-b border-stone-100">
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
      </main>

      {shareOpen && (
        <ShareSheet
          allItems={items}
          viewItems={visible}
          staffName={name}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

function Chip({
  active, onClick, children, tone = 'gold',
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'gold' | 'amber';
}) {
  const activeCls = tone === 'amber' ? 'bg-amber-500 text-white border-amber-500' : 'bg-lumiere-gold text-white border-lumiere-gold';
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-sm rounded-full px-3 py-1 border transition ${
        active ? activeCls : 'bg-white text-stone-600 border-stone-300'
      }`}
    >
      {children}
    </button>
  );
}
