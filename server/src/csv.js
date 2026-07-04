import fs from 'node:fs';

/**
 * Minimal CSV parser for the seed file. Handles quoted fields and commas
 * inside quotes; the seed data is simple ASCII so this is sufficient.
 */
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      record.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || record.length > 0) { record.push(field); rows.push(record); }
      field = ''; record = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || record.length > 0) { record.push(field); rows.push(record); }
  return rows;
}

/** Read the seed CSV into normalized item objects. */
export function readSeedItems(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(text).filter((r) => r.length > 1);
  const header = rows.shift();
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  return rows.map((r) => ({
    id: r[idx.id].trim(),
    category: r[idx.category].trim(),
    subcategory: r[idx.subcategory].trim(),
    itemName: r[idx.item_name].trim(),
    unit: r[idx.unit].trim(),
    quantity: Number(r[idx.quantity]) || 0,
    lowThreshold: Number(r[idx.low_threshold]) || 0,
    lastUpdated: '',
    updatedBy: '',
  }));
}
