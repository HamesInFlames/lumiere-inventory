import type { Item } from '../types';

// Same category ordering the list uses.
const CATEGORY_ORDER = ['DRINKS', 'INGREDIENTS', 'CONTAINERS', 'SUPPLIES'];

export interface ShareOptions {
  scope: 'urgent' | 'restock' | 'all';
}

// urgent first, then "need soon", then stocked.
const STATUS_RANK = { urgent: 0, low: 1, have: 2 } as const;

/**
 * Build a WhatsApp-formatted inventory message from the full item list.
 * Pure and dependency-free. WhatsApp renders *bold* and _italic_.
 * Filters by `scope` itself, so callers always pass every item.
 */
export function formatShareMessage(items: Item[], opts: ShareOptions): string {
  const { scope } = opts;
  const chosen = items.filter((it) =>
    scope === 'all' ? true : scope === 'urgent' ? it.status === 'urgent' : it.status !== 'have',
  );

  const lines: string[] = ['*Inventory*'];

  // Group by category, preserving CATEGORY_ORDER; unknown categories go last.
  const byCategory = new Map<string, Item[]>();
  for (const it of chosen) {
    if (!byCategory.has(it.category)) byCategory.set(it.category, []);
    byCategory.get(it.category)!.push(it);
  }
  const orderedCategories = [...byCategory.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for (const category of orderedCategories) {
    const group = byCategory.get(category)!;
    group.sort((a, b) => {
      if (a.status !== b.status) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (a.subcategory !== b.subcategory) return a.subcategory.localeCompare(b.subcategory);
      return a.itemName.localeCompare(b.itemName);
    });
    lines.push('');
    lines.push(`*${category}*`);
    for (const it of group) {
      const tag = it.status === 'urgent' ? ' — URGENT' : it.status === 'low' ? ' — need soon' : '';
      const qty = it.trackQty === false ? '' : `: ${it.quantity} ${it.unit} left`;
      lines.push(`• ${it.itemName}${qty}${tag}`);
    }
  }

  lines.push('');
  const u = chosen.filter((it) => it.status === 'urgent').length;
  const l = chosen.filter((it) => it.status === 'low').length;
  if (u + l === 0) {
    lines.push('All items are stocked. ✅');
  } else {
    const parts: string[] = [];
    if (u > 0) parts.push(`${u} urgent`);
    if (l > 0) parts.push(`${l} need soon`);
    lines.push(parts.join(' · '));
  }

  return lines.join('\n');
}
