import { getState, normalize, replaceState } from './store';
import { today } from './date';

export function exportData() {
  const payload = { app: 'logbook', exportedAt: new Date().toISOString(), state: getState() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logbook-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replace everything with the contents of a backup file. Throws with a readable message if it is not one. */
export async function importData(file: File) {
  let parsed: any;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const raw = parsed?.app === 'logbook' ? parsed.state : parsed;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.workouts) || !Array.isArray(raw.entries)) {
    throw new Error('That file is not a Logbook backup.');
  }
  replaceState(normalize(raw));
}
