/**
 * Daemon process management
 * Supports Express server, Python Gradio engine, and Vite frontend.
 */
import { spawn, execSync } from 'child_process';
import { openSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pidManager from './pid.mjs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..');
const LOGS_DIR = join(ROOT_DIR, 'logs');

// ── Express Server ──────────────────────────────────────────────────────────

export function spawnServer({ port, logDir } = {}) {
  const logPath = logDir || LOGS_DIR;
  const outFd = openSync(join(logPath, 'server.log'), 'a');
  const errFd = openSync(join(logPath, 'server-error.log'), 'a');

  const child = spawn('npx', ['tsx', 'packages/server/src/index.ts'], {
    cwd: ROOT_DIR,
    detached: true,
    stdio: ['ignore', outFd, errFd],
    env: { ...process.env, PORT: String(port || 3001) },
  });
  child.unref();

  const pid = child.pid;
  pidManager.writePid(pid, 'server');

  return waitForService(`http://localhost:${port || 3001}/health`, 10000, { pid, port: port || 3001 });
}

// ── Python Engine (Gradio) ──────────────────────────────────────────────────

export function spawnEngine({ port, logDir } = {}) {
  const enginePort = port || 7860;
  const logPath = logDir || LOGS_DIR;
  const outFd = openSync(join(logPath, 'engine.log'), 'a');
  const errFd = openSync(join(logPath, 'engine-error.log'), 'a');

  const child = spawn('uv', ['run', 'acestep', '--port', String(enginePort)], {
    cwd: ROOT_DIR,
    detached: true,
    stdio: ['ignore', outFd, errFd],
    env: { ...process.env, GRADIO_PORT: String(enginePort) },
  });
  child.unref();

  const pid = child.pid;
  pidManager.writePid(pid, 'engine');

  return waitForService(`http://localhost:${enginePort}/health`, 60000, { pid, port: enginePort });
}

// ── Vite Frontend ───────────────────────────────────────────────────────────

export function spawnFront({ port } = {}) {
  const frontPort = port || 3000;
  const child = spawn('npx', ['vite', '--port', String(frontPort), '--host', '0.0.0.0'], {
    cwd: join(ROOT_DIR, 'packages', 'front'),
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return { pid: child.pid, port: frontPort };
}

// ── Dev mode: all three services ────────────────────────────────────────────

export function spawnDev({ enginePort, serverPort, frontPort } = {}) {
  const ep = enginePort || 7860;
  const sp = serverPort || 3001;
  const fp = frontPort || 3000;

  // Start all three concurrently (fire-and-forget for logs)
  const engine = spawn('uv', ['run', 'acestep', '--port', String(ep)], {
    cwd: ROOT_DIR, stdio: 'inherit',
    env: { ...process.env, GRADIO_PORT: String(ep) },
  });
  const server = spawn('npx', ['tsx', 'packages/server/src/index.ts'], {
    cwd: ROOT_DIR, stdio: 'inherit',
    env: { ...process.env, PORT: String(sp) },
  });
  const front = spawn('npx', ['vite', '--port', String(fp), '--host', '0.0.0.0'], {
    cwd: join(ROOT_DIR, 'packages', 'front'), stdio: 'inherit',
  });

  const cleanup = () => { engine.kill(); server.kill(); front.kill(); process.exit(0); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  engine.on('exit', () => { cleanup(); });
  server.on('exit', () => { cleanup(); });
  front.on('exit', () => { cleanup(); });
}

// ── Stop helpers ────────────────────────────────────────────────────────────

export function stopDaemon(pid, { timeout = 10000, force = false } = {}) {
  return new Promise((resolve) => {
    if (!pidManager.isAlive(pid)) {
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
        resolve({ success: true, method: 'SIGKILL' });
      }
    }, 500);
  });
}

export function stopEngine(pid, { timeout = 10000, force = false } = {}) {
  return stopDaemon(pid, { timeout, force });
}

// ── Health check helper ─────────────────────────────────────────────────────

function waitForService(url, timeoutMs, result) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(check);
      reject(new Error(`Service at ${url} did not respond within ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const check = setInterval(() => {
      const req = http.get(url, (res) => {
        clearTimeout(timeout);
        clearInterval(check);
        resolve(result);
      });
      req.on('error', () => {});
      req.end();
    }, 1000);
  });
}
