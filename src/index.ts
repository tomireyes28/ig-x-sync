import { config } from './config';
import { fetchLatestPosts } from './services/instagram';
import { postToTwitter } from './services/twitter';

const run = async () => {
  console.log('🚀 Iniciando sincronización IG -> X...\n');

  try {
    console.log(`Buscando el último post de MN Agent (ID: ${config.meta.mnAgentId})...`);
    const posts = await fetchLatestPosts(config.meta.mnAgentId);
    
    const firstPost = posts[0];
    
    if (firstPost) {
      console.log('✅ Post encontrado en Instagram.');
      const text = firstPost.caption || 'Nueva actualización';
      
      // Llamamos al servicio de Twitter
      const tweet = await postToTwitter(firstPost.media_url, text);
      
      console.log(`\n🎉 ¡ÉXITO TOTAL! El posteo ya está publicado en X.`);
      console.log(`🔗 Link: https://x.com/user/status/${tweet.id}`);
      
    } else {
      console.log('No se encontraron posts en esta cuenta de Instagram.');
    }

  } catch (error) {
    console.error('\n💥 Falló la ejecución principal.');
  }
};

run();