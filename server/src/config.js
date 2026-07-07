import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to repo root (server/src -> ../../). */
export const ROOT = path.resolve(__dirname, '..', '..');

function decodeServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    // Accept either raw JSON or base64-encoded JSON.
    const text = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
    return null;
  }
}

const serviceAccount = decodeServiceAccount();
const sheetId = process.env.SHEET_ID || null;

// Use Google Sheets when both a service account and a sheet id are present;
// otherwise fall back to the local JSON store so the app runs with zero setup.
const useSheets = Boolean(serviceAccount && sheetId);

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: '0.0.0.0',
  mode: useSheets ? 'sheets' : 'local',
  serviceAccount,
  sheetId,
  sheetTab: process.env.SHEET_TAB || 'Inventory',
  unitsTab: process.env.UNITS_TAB || 'Units',
  notesTab: process.env.NOTES_TAB || 'Notes',
  webhookSecret: process.env.WEBHOOK_SECRET || 'dev-secret',
  appPassword: process.env.APP_PASSWORD || 'lumiere',
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 60_000,
  seedCsv: path.join(ROOT, 'data', 'inventory_seed.csv'),
  localDbPath: path.join(__dirname, '..', 'data', 'inventory.local.json'),
  webDist: path.join(ROOT, 'web', 'dist'),
};

export const DEFAULT_UNITS = [
  'unit', 'bottle', 'bag', 'box', 'carton', 'case',
  'pack', 'sleeve', 'jar', 'roll', 'tank', 'L', 'kg', 'lb',
];
