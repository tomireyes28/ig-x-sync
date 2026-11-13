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
}

export const runSync = async (
  accounts: InstagramAccountConfig[], deps: SyncDependencies, dryRun: boolean,
): Promise<{ failures: number; published: number }> => {
  let failures = 0;
  let published = 0;
  for (const account of accounts) {
    try {
      if (deps.state.getAccount(account.id)?.pendingPost) {
        throw new Error('Publicación incierta: verificá X y ejecutá npm run recover.');
      }
      const checkpoint = deps.state.getAccount(account.id)?.lastPostId;
      const feed = await deps.fetchFeed(account.id, checkpoint);
      const candidates = feed.posts.map(resolveSyncablePost).filter(
        (post): post is SyncableInstagramPost => post !== null && !deps.state.has(account.id, post.id),
      ).reverse();
      for (const post of candidates) {
        if (dryRun) {
          deps.log(`[DRY-RUN] ${account.label} / ${post.id}: ${deps.preview(post.caption)}`);
          continue;
        }
        const prepared = await deps.prepare(post);
        // Do not automatically retry after this boundary: the remote outcome may be unknown.
        deps.state.begin(account.id, post.id);
        const tweet = await deps.publish(prepared);
        deps.state.mark(account.id, { lastPostId: post.id, lastTweetId: tweet.id,
          lastSyncedAt: new Date().toISOString(), username: feed.username });
        published++;
        deps.log(`Publicado ${post.id}: https://x.com/i/web/status/${tweet.id}`);
      }
      if (!candidates.length) deps.log(`${account.label}: sin publicaciones pendientes.`);
    } catch {
      failures++;
      deps.log(`Falló la sincronización de ${account.label}; las demás cuentas continúan.`);
    }
  }
  return { failures, published };
};
