import { TwitterApi } from 'twitter-api-v2';
import { config } from '../config';
import { downloadImageAsBuffer } from '../utils/image';

const MAX_TWEET_LENGTH = 280;

const client = new TwitterApi({
  appKey: config.twitter.apiKey,
  appSecret: config.twitter.apiSecret,
  accessToken: config.twitter.accessToken,
  accessSecret: config.twitter.accessSecret,
});

export interface PublishedTweet {
  id: string;
  text: string;
}

/**
 * Normalizes and truncates an Instagram caption so it complies with X's 280-character limit.
 */
export const formatTweetCaption = (caption: string, maxLength: number = MAX_TWEET_LENGTH): string => {
  const normalized = caption.trim();
  if (!normalized) {
    return 'Nueva actualización';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

/**
 * Downloads an image from Instagram, uploads binary media via X API v1.1,
 * and publishes the tweet via X API v2.
 */
export const postToTwitter = async (
  imageUrl: string,
  caption: string = ''
): Promise<PublishedTweet> => {
  try {
    console.log('⏳ Descargando imagen desde Instagram...');
    const { buffer, mimeType } = await downloadImageAsBuffer(imageUrl);

    console.log(`⏳ Subiendo media a los servidores de X (${mimeType})...`);
    // X requiere usar el endpoint v1.1 para subida de binarios multimedia
    const mediaId = await client.v1.uploadMedia(buffer, { mimeType });

    const safeCaption = formatTweetCaption(caption);

    console.log('⏳ Publicando posteo en X (API v2)...');
    const tweet = await client.v2.tweet({
      text: safeCaption,
      media: { media_ids: [mediaId] },
    });

    return tweet.data;
  } catch (error) {
    console.error('❌ Error interactuando con la API de X:');
    console.error(error);
    throw error;
  }
};
