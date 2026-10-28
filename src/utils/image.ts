import axios from 'axios';

export interface DownloadedImage {
  buffer: Buffer;
  mimeType: string;
}

const DEFAULT_IMAGE_TIMEOUT_MS = 15_000;

/**
 * Downloads a remote image into an in-memory Buffer and resolves its MIME type
 * from the HTTP response headers.
 */
export const downloadImageAsBuffer = async (url: string): Promise<DownloadedImage> => {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: DEFAULT_IMAGE_TIMEOUT_MS,
  });

  const rawContentType = response.headers['content-type'];
  const mimeType =
    typeof rawContentType === 'string' && rawContentType.includes('/')
      ? rawContentType.split(';')[0].trim()
      : 'image/jpeg';

  return {
    buffer: Buffer.from(response.data),
    mimeType,
  };
};
