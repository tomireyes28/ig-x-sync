import dotenv from 'dotenv';

// Cargamos las variables del archivo .env
dotenv.config();

export const config = {
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    mnAgentId: process.env.IG_MN_AGENT_ID || '',
    mnFederalId: process.env.IG_MN_FEDERAL_ID || '',
  },
  twitter: {
    apiKey: process.env.TWITTER_API_KEY || '',
    apiSecret: process.env.TWITTER_API_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
  }
};