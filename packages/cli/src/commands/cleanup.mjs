/**
 * Cleanup command — remove temp files + expired audio
 */
import { readdirSync, unlinkSync, existsSync, rmSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import output from '../output.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..', '..');
const LOGS_DIR = join(ROOT_DIR, 'logs');
const AUDIO_DIR = join(ROOT_DIR, 'public', 'audio');
const CACHE_DIRS = ['node_modules/.cache', 'packages/front/node_modules/.vite'];

const MAX_AUDIO_AGE_DAYS = 7;

export default async function cleanupCmd(subcommand, flags, options) {
  const age = parseInt(options.age, 10) || MAX_AUDIO_AGE_DAYS;

  if (subcommand === 'audio') return cleanupAudio(age);
  if (subcommand === 'logs') return cleanupLogs();
  if (subcommand === 'cache') return cleanupCache();

  output.print('清理临时文件...\n');
  cleanupAudio(age);
  cleanupLogs();
  cleanupCache();
  output.exit(0);
}

function cleanupAudio(maxAgeDays) {
  if (!existsSync(AUDIO_DIR)) return;
  const now = Date.now();
  const maxAge = maxAgeDays * 86400000;
  let count = 0;

  for (const file of readdirSync(AUDIO_DIR)) {
    const filePath = join(AUDIO_DIR, file);
    let mtimeMs = 0;
    try { mtimeMs = statSync(filePath).mtimeMs; } catch { continue; }
    if (now - mtimeMs > maxAge) {
      try { unlinkSync(filePath); count++; } catch {}
    }
  }
  output.print(`  已清理 ${count} 个过期音频文件 (>${maxAgeDays}天)\n`);
}

function cleanupLogs() {
  if (!existsSync(LOGS_DIR)) return;
  let count = 0;
  for (const file of readdirSync(LOGS_DIR)) {
    try { unlinkSync(join(LOGS_DIR, file)); count++; } catch {}
  }
  output.print(`  已清理 ${count} 个日志文件\n`);
}

function cleanupCache() {
  for (const dir of CACHE_DIRS) {
    const fullPath = join(ROOT_DIR, dir);
    if (existsSync(fullPath)) {
      try { rmSync(fullPath, { recursive: true, force: true }); output.print(`  已清理缓存: ${dir}\n`); } catch {}
    }
  }
}
