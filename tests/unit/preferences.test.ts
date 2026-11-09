import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

test('preferences survive reload, localize text and suppress disabled or hidden vibration', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  });
  const document = { hidden: false, documentElement: { lang: '' } };
  vi.stubGlobal('document', document);
  const vibrate = vi.fn();
  vi.stubGlobal('navigator', { vibrate });
  let prefs = await import('../../src/ui/preferences');
  prefs.vibrate('match');
  prefs.vibrate('loss');
  expect(vibrate.mock.calls).toEqual([[12], [[80, 50, 120]]]);
  prefs.savePreferences({ language: 'ru', vibration: false });
  vibrate.mockClear();
  prefs.vibrate('match');
  prefs.vibrate('loss');
  expect(vibrate).not.toHaveBeenCalled();
  vi.resetModules();
  prefs = await import('../../src/ui/preferences');
  expect(prefs.getPreferences()).toEqual({ language: 'ru', vibration: false });
  expect(prefs.t('Settings')).toBe('Настройки');
  expect(document.documentElement.lang).toBe('ru');
  prefs.savePreferences({ language: 'en', vibration: true });
  expect(prefs.t('Settings')).toBe('Settings');
  document.hidden = true;
  prefs.vibrate('loss');
  expect(vibrate).not.toHaveBeenCalled();
});

test('unavailable storage and vibration cannot interrupt gameplay', async () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
  vi.stubGlobal('document', { hidden: false, documentElement: { lang: '' } });
  vi.stubGlobal('navigator', {});
  const prefs = await import('../../src/ui/preferences');
  expect(() => prefs.vibrate('match')).not.toThrow();
  expect(() => prefs.savePreferences({ language: 'ru', vibration: false })).not.toThrow();
  expect(prefs.t('Start again')).toBe('Начать заново');
});
