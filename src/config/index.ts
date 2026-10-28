import dotenv from 'dotenv';

dotenv.config();

export interface InstagramAccountConfig {
  id: string;
  label: string;
}

export interface AppConfig {
  meta: {
    accessToken: string;
    apiVersion: string;
    accounts: InstagramAccountConfig[];
  };
  twitter: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  };
}

/**
 * Validates that all required environment variables are present and non-empty.
 * Fails fast on startup with a clear error message if any credential is missing.
 */
const validateEnv = (requiredKeys: string[]): void => {
  const missing = requiredKeys.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `❌ Faltan variables de entorno obligatorias en el archivo .env: ${missing.join(', ')}`
    );
  }
};

/**
 * Resolves the list of Instagram Business accounts to synchronize.
 * Supports both named agency accounts (IG_MN_AGENT_ID, IG_MN_FEDERAL_ID)
 * and a comma-separated IG_ACCOUNT_IDS list for extensibility.
 */
const resolveInstagramAccounts = (): InstagramAccountConfig[] => {
  const accounts: InstagramAccountConfig[] = [];

  if (process.env.IG_MN_AGENT_ID?.trim()) {
    accounts.push({
      id: process.env.IG_MN_AGENT_ID.trim(),
      label: 'MN Agent',
    });
  }

  if (process.env.IG_MN_FEDERAL_ID?.trim()) {
    accounts.push({
      id: process.env.IG_MN_FEDERAL_ID.trim(),
      label: 'MN Federal',
    });
  }

  if (process.env.IG_ACCOUNT_IDS?.trim()) {
    const extraIds = process.env.IG_ACCOUNT_IDS.split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    for (const id of extraIds) {
      if (!accounts.some((acc) => acc.id === id)) {
        accounts.push({ id, label: `IG Account (${id})` });
      }
    }
  }

  if (accounts.length === 0) {
    throw new Error(
      '❌ No se configuró ninguna cuenta de Instagram. Definí IG_MN_AGENT_ID, IG_MN_FEDERAL_ID o IG_ACCOUNT_IDS en tu .env.'
    );
  }

  return accounts;
};

validateEnv([
  'META_ACCESS_TOKEN',
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_SECRET',
]);

export const config: AppConfig = {
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN!.trim(),
    apiVersion: process.env.META_GRAPH_API_VERSION?.trim() || 'v25.0',
    accounts: resolveInstagramAccounts(),
  },
  twitter: {
    apiKey: process.env.TWITTER_API_KEY!.trim(),
    apiSecret: process.env.TWITTER_API_SECRET!.trim(),
    accessToken: process.env.TWITTER_ACCESS_TOKEN!.trim(),
    accessSecret: process.env.TWITTER_ACCESS_SECRET!.trim(),
  },
};
