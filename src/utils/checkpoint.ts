import { spawnSync } from 'node:child_process';
import { SafeError } from './errors';

export type GitRunner = (args: string[]) => number;
const runGit: GitRunner = args => {
  const result = spawnSync('git', args, { stdio: 'pipe', timeout: 60_000, windowsHide: true });
  // Never log subprocess stderr: a remote URL or credential helper can expose secrets.
  return result.status ?? -1;
};

/** Refuse to create a post unless its pending marker has reached the shared Git remote. */
export const createRemoteCheckpoint = (branch: string, git: GitRunner = runGit): (() => Promise<void>) => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || git(['check-ref-format', '--branch', branch]) !== 0) {
    throw new SafeError('Rama inválida para persistir el estado remoto.');
  }
  const must = (args: string[]): void => {
    if (git(args) !== 0) throw new SafeError('No se pudo persistir el estado en GitHub. Revisá la rama remota antes de reanudar.');
  };
  return async () => {
    must(['add', '--', 'data/sync-state.json']);
    const diff = git(['diff', '--cached', '--quiet', '--', 'data/sync-state.json']);
    if (diff !== 0 && diff !== 1) throw new SafeError('No se pudo inspeccionar el estado preparado para Git.');
    if (diff === 1) must(['-c', 'user.name=github-actions[bot]', '-c',
      'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '--only',
      '-m', 'chore(state): checkpoint Instagram synchronization [skip ci]', '--', 'data/sync-state.json']);
    // Push even without a diff: a previous attempt may have committed locally but failed to push.
    must(['push', 'origin', `HEAD:refs/heads/${branch}`]);
  };
};
