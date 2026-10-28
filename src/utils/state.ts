import fs from 'fs';
import path from 'path';

export interface AccountSyncRecord {
  lastPostId: string;
  lastTweetId?: string;
  lastSyncedAt: string;
  username?: string;
}

export type SyncStateMap = Record<string, AccountSyncRecord>;

const STATE_FILE_PATH = path.resolve(process.cwd(), 'data', 'sync-state.json');

/**
 * Reads the persisted synchronization state from disk.
 * Returns an empty object if the state file does not exist yet.
 */
export const loadSyncState = (): SyncStateMap => {
  try {
    if (!fs.existsSync(STATE_FILE_PATH)) {
      return {};
    }

    const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
    return JSON.parse(raw) as SyncStateMap;
  } catch (error) {
    console.warn('⚠️ No se pudo leer data/sync-state.json, iniciando estado limpio:', error);
    return {};
  }
};

/**
 * Checks whether the given Instagram post ID was already published for the account.
 */
export const isPostAlreadySynced = (accountId: string, postId: string): boolean => {
  const state = loadSyncState();
  return state[accountId]?.lastPostId === postId;
};

/**
 * Persists the latest synchronized post ID and metadata for an Instagram account.
 */
export const markPostAsSynced = (accountId: string, record: AccountSyncRecord): void => {
  const state = loadSyncState();
  state[accountId] = record;

  const dir = path.dirname(STATE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(STATE_FILE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
};
