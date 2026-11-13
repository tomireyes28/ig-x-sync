import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import axios from 'axios';
import { createInstagramService, type InstagramMedia } from './services/instagram';
import { createStateStore } from './utils/state';
import { formatTweetCaption } from './utils/caption';
import { describeError } from './utils/errors';
import { runSync, type SyncDependencies } from './sync';

/** Synthetic feeds, fake X and disposable state. This adapter never opens a socket. */
const demo = async (): Promise<void> => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-x-demo-'));
  const image = (id: string, caption = `Publicación de ejemplo ${id}`): InstagramMedia => ({
    id, caption, media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/demo.jpg',
  });
  const feeds: Record<string, InstagramMedia[]> = {
    '100': [image('103'), image('102'), image('101')], '200': [image('201')],
  };
  const accounts = [{ id: '100', label: 'Estudio Demo' }, { id: '200', label: 'Galería Demo' }];
  const http = axios.create({ adapter: async request => {
    const parts = new URL(request.url!).pathname.split('/');
    const isMedia = parts.at(-1) === 'media';
    const id = parts.at(isMedia ? -2 : -1)!;
    const data = isMedia ? { data: feeds[id] } : { username: `demo_${id}`, media_count: feeds[id].length };
    return { data, config: request, status: 200, statusText: 'OK', headers: {} };
  } });
  const instagram = createInstagramService({ accessToken: 'offline-demo', apiVersion: 'v25.0' }, http);
  let attempts = 0;
  try {
    const state = createStateStore(path.join(directory, 'state.json'));
    const deps: SyncDependencies = {
      state, fetchFeed: instagram.fetchAccountFeed, preview: formatTweetCaption, log: console.log,
      prepare: async post => ({ mediaId: post.id, text: formatTweetCaption(post.caption) }),
      publish: async prepared => {
        attempts++;
        if (prepared.mediaId === '106') throw new Error('Simulated lost response');
        return { id: `900${prepared.mediaId}` };
      },
    };
    console.log('DEMO OFFLINE: feeds sintéticos, X simulado y estado temporal. No usa tokens ni red.');
    console.log('\n1. Preview: no publica ni guarda estado.');
    await runSync(accounts, deps, true);
    console.log('\n2. Primer arranque: solo el último post por cuenta.');
    await runSync(accounts, deps, false);
    console.log('\n3. Dos posts nuevos: publica ambos en orden.');
    feeds['100'].unshift(image('105'), image('104', 'Una actualización con Unicode 👩🏽‍💻 y https://example.com'));
    await runSync(accounts, deps, false);
    console.log('\n4. Reejecución: no vuelve a publicar.');
    await runSync(accounts, deps, false);
    console.log('\n5. Respuesta perdida: bloquea esa cuenta y continúa la otra.');
    feeds['100'].unshift(image('106'));
    feeds['200'].unshift(image('202'));
    await runSync(accounts, deps, false);
    console.log('\n6. Reejecución tras incertidumbre: no reintenta la creación.');
    await runSync(accounts, deps, false);
    console.log(`\nDemo completada: ${attempts} intentos simulados; cuenta 100 pendiente de revisión, cuenta 200 al día.`);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

demo().catch(error => { console.error(describeError(error)); process.exitCode = 1; });
