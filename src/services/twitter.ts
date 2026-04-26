import { TwitterApi } from 'twitter-api-v2';
import { config } from '../config';
import { downloadImageAsBuffer } from '../utils/image';

// Inicializamos el cliente con las llaves de tu .env
const client = new TwitterApi({
  appKey: config.twitter.apiKey,
  appSecret: config.twitter.apiSecret,
  accessToken: config.twitter.accessToken,
  accessSecret: config.twitter.accessSecret,
});

export const postToTwitter = async (imageUrl: string, caption: string = '') => {
  try {
    console.log('⏳ Descargando imagen de Instagram...');
    const imageBuffer = await downloadImageAsBuffer(imageUrl);

    console.log('⏳ Subiendo media a los servidores de X...');
    // Subimos la foto (X usa la API v1.1 para subir archivos multimedia)
    const mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });

    console.log('⏳ Redactando y enviando el Tweet...');
    // X tiene un límite de 280 caracteres. Si el texto de IG es más largo, lo cortamos prolijamente.
    const safeCaption = caption.length > 280 ? `${caption.substring(0, 277)}...` : caption;

    // Publicamos el posteo final usando la API v2
    const tweet = await client.v2.tweet({
      text: safeCaption,
      media: { media_ids: [mediaId] }
    });

    return tweet.data;
  } catch (error) {
    console.error('❌ Error interactuando con la API de X:');
    console.error(error);
    throw error;
  }
};