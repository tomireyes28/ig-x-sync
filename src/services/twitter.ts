import { SafeError } from '../utils/errors';
import { TwitterApi } from 'twitter-api-v2';
import type { TwitterCredentials } from '../config';
import { downloadImageAsBuffer, type DownloadedImage } from '../utils/image';
import { formatTweetCaption } from '../utils/caption';

export interface PreparedTweet { mediaId: string; text: string }
export interface TwitterPort {
  v1: { uploadMedia(buffer: Buffer, options: { mimeType: string }): Promise<string> };
  v2: { tweet(payload: { text: string; media: { media_ids: [string] } }): Promise<{ data: { id: string } }> };
}

export const createTwitterService = (
  credentials: TwitterCredentials,
  client: TwitterPort = new TwitterApi({ appKey: credentials.apiKey, appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken, accessSecret: credentials.accessSecret }),
  download: (url: string) => Promise<DownloadedImage> = downloadImageAsBuffer,
) => ({
  async prepareTweet(imageUrl: string, caption: string): Promise<PreparedTweet> {
    const text = formatTweetCaption(caption);
    const { buffer, mimeType } = await download(imageUrl);
    const mediaId = await client.v1.uploadMedia(buffer, { mimeType });
    return { mediaId, text };
  },
  async publishTweet(prepared: PreparedTweet): Promise<{ id: string }> {
    const response = await client.v2.tweet({ text: prepared.text, media: { media_ids: [prepared.mediaId] } });
    if (!/^\d+$/.test(response.data?.id ?? '')) throw new SafeError('X devolvió un resultado de publicación inválido.');
    return response.data;
  },
});

