import axios from 'axios';
import { config } from '../config';

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

export interface InstagramMediaChild {
  id: string;
  media_type: InstagramMediaType;
  media_url?: string;
}

export interface InstagramMedia {
  id: string;
  media_type: InstagramMediaType;
  media_url?: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  children?: {
    data: InstagramMediaChild[];
  };
}

export interface InstagramAccountFeed {
  username: string;
  mediaCount: number;
  posts: InstagramMedia[];
}

export interface SyncableInstagramPost {
  id: string;
  imageUrl: string;
  caption: string;
  mediaType: 'IMAGE' | 'CAROUSEL_ALBUM';
  permalink?: string;
  timestamp?: string;
}

interface InstagramGraphResponse {
  username?: string;
  media_count?: number;
  media?: {
    data: InstagramMedia[];
  };
}

const GRAPH_FIELDS =
  'username,media_count,media{id,caption,media_type,media_url,permalink,timestamp,children{id,media_type,media_url}}';

/**
 * Fetches the latest media items from an Instagram Business account via Meta Graph API.
 */
export const fetchAccountFeed = async (accountId: string): Promise<InstagramAccountFeed> => {
  try {
    const url = `https://graph.facebook.com/${config.meta.apiVersion}/${accountId}`;

    const response = await axios.get<InstagramGraphResponse>(url, {
      params: {
        fields: GRAPH_FIELDS,
        access_token: config.meta.accessToken,
      },
      timeout: 15_000,
    });

    return {
      username: response.data.username ?? accountId,
      mediaCount: response.data.media_count ?? 0,
      posts: response.data.media?.data ?? [],
    };
  } catch (error) {
    console.error(`❌ Error consultando Meta Graph API para la cuenta ${accountId}:`);
    if (axios.isAxiosError(error)) {
      console.error(error.response?.data || error.message);
    }
    throw error;
  }
};

/**
 * Backwards-compatible wrapper that returns only the media array for an account.
 */
export const fetchLatestPosts = async (accountId: string): Promise<InstagramMedia[]> => {
  const feed = await fetchAccountFeed(accountId);
  return feed.posts;
};

/**
 * Resolves the first publishable image post (IMAGE or CAROUSEL_ALBUM) from an Instagram media item.
 * Returns null if the item is a VIDEO/Reel or has no valid image URL.
 */
export const resolveSyncablePost = (media: InstagramMedia): SyncableInstagramPost | null => {
  if (media.media_type === 'IMAGE' && media.media_url) {
    return {
      id: media.id,
      imageUrl: media.media_url,
      caption: media.caption?.trim() || '',
      mediaType: 'IMAGE',
      permalink: media.permalink,
      timestamp: media.timestamp,
    };
  }

  if (media.media_type === 'CAROUSEL_ALBUM') {
    const firstImageChild = media.children?.data.find(
      (child) => child.media_type === 'IMAGE' && Boolean(child.media_url)
    );
    const imageUrl = firstImageChild?.media_url || media.media_url;

    if (imageUrl) {
      return {
        id: media.id,
        imageUrl,
        caption: media.caption?.trim() || '',
        mediaType: 'CAROUSEL_ALBUM',
        permalink: media.permalink,
        timestamp: media.timestamp,
      };
    }
  }

  return null;
};
