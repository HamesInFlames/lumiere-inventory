import { useEffect, useRef, useState } from 'react';
import type { Item, ItemStatus } from '../types';

interface Props {
  item: Item;
  units: string[];
  onPatch: (patch: { quantity?: number; unit?: string; status?: ItemStatus; trackQty?: boolean }) => void;
}

const STATUSES: { value: ItemStatus; label: string; active: string }[] = [
  { value: 'have', label: 'Have', active: 'bg-brand-surface text-brand-ink' },
  { value: 'low', label: 'Low', active: 'bg-brand-butter text-brand-ink' },
  { value: 'urgent', label: 'Urgent', active: 'bg-brand-need text-white' },
];

export function ItemRow({ item, units, onPatch }: Props) {
  // Local editable copy of quantity so typing feels instant.
  const [qty, setQty] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const editing = useRef(false);
  const editingUnit = useRef(false);

  // Keep the fields in sync when the item changes from elsewhere (SSE/poll),
  // unless the user is mid-edit in that field.
  useEffect(() => {
    if (!editing.current) setQty(String(item.quantity));
  }, [item.quantity]);
  useEffect(() => {
    if (!editingUnit.current) setUnit(item.unit);
  }, [item.unit]);

  function commitQty() {
    editing.current = false;
    const n = Math.max(0, Math.round(Number(qty)) || 0);
    setQty(String(n));
    if (n !== item.quantity) onPatch({ quantity: n });
  }

  function commitUnit() {
    editingUnit.current = false;
    const u = unit.trim();
    if (!u) { setUnit(item.unit); return; }
    setUnit(u);
    if (u !== item.unit) onPatch({ unit: u });
  }

  function step(delta: number) {
    const n = Math.max(0, item.quantity + delta);
    setQty(String(n));
    onPatch({ quantity: n });
  }

  const listId = `units-${item.id}`;

  const tracking = item.trackQty !== false;

  const toggle = (
    <button
      onClick={() => onPatch({ trackQty: !tracking })}
      aria-label="Toggle count"
      title="Show/hide count"
      className={`w-9 h-9 shrink-0 rounded-lg text-base font-semibold leading-none ${
        tracking ? 'bg-brand-surface text-brand-ink' : 'text-brand-inkSoft border border-brand-line'
      }`}
    >
      #
    </button>
  );

  const counter = (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={() => step(-1)}
        aria-label="Decrease"
        className="w-9 h-9 rounded-full bg-brand-surface text-brand-ink text-xl leading-none active:bg-brand-line disabled:opacity-40"
        disabled={item.quantity <= 0}
      >
        −
      </button>
      <input
        inputMode="numeric"
        value={qty}
        onFocus={() => { editing.current = true; }}
        onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commitQty}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-11 sm:w-12 text-center rounded-lg border border-brand-line py-1.5 font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-rose"
      />
      <button
        onClick={() => step(1)}
        aria-label="Increase"
        className="w-9 h-9 rounded-full bg-brand-ink text-white text-xl leading-none active:bg-black"
      >
        +
      </button>
      <input
        list={listId}
        value={unit}
        aria-label="Unit"
        onFocus={() => { editingUnit.current = true; }}
        onChange={(e) => setUnit(e.target.value)}
        onBlur={commitUnit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-20 sm:w-24 rounded-lg border border-brand-line pl-2 pr-1 py-1.5 text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-rose"
      />
      <datalist id={listId}>
        {units.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );

  const statusControl = (
    <div className="flex rounded-lg border border-brand-line p-0.5 text-sm shrink-0">
      {STATUSES.map((s) => (
        <button
          key={s.value}
          onClick={() => { if (item.status !== s.value) onPatch({ status: s.value }); }}
          className={`px-3 py-1.5 rounded-md font-medium transition ${
            item.status === s.value ? s.active : 'text-brand-inkSoft'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  const subcategory = item.subcategory || item.category;

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 px-4 py-3 border-b border-brand-line ${
        item.low ? 'bg-brand-needBg' : 'bg-brand-bg'
      }`}
    >
      {/* Name + badge: full width on mobile so the name never truncates. */}
      <div className="min-w-0 sm:flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-brand-ink break-words sm:truncate">{item.itemName}</span>
          {item.low && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide font-semibold text-white bg-brand-need rounded px-1.5 py-0.5">
              {item.status === 'urgent' ? 'Urgent' : 'Low'}
            </span>
          )}
        </div>
        {/* Subcategory under the name on desktop only. */}
        <div className="hidden sm:block text-xs text-brand-inkSoft truncate">{subcategory}</div>
      </div>

      {/* Mobile: subcategory + count/unit on one line, status segments right-aligned below. */}
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <div className="text-xs text-brand-inkSoft truncate sm:hidden">{subcategory}</div>
          {tracking ? (
            <div className="flex items-center gap-1.5">{toggle}{counter}</div>
          ) : (
            toggle
          )}
        </div>
        {statusControl}
      </div>
    </div>
  );
}
