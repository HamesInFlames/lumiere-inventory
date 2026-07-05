import type { Item } from '../types';

// Same category ordering the list uses.
const CATEGORY_ORDER = ['DRINKS', 'INGREDIENTS', 'CONTAINERS', 'SUPPLIES'];

export interface ShareOptions {
  scope: 'low' | 'view';
}

/**
 * Build a WhatsApp-formatted inventory message from the given items.
 * Pure and dependency-free. WhatsApp renders *bold* and _italic_.
 *
 * `items` should already be scoped by the caller for the 'view' case; for the
 * 'low' case this function filters to low items itself so it works off the full
 * list regardless of the caller's current filters.
 */
export function formatShareMessage(items: Item[], opts: ShareOptions): string {
  const { scope } = opts;
  const chosen = scope === 'low' ? items.filter((it) => it.low) : items;

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
      if (a.subcategory !== b.subcategory) return a.subcategory.localeCompare(b.subcategory);
      return a.itemName.localeCompare(b.itemName);
    });
    lines.push('');
    lines.push(`*${category}*`);
    for (const it of group) {
      lines.push(`• ${it.itemName}: ${it.quantity} ${it.unit} left`);
    }
  }

  lines.push('');
  // Count low items within the shared set so the footer matches the content.
  const lowCount = chosen.filter((it) => it.low).length;
  if (lowCount === 0) {
    lines.push('All items are stocked. ✅');
  } else {
    lines.push(`${lowCount} item${lowCount === 1 ? '' : 's'} need${lowCount === 1 ? 's' : ''} restocking.`);
  }

  return lines.join('\n');
}
