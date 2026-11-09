import { afterEach, expect, test, vi } from 'vitest';

async function setup(registration: object) {
  vi.stubGlobal('window', { addEventListener: vi.fn(), location: { reload: vi.fn() } });
  vi.stubGlobal('navigator', { onLine: true, userAgent: 'CoffeeAPK/1.0.3', serviceWorker: {
    getRegistration: vi.fn().mockResolvedValue(registration)
  } });
  return import('../../src/pwa');
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('no new build leaves the current game running', async () => {
  const { updateGame, isAndroidApp } = await setup({ update: vi.fn().mockResolvedValue(undefined) });
  expect(isAndroidApp()).toBe(true);
  expect(await updateGame()).toBe('current');
  expect(window.location.reload).not.toHaveBeenCalled();
});

test('a waiting build is activated before reloading', async () => {
  vi.useFakeTimers();
  const registration = { update: vi.fn().mockResolvedValue(undefined), waiting: { postMessage: vi.fn() }, active: { state: 'activating' } };
  const { updateGame } = await setup(registration);
  const pending = updateGame();
  await vi.advanceTimersByTimeAsync(100);
  expect(registration.waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  expect(window.location.reload).not.toHaveBeenCalled();
  Object.assign(registration, { waiting: null, active: { state: 'activated' } });
  await vi.advanceTimersByTimeAsync(100);
  expect(await pending).toBe('reloading');
  expect(window.location.reload).toHaveBeenCalledOnce();
});

test('network errors preserve the running game', async () => {
  const { updateGame } = await setup({ update: vi.fn().mockRejectedValue(new Error('offline')) });
  await expect(updateGame()).rejects.toThrow('offline');
  expect(window.location.reload).not.toHaveBeenCalled();
});
