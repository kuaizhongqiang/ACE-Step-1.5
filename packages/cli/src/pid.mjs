/**
 * PID file management — cross-platform process detection
 * Supports server (Express) and engine (Python Gradio) PIDs.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGS_DIR = join(__dirname, '..', '..', '..', 'logs');

export function getPidPath(service = 'server') {
  return join(LOGS_DIR, `${service}.pid`);
}

export function readPid(service = 'server') {
  const pidPath = getPidPath(service);
  if (!existsSync(pidPath)) return null;
  try {
    const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch { return null; }
}

export function writePid(pid, service = 'server') {
  if (isAlive(pid)) {
    writeFileSync(getPidPath(service), String(pid), 'utf-8');
  }
}

export function isAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    if (process.platform === 'win32') {
      execSync(`tasklist /FI "PID eq ${pid}" /NH 2>nul`, { stdio: 'pipe' });
      return true;
    }
    return process.kill(pid, 0);
  } catch { return false; }
}

export function getProcessInfo(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH 2>nul`, { encoding: 'utf-8' });
      const parts = out.trim().split(',');
      return { memory: parts[4] ? parts[4].replace(/"/g, '').trim() : 'N/A', uptime: 0, startedAt: '' };
    }
    const out = execSync(`ps -p ${pid} -o rss=,etime= 2>/dev/null`, { encoding: 'utf-8' });
    const [rss, etime] = out.trim().split(/\s+/);
    return { memory: rss ? Math.round(parseInt(rss) / 1024) + 'MB' : 'N/A', uptime: etime || '0', startedAt: '' };
  } catch { return { memory: 'N/A', uptime: 0, startedAt: '' }; }
}

export function cleanPid(service = 'server') {
  try { if (existsSync(getPidPath(service))) unlinkSync(getPidPath(service)); } catch {}
}

export function readAllPids() {
  return {
    server: readPid('server'),
    engine: readPid('engine'),
  };
}

export default { getPidPath, readPid, writePid, isAlive, getProcessInfo, cleanPid, readAllPids };
