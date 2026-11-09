import { readRecords } from './storage';
import { t, getPreferences } from './preferences';
export const FALLING_RECORDS_KEY = 'coffee-falling-records';

interface FallingRecord {
  score: number;
  rows: number;
  durationMs?: number;
  playedAt: number;
}

function isRecord(value: unknown): value is FallingRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as FallingRecord;
  return Number.isSafeInteger(record.score) && record.score >= 0 &&
    Number.isSafeInteger(record.rows) && record.rows >= 0 &&
    Number.isSafeInteger(record.playedAt) && record.playedAt >= 0 && record.playedAt <= 8640000000000000;
}

export const CLASSIC_RECORDS_KEY = 'coffee-classic-records';

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${Math.floor(ms % 1000 / 100)}`;
}

export function showClassicLeaderboard(score: number, durationMs: number, restart: () => void): () => void {
  return showLeaderboard(score, 0, restart, Math.round(durationMs));
}

/** Returns cleanup so scene shutdown also removes the native modal. */
export function showFallingLeaderboard(score: number, rows: number, restart: () => void): () => void {
  return showLeaderboard(score, rows, restart);
}

function showLeaderboard(score: number, rows: number, restart: () => void, durationMs?: number): () => void {
  const classic = durationMs !== undefined;
  const key = classic ? CLASSIC_RECORDS_KEY : FALLING_RECORDS_KEY;
  const stored = readRecords(key, (value): value is FallingRecord => isRecord(value) &&
    (!classic || (Number.isSafeInteger(value.durationMs) && value.durationMs! >= 0)));
  const records = stored.records;
  const current: FallingRecord = { score, rows, playedAt: Date.now(), ...(classic ? { durationMs } : {}) };
  records.push(current);
  records.sort((a, b) => (classic
    ? a.durationMs! - b.durationMs! || b.score - a.score
    : b.score - a.score || b.rows - a.rows) || a.playedAt - b.playedAt);
  let saved = true;
  try { if (!stored.writable) throw new Error('Original preserved'); localStorage.setItem(key, JSON.stringify(records)); }
  catch { saved = false; }
  const rank = records.indexOf(current);
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog falling-leaderboard';
  dialog.setAttribute('aria-labelledby', 'falling-results-title');
  dialog.innerHTML = `
    <h1 id="falling-results-title">${t(classic ? 'Board cleared · Top 10' : 'Game over · Top 10')}</h1>
    <p>${t('Best results on this device. Your result is highlighted.')}</p>
    <div class="leaderboard-scroll">
      <table><thead><tr><th scope="col">#</th><th scope="col">${t(classic ? 'Time' : 'Rows')}</th><th scope="col">${t('Score')}</th><th scope="col">${t('Date / time')}</th></tr></thead><tbody></tbody></table>
    </div>
    <p class="leaderboard-save-status"></p>
    <div class="settings-actions"><button class="primary" type="button">${t('Start again')}</button></div>`;
  const body = dialog.querySelector('tbody')!;
  const appendRecord = (record: FallingRecord, index: number) => {
    const row = document.createElement('tr');
    if (record === current) {
      row.className = 'current-result';
      row.setAttribute('aria-current', 'true');
    }
    for (const value of [index + 1, classic ? formatDuration(record.durationMs!) : record.rows, record.score, new Date(record.playedAt).toLocaleString(getPreferences().language, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })]) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.append(cell);
    }
    body.append(row);
  };
  records.slice(0, 10).forEach(appendRecord);
  if (rank >= 10) {
    const gap = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = '···';
    gap.className = 'leaderboard-gap';
    gap.append(cell);
    body.append(gap);
    appendRecord(current, rank);
  }
  const status = dialog.querySelector<HTMLElement>('.leaderboard-save-status')!;
  status.hidden = saved;
  status.textContent = t('This result could not be saved on this device.');
  dialog.addEventListener('cancel', event => event.preventDefault());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('keyup', event => event.stopPropagation());
  dialog.querySelector('button')!.addEventListener('click', () => {
    dialog.close();
    dialog.remove();
    restart();
  });
  document.body.append(dialog);
  dialog.showModal();
  return () => dialog.remove();
}
