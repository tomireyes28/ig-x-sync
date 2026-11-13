import { TwitterApi } from 'twitter-api-v2';
import { config } from '../config';
import { downloadImageAsBuffer } from '../utils/image';

const client = new TwitterApi({ appKey: config.twitter.apiKey, appSecret: config.twitter.apiSecret,
  accessToken: config.twitter.accessToken, accessSecret: config.twitter.accessSecret });

export const formatTweetCaption = (caption: string, maxLength = 280): string => {
  const normalized = caption.trim() || 'Nueva actualización';
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

export const prepareTweet = async (imageUrl: string, caption: string): Promise<{ mediaId: string; text: string }> => {
  const { buffer, mimeType } = await downloadImageAsBuffer(imageUrl);
  const mediaId = await client.v1.uploadMedia(buffer, { mimeType });
  return { mediaId, text: formatTweetCaption(caption) };
};

export const publishTweet = async (prepared: { mediaId: string; text: string }): Promise<{ id: string }> => {
  const response = await client.v2.tweet({ text: prepared.text, media: { media_ids: [prepared.mediaId] } });
  return response.data;
};
