import { config } from './config';
import { createInstagramService } from './services/instagram';
import { formatTweetCaption, postToTwitter } from './services/twitter';
import { createStateStore } from './utils/state';
import { runSync } from './sync';

const main = async (): Promise<void> => {
  const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
  const state = createStateStore();
  const instagram = createInstagramService(config.meta);
  const result = await runSync(config.meta.accounts, {
    state, fetchFeed: instagram.fetchAccountFeed,
    publish: post => postToTwitter(post.imageUrl, post.caption),
    preview: formatTweetCaption, log: console.log,
  }, isDryRun);
  console.log(`Finalizado: ${result.published} publicaciones, ${result.failures} errores.`);
  if (result.failures) process.exitCode = 1;
};

main().catch(() => {
  console.error('No se pudo iniciar la sincronización. Revisá configuración y estado.');
  process.exitCode = 1;
});
