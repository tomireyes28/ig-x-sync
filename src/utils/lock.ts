import fs from 'node:fs';
import path from 'node:path';
import { STATE_FILE_PATH } from './state';

/** Never remove another process's lock automatically: a stale lock needs operator review. */
export const withStateLock = async <T>(task: () => Promise<T>, statePath = STATE_FILE_PATH): Promise<T> => {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const lockPath = `${statePath}.lock`;
  let fd: number;
  try { fd = fs.openSync(lockPath, 'wx', 0o600); } catch {
    throw new Error('No se pudo adquirir el bloqueo de estado; revisá procesos activos y permisos.');
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return await task();
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lockPath);
  }
};
