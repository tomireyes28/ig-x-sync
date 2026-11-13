import { SafeError } from './errors';
import { extractUrlsWithIndices, hasInvalidCharacters, parseTweet } from 'twitter-text';

const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });

/** Keep URLs and graphemes intact while applying X's weighted character rules. */
export const formatTweetCaption = (caption: string, maxLength = 280): string => {
  if (!Number.isInteger(maxLength) || maxLength < 4 || maxLength > 280) {
    throw new SafeError('El límite del caption debe ser un entero entre 4 y 280.');
  }
  const normalized = caption.trim().normalize('NFC') || 'Nueva actualización';
  if (hasInvalidCharacters(normalized)) throw new SafeError('El caption contiene caracteres no admitidos por X.');
  if (parseTweet(normalized).weightedLength <= maxLength) return normalized;

  const tokens: string[] = [];
  let offset = 0;
  for (const url of extractUrlsWithIndices(normalized)) {
    tokens.push(...Array.from(segmenter.segment(normalized.slice(offset, url.indices[0])), item => item.segment));
    tokens.push(normalized.slice(url.indices[0], url.indices[1]));
    offset = url.indices[1];
  }
  tokens.push(...Array.from(segmenter.segment(normalized.slice(offset)), item => item.segment));
  let text = '';
  for (const token of tokens) {
    if (parseTweet(`${text}${token}...`).weightedLength > maxLength) break;
    text += token;
  }
  return `${text.trimEnd()}...`;
};

