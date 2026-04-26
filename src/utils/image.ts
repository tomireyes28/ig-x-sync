import axios from 'axios';

export const downloadImageAsBuffer = async (url: string): Promise<Buffer> => {
  // Pedimos la imagen y le decimos a Axios que nos devuelva un arraybuffer crudo
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary');
};