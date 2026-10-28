import { config, InstagramAccountConfig } from './config';
import { fetchAccountFeed, resolveSyncablePost } from './services/instagram';
import { formatTweetCaption, postToTwitter } from './services/twitter';
import { isPostAlreadySynced, markPostAsSynced } from './utils/state';

const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

/**
 * Synchronizes a single Instagram Business account to X.
 * Isolated so that a failure on one account does not block remaining accounts.
 */
const syncInstagramAccount = async (account: InstagramAccountConfig): Promise<void> => {
  console.log(`\n──────────────────────────────────────────────────────────`);
  console.log(`🔎 Consultando cuenta: ${account.label} (ID: ${account.id})...`);

  const feed = await fetchAccountFeed(account.id);
  console.log(`📊 Usuario: @${feed.username} | Publicaciones totales: ${feed.mediaCount}`);

  if (feed.posts.length === 0) {
    console.log(`ℹ️ No se encontraron publicaciones en @${feed.username}.`);
    return;
  }

  // Buscamos el posteo más reciente que sea compatible (IMAGE o CAROUSEL_ALBUM)
  let latestSyncablePost = null;
  for (const media of feed.posts) {
    const candidate = resolveSyncablePost(media);
    if (candidate) {
      latestSyncablePost = candidate;
      break;
    }
    console.log(
      `⏭️ Ignorando publicación ${media.id} de tipo ${media.media_type} (solo se sincronizan imágenes y carruseles).`
    );
  }

  if (!latestSyncablePost) {
    console.log(`ℹ️ No se encontraron publicaciones de imagen o carrusel recientes en @${feed.username}.`);
    return;
  }

  if (isPostAlreadySynced(account.id, latestSyncablePost.id)) {
    console.log(
      `✅ @${feed.username} ya está al día. El último post elegible (${latestSyncablePost.id}) ya fue publicado en X.`
    );
    return;
  }

  console.log(
    `✨ Nuevo post detectado en @${feed.username}: ID ${latestSyncablePost.id} (${latestSyncablePost.mediaType})`
  );
  if (latestSyncablePost.permalink) {
    console.log(`🔗 Origen IG: ${latestSyncablePost.permalink}`);
  }

  const previewText = formatTweetCaption(latestSyncablePost.caption);

  if (isDryRun) {
    console.log(`🧪 [DRY-RUN] Se omitió la publicación en X.`);
    console.log(`📝 [DRY-RUN] Texto que se publicaría (${previewText.length} chars):\n"${previewText}"`);
    return;
  }

  const tweet = await postToTwitter(latestSyncablePost.imageUrl, latestSyncablePost.caption);

  markPostAsSynced(account.id, {
    lastPostId: latestSyncablePost.id,
    lastTweetId: tweet.id,
    lastSyncedAt: new Date().toISOString(),
    username: feed.username,
  });

  console.log(`🎉 ¡Publicado con éxito en X! Link: https://x.com/i/web/status/${tweet.id}`);
};

const run = async (): Promise<void> => {
  console.log(
    `🚀 Iniciando sincronización IG -> X (${config.meta.accounts.length} cuentas configuradas)${
      isDryRun ? ' [MODO DRY-RUN]' : ''
    }`
  );

  let failures = 0;

  for (const account of config.meta.accounts) {
    try {
      await syncInstagramAccount(account);
    } catch (error) {
      failures += 1;
      console.error(`💥 Falló la sincronización para la cuenta ${account.label} (${account.id}).`);
    }
  }

  console.log(`\n──────────────────────────────────────────────────────────`);
  if (failures > 0) {
    console.error(`⚠️ Sincronización finalizada con ${failures} error(es).`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Proceso de sincronización finalizado correctamente.`);
  }
};

run();
