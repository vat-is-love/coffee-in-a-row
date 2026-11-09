import { describe, it, expect, vi } from 'vitest';
import { readRecords } from '../../src/ui/storage';
const valid = (v: unknown): v is number => typeof v === 'number';
describe('record preservation', () => {
  it('keeps legacy records', () => {
    vi.stubGlobal('localStorage', { getItem: () => '[42,99]' });
    expect(readRecords('records', valid)).toEqual({ records: [42,99], writable: true });
    vi.unstubAllGlobals();
  });
  it('backs up exact corrupt data before replacement', () => {
    const data = new Map([['records', '{broken']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => data.set(k,v) });
    expect(readRecords('records', valid).writable).toBe(true);
    expect([...data.values()]).toEqual(['{broken','{broken']);
    vi.unstubAllGlobals();
  });
  it('forbids overwrite when backup fails', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken', setItem: () => { throw Error(); } });
    expect(readRecords('records', valid).writable).toBe(false);
    vi.unstubAllGlobals();
  });
});
