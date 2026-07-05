import { useEffect, useRef, useState } from 'react';
import type { Item } from '../types';

interface Props {
  item: Item;
  units: string[];
  onPatch: (patch: { quantity?: number; unit?: string; lowThreshold?: number }) => void;
}

export function ItemRow({ item, units, onPatch }: Props) {
  // Local editable copy of quantity so typing feels instant.
  const [qty, setQty] = useState(String(item.quantity));
  const editing = useRef(false);

  // Keep the field in sync when the item changes from elsewhere (SSE/poll),
  // unless the user is mid-edit in this field.
  useEffect(() => {
    if (!editing.current) setQty(String(item.quantity));
  }, [item.quantity]);

  function commitQty() {
    editing.current = false;
    const n = Math.max(0, Math.round(Number(qty)) || 0);
    setQty(String(n));
    if (n !== item.quantity) onPatch({ quantity: n });
  }

  function step(delta: number) {
    const n = Math.max(0, item.quantity + delta);
    setQty(String(n));
    onPatch({ quantity: n });
  }

  const unitOptions = units.includes(item.unit) ? units : [item.unit, ...units];
  const isToggle = item.type === 'toggle';
  // For toggle items: quantity 0 = "Need" (restock), quantity >= 1 = have it.
  const needed = item.quantity <= 0;

  const controls = isToggle ? (
    <div className="flex rounded-lg border border-brand-line p-0.5 text-sm shrink-0">
      <button
        onClick={() => { if (!needed) onPatch({ quantity: 0 }); }}
        className={`px-3 py-1.5 rounded-md font-medium transition ${
          needed ? 'bg-brand-need text-white' : 'text-brand-inkSoft'
        }`}
      >
        Need
      </button>
      <button
        onClick={() => { if (needed) onPatch({ quantity: 1 }); }}
        className={`px-3 py-1.5 rounded-md font-medium transition ${
          !needed ? 'bg-brand-surface text-brand-ink' : 'text-brand-inkSoft'
        }`}
      >
        Have
      </button>
    </div>
  ) : (
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
      <select
        value={item.unit}
        onChange={(e) => onPatch({ unit: e.target.value })}
        className="w-20 sm:w-24 rounded-lg border border-brand-line pl-2 pr-1 py-1.5 text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-rose"
      >
        {unitOptions.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
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
              {isToggle ? 'Need' : 'Low'}
            </span>
          )}
        </div>
        {/* Subcategory under the name on desktop only. */}
        <div className="hidden sm:block text-xs text-brand-inkSoft truncate">{subcategory}</div>
      </div>

      {/* Mobile line 2: subcategory (left, may truncate) + controls (right). */}
      <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
        <div className="text-xs text-brand-inkSoft truncate sm:hidden">{subcategory}</div>
        {controls}
      </div>
    </div>
  );
}
