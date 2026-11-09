// Register only for a production build. Updates activate after all game windows close.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(error => console.error('Offline support could not be enabled', error));
  });
}

/** The wrapper adds this marker; Android browsers do not. */
export function isAndroidApp(): boolean {
  return /CoffeeAPK\//.test(navigator.userAgent);
}

/** Activate only a completely installed, integrity-checked build. Keep the old cache on failure. */
export async function updateGame(): Promise<'current' | 'reloading'> {
  if (!navigator.onLine || !('serviceWorker' in navigator)) throw new Error('Update unavailable');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let finished = false;
  let cleanup = () => {};
  try {
    return await Promise.race([
      (async () => {
        const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
        if (!registration) throw new Error('Offline support unavailable');
        await registration.update();
        if (finished) throw new Error('Update timeout');
        return await new Promise<'current' | 'reloading'>((resolve, reject) => {
          let activating = false;
          const check = () => {
            if (activating) {
              if (registration.active?.state === 'activated' && !registration.waiting) {
                window.location.reload();
                resolve('reloading');
              }
              return;
            }
            if (registration.waiting) {
              activating = true;
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else if (!registration.installing) resolve('current');
            else if (registration.installing.state === 'redundant') reject(new Error('Installation failed'));
          };
          // Track installation failures even after registration.installing becomes null.
          const installing = registration.installing;
          const stateChanged = () => {
            if (installing?.state === 'redundant') reject(new Error('Installation failed'));
          };
          installing?.addEventListener('statechange', stateChanged);
          cleanup = () => installing?.removeEventListener('statechange', stateChanged);
          poll = setInterval(check, 100);
          check();
        });
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Update timeout')), 30000); })
    ]);
  } finally {
    finished = true;
    cleanup();
    clearTimeout(timer);
    clearInterval(poll);
  }
}
