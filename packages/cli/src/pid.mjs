/**
 * PID file management — cross-platform process detection
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_DIR = join(__dirname, '..', '..');
const PID_PATH = join(SERVER_DIR, 'logs', 'server.pid');

export function getPidPath() { return PID_PATH; }

export function writePid(pid) {
  if (isAlive(pid)) {
    writeFileSync(PID_PATH, String(pid), 'utf-8');
  }
}

export function readPid() {
  if (!existsSync(PID_PATH)) return null;
  try {
    const pid = parseInt(readFileSync(PID_PATH, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch { return null; }
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

export function cleanPid() {
  try { if (existsSync(PID_PATH)) unlinkSync(PID_PATH); } catch {}
}

export default { getPidPath, writePid, readPid, isAlive, getProcessInfo, cleanPid };
