import { config } from './config';
import { fetchLatestPosts } from './services/instagram';

const run = async () => {
  console.log('Iniciando sincronización IG -> X...\n');

  try {
    // Probamos traer los posts de la primera cuenta (MN Agent)
    console.log(`Consultando posts para MN Agent (ID: ${config.meta.mnAgentId})...`);
    
    const posts = await fetchLatestPosts(config.meta.mnAgentId);
    
    if (posts.length > 0) {
      console.log('✅ ¡Posts obtenidos con éxito!');
      console.log('Último post encontrado:');
      console.log(`- ID: ${posts[0].id}`);
      console.log(`- Texto: ${posts[0].caption?.substring(0, 50)}...`);
      console.log(`- URL Media: ${posts[0].media_url}`);
    } else {
      console.log('No se encontraron posts en esta cuenta.');
    }

  } catch (error) {
    console.error('💥 Falló la ejecución principal:', error);
  }
};

// Ejecutamos la función
run();