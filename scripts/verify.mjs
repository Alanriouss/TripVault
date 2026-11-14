import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, TRIPVAULT_TEST_HTML: 'outputs/TripVault_Rooms_v9.html' };
for (const target of ['work/tripvault-room-server/test-api.js', 'work/test-tripvault-v8.js']) {
  const result = spawnSync(process.execPath, [target], { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
