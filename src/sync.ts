import type { InstagramAccountConfig } from './config';
import { resolveSyncablePost, type InstagramAccountFeed, type SyncableInstagramPost } from './services/instagram';
import type { StateStore } from './utils/state';

export interface SyncDependencies {
  state: StateStore;
  fetchFeed(accountId: string, checkpoint?: string): Promise<InstagramAccountFeed>;
  publish(post: SyncableInstagramPost): Promise<{ id: string }>;
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
        const tweet = await deps.publish(post);
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
