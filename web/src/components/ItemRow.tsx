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

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-stone-100 ${
        item.low ? 'bg-amber-50' : 'bg-white'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-stone-800 truncate">{item.itemName}</span>
          {item.low && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
              Low
            </span>
          )}
        </div>
        <div className="text-xs text-stone-400 truncate">
          {item.subcategory || item.category}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => step(-1)}
          aria-label="Decrease"
          className="w-9 h-9 rounded-full bg-stone-100 text-stone-700 text-xl leading-none active:bg-stone-200 disabled:opacity-40"
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
          className="w-12 text-center rounded-lg border border-stone-200 py-1.5 font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-lumiere-gold"
        />
        <button
          onClick={() => step(1)}
          aria-label="Increase"
          className="w-9 h-9 rounded-full bg-lumiere-gold text-white text-xl leading-none active:bg-lumiere-dark"
        >
          +
        </button>
      </div>

      <select
        value={item.unit}
        onChange={(e) => onPatch({ unit: e.target.value })}
        className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lumiere-gold"
      >
        {unitOptions.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
    </div>
  );
}
