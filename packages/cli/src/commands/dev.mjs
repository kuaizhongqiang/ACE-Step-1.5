import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import output from '../output.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..', '..');

export default async function devCmd(flags, options) {
  const frontendPort = options.frontendPort || '3000';
  const backendPort = options.port || '3001';

  output.print('Starting dev mode (frontend:' + frontendPort + ', backend:' + backendPort + ')...');

  const vite = spawn('npx', ['vite', '--port', frontendPort], {
    cwd: ROOT_DIR, stdio: 'inherit',
  });

  const server = spawn('npx', ['tsx', 'server/src/index.ts'], {
    cwd: ROOT_DIR, stdio: 'inherit',
    env: { ...process.env, PORT: backendPort },
  });

  const cleanup = () => { vite.kill(); server.kill(); process.exit(0); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  vite.on('exit', () => { server.kill(); process.exit(1); });
  server.on('exit', () => { vite.kill(); process.exit(1); });
}
