import { SafeError } from './errors';
import axios, { AxiosInstance } from 'axios';

export interface DownloadedImage { buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }
export const MAX_IMAGE_BYTES = 5_000_000;

const validateImageUrl = (input: string): void => {
  const url = new URL(input);
  const trustedHost = ['cdninstagram.com', 'fbcdn.net'].some(
    domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
  );
  if (url.protocol !== 'https:' || !trustedHost || url.username || url.password || url.port) {
    throw new SafeError('La imagen debe usar HTTPS y un CDN de Instagram/Meta permitido.');
  }
};

/** Signatures are a format check, not a full image decoder. X still validates the file. */
const detectMime = (buffer: Buffer): DownloadedImage['mimeType'] | undefined => {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return undefined;
};

export const downloadImageAsBuffer = async (
  url: string, http: Pick<AxiosInstance, 'get'> = axios,
): Promise<DownloadedImage> => {
  validateImageUrl(url);
  const response = await http.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer', timeout: 15_000,
    maxContentLength: MAX_IMAGE_BYTES, maxBodyLength: MAX_IMAGE_BYTES,
    maxRedirects: 0,
  });
  const buffer = Buffer.from(response.data);
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new SafeError('Imagen vacía o mayor a 5 MB.');
  const header = response.headers['content-type'];
  const declaredMime = typeof header === 'string' ? header.split(';')[0].trim().toLowerCase() : undefined;
  const mimeType = detectMime(buffer);
  if (!mimeType || declaredMime !== mimeType) throw new SafeError('Formato de imagen no admitido o MIME inconsistente.');
  return { buffer, mimeType };
};

