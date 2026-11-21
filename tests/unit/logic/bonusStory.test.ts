import { createCipheriv, randomBytes } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { loadBonusStory } from '../../../src/game/levels/bonusStory';
import fixture from '../../fixtures/bonus-story.json';

it('opens an encrypted campaign only with its code and keeps the code out of the request', async () => {
  const code = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-128-gcm', code, iv);
  const encrypted = Buffer.concat([iv, cipher.update(JSON.stringify(fixture)), cipher.final(), cipher.getAuthTag()]);
  const fetchPackage = vi.fn(async () => new Response(new Uint8Array(encrypted)));
  vi.stubGlobal('fetch', fetchPackage);
  vi.stubGlobal('document', { baseURI: 'https://game.example/' });
  try {
    await expect(loadBonusStory('wrong')).rejects.toMatchObject({ name: 'OperationError' });
    expect(fetchPackage).not.toHaveBeenCalled();
    await expect(loadBonusStory(randomBytes(16).toString('hex'))).rejects.toMatchObject({ name: 'OperationError' });
    await expect(loadBonusStory(code.toString('hex'))).resolves.toEqual(fixture);
    expect(fetchPackage).toHaveBeenLastCalledWith(new URL('https://game.example/on-demand/campaign.bin'), expect.anything());
  } finally {
    vi.unstubAllGlobals();
  }
});
