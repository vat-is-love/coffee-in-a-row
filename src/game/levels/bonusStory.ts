import { bonusStoryAsset, promoCodePattern } from './promoCode';
import { loadStory, type StoryConfig } from './story';

export async function loadBonusStory(code: string): Promise<StoryConfig> {
  if (!promoCodePattern.test(code)) throw new DOMException('Invalid code', 'OperationError');
  const bytes = Uint8Array.from(code.match(/../g)!, pair => parseInt(pair, 16));
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
  const response = await fetch(new URL(import.meta.env.BASE_URL + bonusStoryAsset, document.baseURI), {
    signal: AbortSignal.timeout?.(10000)
  });
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw Error('Campaign unavailable');
  const encrypted = await response.arrayBuffer();
  if (encrypted.byteLength < 28) throw Error('Invalid campaign package');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: encrypted.slice(0, 12) }, key, encrypted.slice(12));
  const config = JSON.parse(new TextDecoder().decode(plaintext)) as StoryConfig;
  loadStory(config);
  return config;
}
