import { SafeError, describeError } from './utils/errors';
import type { InstagramAccountConfig } from './config';
import { resolveSyncablePost, type InstagramAccountFeed, type SyncableInstagramPost } from './services/instagram';
import type { StateStore } from './utils/state';

export interface SyncDependencies {
  state: StateStore;
  fetchFeed(accountId: string, checkpoint?: string): Promise<InstagramAccountFeed>;
  prepare(post: SyncableInstagramPost): Promise<{ mediaId: string; text: string }>;
  publish(prepared: { mediaId: string; text: string }): Promise<{ id: string }>;
  preview(caption: string): string;
  log(message: string): void;
  checkpoint?(): Promise<void>;
}

export const runSync = async (
  accounts: InstagramAccountConfig[], deps: SyncDependencies, dryRun: boolean,
): Promise<{ failures: number; published: number }> => {
  let failures = 0;
  let published = 0;
  for (const account of accounts) {
    let stage = 'lectura de Meta';
    try {
      if (deps.state.getAccount(account.id)?.pendingPost) {
        throw new SafeError('Publicación incierta: verificá X y ejecutá npm run recover.');
      }
      const checkpoint = deps.state.getAccount(account.id)?.lastPostId;
      const feed = await deps.fetchFeed(account.id, checkpoint);
      const candidates = feed.posts.map(resolveSyncablePost).filter(
        (post): post is SyncableInstagramPost => post !== null && !deps.state.has(account.id, post.id),
      ).reverse();
      for (const post of candidates) {
        if (dryRun) {
          stage = 'formato del caption';
          deps.log(`[DRY-RUN] ${account.label} / ${post.id}: ${deps.preview(post.caption)}`);
          continue;
        }
        stage = 'preparación de imagen y media X';
        const prepared = await deps.prepare(post);
        // Do not automatically retry after this boundary: the remote outcome may be unknown.
        stage = 'registro previo de estado';
        deps.state.begin(account.id, post.id);
        await deps.checkpoint?.();
        stage = 'creación en X';
        const tweet = await deps.publish(prepared);
        stage = 'confirmación de estado';
        deps.state.mark(account.id, { lastPostId: post.id, lastTweetId: tweet.id,
          lastSyncedAt: new Date().toISOString(), username: feed.username });
        await deps.checkpoint?.();
        published++;
        deps.log(`Publicado ${post.id}: https://x.com/i/web/status/${tweet.id}`);
      }
      if (!candidates.length) deps.log(`${account.label}: sin publicaciones pendientes.`);
    } catch (error) {
      failures++;
      deps.log(`Falló ${account.label} (${stage}): ${describeError(error)}`);
      if (deps.state.getAccount(account.id)?.pendingPost) {
        deps.log('Cuenta bloqueada por publicación incierta. Verificá X y usá npm run recover antes de reanudar.');
      }
    }
  }
  return { failures, published };
};

