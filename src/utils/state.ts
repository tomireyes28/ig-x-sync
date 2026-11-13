import { SafeError } from './errors';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface AccountSyncRecord {
  lastPostId?: string;
  lastTweetId?: string;
  lastSyncedAt?: string;
  username?: string;
  syncedPostIds?: string[];
  pendingPost?: { postId: string; startedAt: string };
}

export type SyncStateMap = Record<string, AccountSyncRecord>;
export const STATE_FILE_PATH = path.resolve(process.cwd(), 'data', 'sync-state.json');
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && /^\d+$/.test(value);
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const validateState = (parsed: unknown): SyncStateMap => {
  if (!isObject(parsed)) throw new SafeError('El estado debe ser un objeto de cuentas.');
  for (const [accountId, record] of Object.entries(parsed)) {
    if (!isId(accountId) || !isObject(record) ||
        (record.lastPostId === undefined ? record.pendingPost === undefined || record.lastSyncedAt !== undefined
          : !isId(record.lastPostId) || !isDate(record.lastSyncedAt)) ||
        (record.lastTweetId !== undefined && (!isId(record.lastTweetId) || record.lastPostId === undefined)) ||
        (record.username !== undefined && typeof record.username !== 'string') ||
        (record.syncedPostIds !== undefined && (!Array.isArray(record.syncedPostIds) ||
          !record.syncedPostIds.every(isId) || !isId(record.lastPostId) ||
          !record.syncedPostIds.includes(record.lastPostId))) ||
        (record.pendingPost !== undefined && (!isObject(record.pendingPost) ||
          !isId(record.pendingPost.postId) || !isDate(record.pendingPost.startedAt)))) {
      throw new SafeError('Esquema de estado inválido; se cancela para evitar duplicados.');
    }
  }
  return parsed as SyncStateMap;
};

export const loadSyncState = (filePath = STATE_FILE_PATH): SyncStateMap => {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new SafeError('No se pudo leer el estado; se cancela para evitar duplicados.');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw new SafeError('JSON de estado corrupto; restaurá una copia antes de publicar.');
  }
  return validateState(parsed);
};

/** Write to the same directory, flush, then atomically replace the previous file. */
export const saveSyncState = (state: SyncStateMap, filePath = STATE_FILE_PATH): void => {
  validateState(state);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
};

export const createStateStore = (filePath = STATE_FILE_PATH) => {
  let state = loadSyncState(filePath);
  return {
    getAccount(accountId: string): AccountSyncRecord | undefined {
      return state[accountId] ? structuredClone(state[accountId]) : undefined;
    },
    has(accountId: string, postId: string): boolean {
      const record = state[accountId];
      return record?.lastPostId === postId || Boolean(record?.syncedPostIds?.includes(postId));
    },
    begin(accountId: string, postId: string): void {
      if (state[accountId]?.pendingPost) throw new SafeError('La cuenta tiene una publicación incierta; requiere recuperación.');
      const next = { ...state, [accountId]: { ...state[accountId],
        pendingPost: { postId, startedAt: new Date().toISOString() } } };
      saveSyncState(next, filePath);
      state = next;
    },
    clearPending(accountId: string): void {
      if (!state[accountId]?.pendingPost) throw new SafeError('La cuenta no tiene una publicación incierta.');
      const next = structuredClone(state);
      delete next[accountId].pendingPost;
      if (!next[accountId].lastPostId) delete next[accountId];
      saveSyncState(next, filePath);
      state = next;
    },
    mark(accountId: string, record: AccountSyncRecord): void {
      const previous = state[accountId];
      const syncedPostIds = [...new Set([
        ...(previous?.syncedPostIds ?? []),
        ...(previous?.lastPostId ? [previous.lastPostId] : []),
        record.lastPostId,
      ].filter((id): id is string => id !== undefined))];
      const next = { ...state, [accountId]: { ...record, syncedPostIds } };
      saveSyncState(next, filePath);
      state = next;
    },
  };
};

export type StateStore = ReturnType<typeof createStateStore>;
export const isPostAlreadySynced = (accountId: string, postId: string): boolean =>
  createStateStore().has(accountId, postId);
export const markPostAsSynced = (accountId: string, record: AccountSyncRecord): void =>
  createStateStore().mark(accountId, record);

