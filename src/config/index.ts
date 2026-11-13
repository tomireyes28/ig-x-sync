import { SafeError } from '../utils/errors';
export interface InstagramAccountConfig { id: string; label: string }
export interface TwitterCredentials { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }
export interface AppConfig {
  dryRun: boolean;
  meta: { accessToken: string; apiVersion: string; accounts: InstagramAccountConfig[] };
  twitter?: TwitterCredentials;
}

/** Pure configuration parsing: importing a module never reads credentials or starts clients. */
export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env, args: string[] = process.argv.slice(2),
): AppConfig => {
  if (args.some(arg => arg !== '--dry-run')) throw new SafeError('Argumento desconocido. Uso: npm start -- [--dry-run]');
  if (env.DRY_RUN !== undefined && !['true', 'false'].includes(env.DRY_RUN.trim())) {
    throw new SafeError('DRY_RUN debe ser true o false.');
  }
  const dryRun = args.includes('--dry-run') || env.DRY_RUN?.trim() === 'true';
  const required = (key: string): string => {
    const value = env[key]?.trim();
    if (!value) throw new SafeError(`Falta la variable obligatoria ${key}.`);
    return value;
  };
  const apiVersion = env.META_GRAPH_API_VERSION?.trim() || 'v25.0';
  if (!/^v\d+\.\d+$/.test(apiVersion)) throw new SafeError('META_GRAPH_API_VERSION debe tener formato vNN.N.');
  const accounts: InstagramAccountConfig[] = [];
  const addAccount = (input: string | undefined, label: string): void => {
    const id = input?.trim();
    if (!id) return;
    if (!/^\d+$/.test(id)) throw new SafeError('Los IDs de Instagram deben contener solo dígitos.');
    if (!accounts.some(account => account.id === id)) accounts.push({ id, label });
  };
  addAccount(env.IG_MN_AGENT_ID, 'MN Agent');
  addAccount(env.IG_MN_FEDERAL_ID, 'MN Federal');
  for (const id of env.IG_ACCOUNT_IDS?.split(',') ?? []) addAccount(id, 'Instagram');
  if (!accounts.length) throw new SafeError('Configurá al menos una cuenta con IG_ACCOUNT_IDS o los aliases IG_MN_*.');
  return {
    dryRun,
    meta: { accessToken: required('META_ACCESS_TOKEN'), apiVersion, accounts },
    ...(!dryRun ? { twitter: {
      apiKey: required('TWITTER_API_KEY'), apiSecret: required('TWITTER_API_SECRET'),
      accessToken: required('TWITTER_ACCESS_TOKEN'), accessSecret: required('TWITTER_ACCESS_SECRET'),
    } } : {}),
  };
};

