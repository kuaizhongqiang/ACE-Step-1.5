/**
 * Environment variable reader with sensitive field masking
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import output from './output.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_DIR = join(__dirname, '..', '..');
const ROOT_DIR = join(SERVER_DIR, '..');

function maskValue(key, value) {
  const sensitive = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'JWT'];
  if (sensitive.some(s => key.toUpperCase().includes(s))) {
    if (value.length <= 8) return '***';
    return value.slice(0, 2) + '***' + value.slice(-2);
  }
  return value;
}

function groupEntries(entries) {
  const groups = { server: [], database: [], acestep: [], storage: [], frontend: [], security: [], other: [] };
  for (const [key, value] of entries) {
    const masked = maskValue(key, value);
    if (/^PORT|NODE_ENV/i.test(key)) groups.server.push([key, masked]);
    else if (/^DATABASE/i.test(key)) groups.database.push([key, masked]);
    else if (/^ACESTEP/i.test(key)) groups.acestep.push([key, masked]);
    else if (/^AUDIO|^DATASETS/i.test(key)) groups.storage.push([key, masked]);
    else if (/^FRONTEND|^VITE/i.test(key)) groups.frontend.push([key, masked]);
    else if (/^JWT|SECRET|KEY|TOKEN/i.test(key)) groups.security.push([key, masked]);
    else groups.other.push([key, masked]);
  }
  return groups;
}

export function readEnv(filePath) {
  const envPath = filePath || join(ROOT_DIR, '.env');
  if (!existsSync(envPath)) return { sections: {}, sensitive: [], missing: [], keys: [] };

  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  const entries = lines.map(l => {
    const eqIdx = l.indexOf('=');
    if (eqIdx < 0) return null;
    return [l.slice(0, eqIdx).trim(), l.slice(eqIdx + 1).trim()];
  }).filter(Boolean);

  return {
    keys: entries.map(([k]) => k),
    sections: groupEntries(entries),
    sensitive: entries.filter(([k]) => ['SECRET', 'KEY', 'TOKEN', 'PASSWORD'].some(s => k.toUpperCase().includes(s))).map(([k]) => k),
  };
}

export function show(flags) {
  const env = readEnv();
  if (flags.json) {
    output.json(env);
    return;
  }
  output.print('Environment Variables:');
  for (const [group, vars] of Object.entries(env.sections)) {
    if (vars.length === 0) continue;
    output.print(`  [${group}]`);
    for (const [k, v] of vars) {
      output.print(`    ${k}=${v}`);
    }
  }
  output.exit(0);
}

export default { readEnv, show };
