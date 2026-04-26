import axios from 'axios';
import { config } from '../config';

// 1. Definimos los tipos exactos de lo que nos devuelve la API de Meta
export interface InstagramMedia {
  id: string;
  media_url: string;
  caption?: string; // Opcional, por si suben una foto sin texto
}

interface InstagramResponse {
  username: string;
  media_count: number;
  media: {
    data: InstagramMedia[];
  };
}

// 2. Creamos la función para obtener los posts
export const fetchLatestPosts = async (accountId: string): Promise<InstagramMedia[]> => {
  try {
    // Usamos la URL base de la Graph API
    const url = `https://graph.facebook.com/v25.0/${accountId}`;
    
    // Hacemos la petición GET con Axios
    const response = await axios.get<InstagramResponse>(url, {
      params: {
        fields: 'username,media_count,media{media_url,caption}',
        access_token: config.meta.accessToken,
      },
    });

    // Retornamos solo el array de posteos que es lo que nos interesa
    return response.data.media.data;
    
  } catch (error) {
    console.error(`❌ Error consultando la API de Instagram para la cuenta ${accountId}:`);
    if (axios.isAxiosError(error)) {
      console.error(error.response?.data || error.message);
    }
    throw error;
  }
};