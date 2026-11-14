import { getState, normalizeWithReport, replaceState } from './store';
import type { AppState } from './types';
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

export interface BackupPreview {
  state: AppState;
  /** Items in the file that could not be read and will be left out. */
  dropped: number;
  exportedAt: string | null;
}

/**
 * Read and check a backup file without changing anything. Throws with a readable message if it is
 * not a Logbook backup. The caller shows a summary and only then calls `applyBackup`.
 */
export async function readBackup(file: File): Promise<BackupPreview> {
  let parsed: any;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const raw = parsed?.app === 'logbook' ? parsed.state : parsed;
  const looksLikeLogbook =
    raw && typeof raw === 'object' && ['workouts', 'entries', 'bodyWeights', 'routines'].some((k) => Array.isArray(raw[k]));
  if (!looksLikeLogbook) {
    throw new Error('That file is not a Logbook backup.');
  }
  const { state, dropped } = normalizeWithReport(raw);
  return { state, dropped, exportedAt: typeof parsed?.exportedAt === 'string' ? parsed.exportedAt : null };
}

export const applyBackup = (preview: BackupPreview) => replaceState(preview.state);
