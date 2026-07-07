import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import output from '../output.mjs';
import pid from '../pid.mjs';
import { readEnv } from '../env.mjs';
import { spawnServer, spawnEngine } from '../daemon.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..', '..');

export default async function startCmd(subcommand, flags, options) {
  if (subcommand === 'engine') {
    return startEngine(flags, options);
  }
  if (subcommand && subcommand !== 'server') {
    output.auto(`Unknown service: ${subcommand}`, { error: 'unknown_service' });
    output.exit(1);
    return;
  }
  return startServer(flags, options);
}

async function startServer(flags, options) {
  const existingPid = pid.readPid('server');
  if (existingPid && pid.isAlive(existingPid)) {
    output.auto('Server is already running', { running: true, pid: existingPid });
    output.exit(2);
    return;
  }

  const port = options.port || getDefaultPort('server', '3001');

  if (flags.foreground) {
    output.print('Starting server in foreground mode...');
    const child = spawn('npx', ['tsx', 'packages/server/src/index.ts'], {
      cwd: ROOT_DIR, stdio: 'inherit',
      env: { ...process.env, PORT: String(port) },
    });
    child.on('exit', code => process.exit(code || 0));
    return;
  }

  try {
    const result = await spawnServer({ port: parseInt(port, 10) });
    output.auto('Server started\n  PID: ' + result.pid + '\n  Port: ' + result.port, result);
    output.exit(0);
  } catch (err) {
    output.printError('Failed to start server: ' + err.message);
    output.exit(1);
  }
}

async function startEngine(flags, options) {
  const existingPid = pid.readPid('engine');
  if (existingPid && pid.isAlive(existingPid)) {
    output.auto('Engine is already running', { running: true, pid: existingPid });
    output.exit(2);
    return;
  }

  const port = options.port || getDefaultPort('engine', '7860');

  if (flags.foreground) {
    output.print('Starting engine in foreground mode...');
    const child = spawn('uv', ['run', 'acestep', '--port', String(port)], {
      cwd: ROOT_DIR, stdio: 'inherit',
      env: { ...process.env, GRADIO_PORT: String(port) },
    });
    child.on('exit', code => process.exit(code || 0));
    return;
  }

  try {
    const result = await spawnEngine({ port: parseInt(port, 10) });
    output.auto('Engine started\n  PID: ' + result.pid + '\n  Port: ' + result.port, result);
    output.exit(0);
  } catch (err) {
    output.printError('Failed to start engine: ' + err.message);
    output.exit(1);
  }
}

export async function restartCmd(subcommand, flags, options) {
  const stopCmd = (await import('./stop.mjs')).default;
  await stopCmd(subcommand, { ...flags, force: true }, options);
  return startCmd(subcommand, flags, options);
}

function getDefaultPort(service, fallback) {
  const key = service === 'engine' ? 'GRADIO_PORT' : 'SERVER_PORT';
  return process.env[key] || fallback;
}
