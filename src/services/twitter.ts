import { TwitterApi } from 'twitter-api-v2';
import { config } from '../config';
import { downloadImageAsBuffer } from '../utils/image';
import { formatTweetCaption } from '../utils/caption';
export { formatTweetCaption } from '../utils/caption';

const client = new TwitterApi({ appKey: config.twitter.apiKey, appSecret: config.twitter.apiSecret,
  accessToken: config.twitter.accessToken, accessSecret: config.twitter.accessSecret });

export const prepareTweet = async (imageUrl: string, caption: string): Promise<{ mediaId: string; text: string }> => {
  const text = formatTweetCaption(caption);
  const { buffer, mimeType } = await downloadImageAsBuffer(imageUrl);
  const mediaId = await client.v1.uploadMedia(buffer, { mimeType });
  return { mediaId, text };
};

export const publishTweet = async (prepared: { mediaId: string; text: string }): Promise<{ id: string }> => {
  const response = await client.v2.tweet({ text: prepared.text, media: { media_ids: [prepared.mediaId] } });
  return response.data;
};
