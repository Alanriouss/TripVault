import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRoomApi, LOCAL_HTML } from './api.js';

export { createRoomApi } from './api.js';

if (import.meta.main) {
  const host = process.env.TRIPVAULT_HOST || '127.0.0.1';
  const port = Number(process.env.TRIPVAULT_PORT || '8788');
  const origin = new URL(process.env.TRIPVAULT_ORIGIN || `http://${host}:${port}`).origin;
  const databasePath = resolve(process.env.TRIPVAULT_DB || resolve(import.meta.dir, '../../../work/tripvault-rooms.sqlite3'));
  mkdirSync(dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);
  const api = createRoomApi({ database: db, origin });
  const htmlPath = resolve(import.meta.dir, '../../../outputs', LOCAL_HTML);

  const server = Bun.serve({
    hostname: host,
    port,
    maxRequestBodySize: 16_384,
    fetch(request, listener) {
      const path = new URL(request.url).pathname;
      if (path.startsWith('/api/')) {
        return api(request, listener.requestIP(request)?.address || 'local');
      }
      if (request.method === 'GET' && (path === '/' || path === '/' + LOCAL_HTML)) {
        return new Response(Bun.file(htmlPath), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
          },
        });
      }
      return new Response('Page unavailable.', { status: 404 });
    },
  });

  console.log(`TripVault Rooms: ${origin} (listening on ${host}:${server.port})`);
}
