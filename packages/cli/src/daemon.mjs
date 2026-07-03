/**
 * Daemon process management
 */
import { spawn, execSync } from 'child_process';
import { openSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pidManager from './pid.mjs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_DIR = join(__dirname, '..', '..');

export function spawnDaemon({ port, logDir } = {}) {
  const logPath = logDir || join(SERVER_DIR, 'logs');
  const outFd = openSync(join(logPath, 'server.log'), 'a');
  const errFd = openSync(join(logPath, 'server-error.log'), 'a');

  const child = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: SERVER_DIR,
    detached: true,
    stdio: ['ignore', outFd, errFd],
    env: { ...process.env, PORT: String(port || 3001) },
  });
  child.unref();

  const pid = child.pid;
  pidManager.writePid(pid);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      stopDaemon(pid).catch(() => {});
      reject(new Error('Server start timed out (10s)'));
    }, 10000);

    const check = setInterval(() => {
      const req = http.get(`http://localhost:${port || 3001}/health`, (res) => {
        clearTimeout(timeout);
        clearInterval(check);
        resolve({ pid, port: port || 3001 });
      });
      req.on('error', () => {});
      req.end();
    }, 500);
  });
}

export function stopDaemon(pid, { timeout = 10000, force = false } = {}) {
  return new Promise((resolve) => {
    if (!pidManager.isAlive(pid)) {
      pidManager.cleanPid();
      resolve({ success: false, method: 'not_running' });
      return;
    }

    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /T`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGTERM');
      }
    } catch { /* ignore */ }

    const start = Date.now();
    const poll = setInterval(() => {
      if (!pidManager.isAlive(pid)) {
        clearInterval(poll);
        pidManager.cleanPid();
        resolve({ success: true, method: 'SIGTERM' });
      } else if (Date.now() - start > timeout) {
        clearInterval(poll);
        try {
          if (process.platform === 'win32') {
            execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
          } else {
            process.kill(pid, 'SIGKILL');
          }
        } catch {}
        pidManager.cleanPid();
        resolve({ success: true, method: 'SIGKILL' });
      }
    }, 500);
  });
}
