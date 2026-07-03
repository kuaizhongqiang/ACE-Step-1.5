import { spawn } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import output from '../output.mjs';
import pid from '../pid.mjs';
import { readEnv } from '../env.mjs';
import { spawnDaemon } from '../daemon.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_DIR = join(__dirname, '..', '..', '..');

export default async function startCmd(flags, options) {
  const existingPid = pid.readPid();
  if (existingPid && pid.isAlive(existingPid)) {
    output.auto('Server is already running', { running: true, pid: existingPid });
    output.exit(2);
    return;
  }

  const port = options.port || getDefaultPort();

  if (flags.foreground) {
    output.print('Starting in foreground mode...');
    const child = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: SERVER_DIR,
      stdio: 'inherit',
      env: { ...process.env, PORT: String(port) },
    });
    child.on('exit', code => process.exit(code || 0));
    return;
  }

  try {
    const result = await spawnDaemon({ port: parseInt(port, 10) });
    output.auto('Server started\n  PID: ' + result.pid + '\n  Port: ' + result.port, result);
    output.exit(0);
  } catch (err) {
    output.printError('Failed to start server: ' + err.message);
    output.exit(1);
  }
}

export async function restartCmd(flags, options) {
  const stopCmd = (await import('./stop.mjs')).default;
  await stopCmd(null, { ...flags, force: true }, options);
  return startCmd(flags, options);
}

function getDefaultPort() {
  try {
    const env = readEnv();
    const portEntry = env.sections.server?.find(([k]) => k === 'PORT');
    return portEntry?.[1] || '3001';
  } catch { return '3001'; }
}
