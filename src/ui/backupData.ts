/** Only durable game data is backed up; cached assets and diagnostic logs are excluded. */
export const BACKUP_KEYS = ['coffee-preferences', 'coffee-falling-records', 'coffee-classic-records'] as const;
type RecordEntry = { score: number; rows: number; playedAt: number; durationMs?: number };
export interface Backup {
  format: 'coffee-match-backup'; version: 1; savedAt: number;
  data: Record<string, string>;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const uint = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
function validateData(key: string, raw: string): void {
  const v: unknown = JSON.parse(raw);
  if (key === BACKUP_KEYS[0]) {
    if (!object(v) || (v.version !== undefined && v.version !== 1) ||
      !['ru', 'en'].includes(v.language as string) || typeof v.vibration !== 'boolean' ||
      (v.mode !== undefined && v.mode !== 'classic' && v.mode !== 'falling') ||
      (v.storyMode !== undefined && (v.storyMode !== true || v.mode !== 'falling'))) throw Error('Invalid preferences');
  } else if (!Array.isArray(v) || !v.every(r => object(r) && uint(r.score) && uint(r.rows) &&
    uint(r.playedAt) && r.playedAt <= 8640000000000000 &&
    (r.durationMs === undefined || uint(r.durationMs)) && (key !== BACKUP_KEYS[2] || uint(r.durationMs)))) {
    throw Error('Invalid records');
  }
}
export function parseBackup(raw: string): Backup {
  if (new TextEncoder().encode(raw).length > 4 * 1024 * 1024) throw Error('Backup too large');
  const b: unknown = JSON.parse(raw);
  if (!object(b) || b.format !== 'coffee-match-backup' || b.version !== 1 || !uint(b.savedAt) ||
    !object(b.data) || Object.keys(b.data).some(k => !BACKUP_KEYS.includes(k as typeof BACKUP_KEYS[number]))) throw Error('Invalid backup');
  for (const [key, rawValue] of Object.entries(b.data)) {
    if (typeof rawValue !== 'string') throw Error('Invalid value');
    validateData(key, rawValue);
  }
  return b as unknown as Backup;
}
export function createBackup(storage: Storage): Backup {
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const raw = storage.getItem(key);
    if (raw !== null) { validateData(key, raw); data[key] = raw; }
  }
  return parseBackup(JSON.stringify({ format: 'coffee-match-backup', version: 1, savedAt: Date.now(), data }));
}
/** Merge records without losing results earned since the backup. Roll back on storage failure. */
export function restoreBackup(storage: Storage, backup: Backup): void {
  const checked = parseBackup(JSON.stringify(backup));
  const before = new Map<string, string | null>();
  const next = new Map<string, string>();
  for (const [key, raw] of Object.entries(checked.data)) {
    const old = storage.getItem(key);
    before.set(key, old);
    if (key === BACKUP_KEYS[0] || old === null) { next.set(key, raw); continue; }
    validateData(key, old);
    const merged = [...JSON.parse(old), ...JSON.parse(raw)] as RecordEntry[];
    const seen = new Set<string>();
    next.set(key, JSON.stringify(merged.filter(r => {
      const id = JSON.stringify([r.score, r.rows, r.playedAt, r.durationMs]);
      if (seen.has(id)) return false;
      seen.add(id); return true;
    })));
  }
  try {
    for (const [key, raw] of next) {
      storage.setItem(key, raw);
      if (storage.getItem(key) !== raw) throw Error('Storage unavailable');
    }
  } catch (error) {
    for (const [key, raw] of before) {
      try { if (raw === null) storage.removeItem(key); else storage.setItem(key, raw); } catch { /* Preserve what storage permits. */ }
    }
    throw error;
  }
}
