/** Never log stored values. Preserve corrupt records before any replacement. */
export function readRecords<T>(key: string, valid: (value: unknown) => value is T): { records: T[]; writable: boolean } {
  let raw: string | null;
  try { raw = localStorage.getItem(key); }
  catch { globalThis.window?.CoffeeRecovery?.log('storage', 'read-unavailable'); return { records: [], writable: false }; }
  if (raw === null) return { records: [], writable: true };
  try {
    const parsed: unknown = JSON.parse(raw);
    // Legacy arrays remain the on-disk format (version 0).
    if (!Array.isArray(parsed) || !parsed.every(valid)) throw new Error('Invalid records');
    return { records: parsed, writable: true };
  } catch {
    globalThis.window?.CoffeeRecovery?.log('storage', 'invalid-records');
    try {
      const backup = key + '-recovery-' + Date.now();
      localStorage.setItem(backup, raw);
      if (localStorage.getItem(backup) !== raw) throw new Error('Backup failed');
      return { records: [], writable: true };
    } catch { return { records: [], writable: false }; }
  }
}

export function notifyDataChanged(): void {
  globalThis.window?.dispatchEvent?.(new Event('coffee-data-changed'));
}
