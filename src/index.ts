import { SafeError, describeError } from './utils/errors';
import dotenv from 'dotenv';
import { loadConfig } from './config';
import { createInstagramService } from './services/instagram';
import { createTwitterService } from './services/twitter';
import { formatTweetCaption } from './utils/caption';
import { createStateStore } from './utils/state';
import { runSync } from './sync';
import { withStateLock } from './utils/lock';

const main = async (): Promise<void> => {
  dotenv.config({ quiet: true });
  const config = loadConfig();
  const state = createStateStore();
  const instagram = createInstagramService(config.meta);
  const twitter = config.twitter ? createTwitterService(config.twitter) : undefined;
  const result = await runSync(config.meta.accounts, {
    state, fetchFeed: instagram.fetchAccountFeed,
    prepare: post => {
      if (!twitter) throw new SafeError('No hay un cliente X configurado.');
      return twitter.prepareTweet(post.imageUrl, post.caption);
    },
    publish: prepared => {
      if (!twitter) throw new SafeError('No hay un cliente X configurado.');
      return twitter.publishTweet(prepared);
    },
    preview: formatTweetCaption, log: console.log,
  }, config.dryRun);
  console.log(`Finalizado: ${result.published} publicaciones, ${result.failures} errores.`);
  if (result.failures) process.exitCode = 1;
};

withStateLock(main).catch(error => {
  console.error(`No se pudo iniciar: ${describeError(error)}`);
  process.exitCode = 1;
});

