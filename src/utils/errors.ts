import axios from 'axios';
import { ApiResponseError } from 'twitter-api-v2';

/** Only messages authored by this application may be displayed verbatim. */
export class SafeError extends Error {}
const networkCodes = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED']);
const fileCodes = new Set(['ENOENT', 'EACCES', 'EPERM', 'ENOSPC', 'EROFS']);
const statusText = (status: unknown): string =>
  typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? String(status) : 'sin status';

export const describeError = (error: unknown): string => {
  if (error instanceof SafeError) return error.message;
  if (axios.isAxiosError(error)) {
    const code = error.response?.data?.error?.code;
    const apiCode = typeof code === 'number' && Number.isSafeInteger(code) ? `; código Meta ${code}` : '';
    const network = networkCodes.has(error.code ?? '') ? `; ${error.code}` : '';
    return `HTTP ${statusText(error.response?.status)}${apiCode}${network}. Revisá permisos, cuota y conectividad.`;
  }
  if (error instanceof ApiResponseError) {
    return `X respondió HTTP ${statusText(error.code)}. Revisá permisos, créditos y límites de la API.`;
  }
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && fileCodes.has(code)) return `Error de archivo (${code}). Revisá almacenamiento y permisos.`;
  return 'Error no clasificado. Revisá el servicio y el estado antes de reintentar; los detalles externos se omiten por seguridad.';
};
