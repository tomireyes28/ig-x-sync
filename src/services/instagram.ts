import axios, { AxiosInstance } from 'axios';

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
export interface InstagramMediaChild { id: string; media_type: InstagramMediaType; media_url?: string }
export interface InstagramMedia extends InstagramMediaChild {
  caption?: string;
  permalink?: string;
  timestamp?: string;
  children?: { data: InstagramMediaChild[] };
}
export interface InstagramAccountFeed { username: string; mediaCount: number; posts: InstagramMedia[] }
export interface SyncableInstagramPost {
  id: string; imageUrl: string; caption: string; mediaType: 'IMAGE' | 'CAROUSEL_ALBUM';
  permalink?: string; timestamp?: string;
}
interface MediaPage {
  data: InstagramMedia[];
  paging?: { next?: string; cursors?: { after?: string } };
}
const MEDIA_FIELDS = 'id,caption,media_type,media_url,permalink,timestamp,children.limit(100){id,media_type,media_url}';
const MAX_PAGES = 20;

export const resolveSyncablePost = (media: InstagramMedia): SyncableInstagramPost | null => {
  let imageUrl: string | undefined;
  if (media.media_type === 'IMAGE') imageUrl = media.media_url;
  if (media.media_type === 'CAROUSEL_ALBUM') {
    imageUrl = media.children?.data.find(child => child.media_type === 'IMAGE' && child.media_url)?.media_url;
  }
  if (typeof imageUrl !== 'string' || !imageUrl || media.media_type === 'VIDEO') return null;
  return { id: media.id, imageUrl, caption: media.caption?.trim() || '',
    mediaType: media.media_type, permalink: media.permalink, timestamp: media.timestamp };
};

/** Walk cursor pages until the checkpoint. A missing checkpoint must never silently lose posts. */
export const createInstagramService = (
  settings: { accessToken: string; apiVersion: string },
  http: Pick<AxiosInstance, 'get'> = axios,
) => ({
  async fetchAccountFeed(accountId: string, checkpoint?: string): Promise<InstagramAccountFeed> {
    const base = `https://graph.facebook.com/${settings.apiVersion}/${accountId}`;
    const options = {
      headers: { Authorization: `Bearer ${settings.accessToken}` },
      timeout: 15_000,
      maxRedirects: 0,
    };
    const metadata = await http.get<{ username?: string; media_count?: number }>(base, {
      ...options, params: { fields: 'username,media_count' },
    });
    const posts: InstagramMedia[] = [];
    const seen = new Set<string>();
    const cursors = new Set<string>();
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await http.get<MediaPage>(`${base}/media`, {
        ...options, params: { fields: MEDIA_FIELDS, limit: 50, ...(after ? { after } : {}) },
      });
      if (!Array.isArray(response.data?.data)) throw new Error('Respuesta de medios de Meta inválida.');
      for (const media of response.data.data) {
        if (!media || typeof media.id !== 'string' || !/^\d+$/.test(media.id) ||
            !['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'].includes(media.media_type) ||
            (media.caption !== undefined && typeof media.caption !== 'string') ||
            (media.children !== undefined && !Array.isArray(media.children?.data))) {
          throw new Error('Publicación de Meta inválida.');
        }
        if (media.id === checkpoint) return { username: metadata.data.username || accountId,
          mediaCount: metadata.data.media_count ?? 0, posts };
        if (seen.has(media.id)) continue;
        seen.add(media.id);
        posts.push(media);
        // Safe bootstrap: never flood X with the historical archive on first use.
        if (!checkpoint && resolveSyncablePost(media)) return {
          username: metadata.data.username || accountId, mediaCount: metadata.data.media_count ?? 0, posts,
        };
      }
      if (!response.data.paging?.next) {
        if (checkpoint) throw new Error('No se encontró el último post sincronizado; requiere revisión manual.');
        return { username: metadata.data.username || accountId, mediaCount: metadata.data.media_count ?? 0, posts };
      }
      after = response.data.paging.cursors?.after;
      if (!after || cursors.has(after)) throw new Error('Paginación de Meta inválida o repetida.');
      cursors.add(after);
    }
    throw new Error('Se alcanzó el límite de 20 páginas sin resolver la continuidad del feed.');
  },
});
