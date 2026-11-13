import { SafeError, describeError } from './utils/errors';
import { createStateStore } from './utils/state';
import { withStateLock } from './utils/lock';

const args = process.argv.slice(2);
const usage = 'Uso: npm run recover -- --account <IG_ID> (--tweet <X_ID> | --not-published)';
const recover = async (): Promise<void> => {
  const [flag, accountId, action, tweetId] = args;
  if (flag !== '--account' || !/^\d+$/.test(accountId ?? '') ||
      !((action === '--tweet' && /^\d+$/.test(tweetId ?? '') && args.length === 4) ||
        (action === '--not-published' && args.length === 3))) throw new SafeError(usage);
  const state = createStateStore();
  const record = state.getAccount(accountId);
  if (!record?.pendingPost) throw new SafeError('No hay una publicación incierta para esa cuenta.');
  if (action === '--tweet') state.mark(accountId, {
    lastPostId: record.pendingPost.postId, lastTweetId: tweetId,
    lastSyncedAt: new Date().toISOString(), username: record.username,
  });
  else state.clearPending(accountId);
  console.log('Estado recuperado. Guardá y compartí este archivo antes de reanudar la automatización.');
};

withStateLock(recover).catch(error => {
  console.error(describeError(error));
  process.exitCode = 1;
});

