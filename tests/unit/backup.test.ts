import { expect, test } from 'vitest';
import { BACKUP_KEYS, createBackup, parseBackup, restoreBackup } from '../../src/ui/backupData';
function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); } } as Storage;
}
const record = { score: 200, rows: 10, playedAt: 1000 };
test('snapshot contains only preferences and both record sets, including an empty first launch', () => {
  const s = storage();
  expect(createBackup(s).data).toEqual({});
  s.setItem(BACKUP_KEYS[0], JSON.stringify({ language: 'ru', vibration: true, mode: 'falling' }));
  s.setItem(BACKUP_KEYS[1], JSON.stringify([record]));
  s.setItem(BACKUP_KEYS[2], JSON.stringify([{ ...record, durationMs: 100 }]));
  s.setItem('diagnostics', 'private');
  expect(Object.keys(createBackup(s).data)).toEqual([...BACKUP_KEYS]);
});
test('invalid, future and oversized backups are refused before changing storage', () => {
  const s = storage();
  s.setItem(BACKUP_KEYS[1], JSON.stringify([record]));
  const b = createBackup(s);
  for (const bad of [{ ...b, version: 2 }, { ...b, data: { unrelated: '[]' } },
    { ...b, data: { [BACKUP_KEYS[2]]: JSON.stringify([record]) } },
    { ...b, data: { [BACKUP_KEYS[1]]: '[{"score":-1}]' } },
    { ...b, data: { [BACKUP_KEYS[0]]: '{"language":"ru"}' } }]) {
    expect(() => restoreBackup(s, bad as typeof b)).toThrow();
    expect(s.getItem(BACKUP_KEYS[1])).toBe(JSON.stringify([record]));
  }
  expect(() => parseBackup(' '.repeat(4 * 1024 * 1024 + 1))).toThrow();
});
test('restore merges results without duplicates and imports settings', () => {
  const source = storage(); const target = storage();
  source.setItem(BACKUP_KEYS[0], JSON.stringify({ version: 1, language: 'ru', vibration: false, mode: 'falling', storyMode: true }));
  source.setItem(BACKUP_KEYS[1], JSON.stringify([record]));
  const newer = { ...record, playedAt: 2000, score: 500 };
  target.setItem(BACKUP_KEYS[1], JSON.stringify([newer, record]));
  const b = createBackup(source);
  restoreBackup(target, b); restoreBackup(target, b);
  expect(JSON.parse(target.getItem(BACKUP_KEYS[1])!)).toEqual([newer, record]);
  expect(target.getItem(BACKUP_KEYS[0])).toBe(source.getItem(BACKUP_KEYS[0]));
});
test('failed restore rolls back settings and records, and corrupt local records are preserved', () => {
  const source = storage(); const target = storage();
  source.setItem(BACKUP_KEYS[0], JSON.stringify({ language: 'ru', vibration: true }));
  source.setItem(BACKUP_KEYS[1], JSON.stringify([record]));
  const old = JSON.stringify({ language: 'en', vibration: false });
  target.setItem(BACKUP_KEYS[0], old);
  const set = target.setItem.bind(target);
  target.setItem = (key, value) => { if (key === BACKUP_KEYS[1]) throw Error('quota'); set(key, value); };
  expect(() => restoreBackup(target, createBackup(source))).toThrow();
  expect(target.getItem(BACKUP_KEYS[0])).toBe(old);
  expect(target.getItem(BACKUP_KEYS[1])).toBeNull();
  target.setItem = set;
  target.setItem(BACKUP_KEYS[1], 'corrupt');
  expect(() => restoreBackup(target, createBackup(source))).toThrow();
  expect(target.getItem(BACKUP_KEYS[1])).toBe('corrupt');
  expect(target.getItem(BACKUP_KEYS[0])).toBe(old);
});
