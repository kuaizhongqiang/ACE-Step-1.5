import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import output from '../output.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..', '..');
const ENV_PATH = join(ROOT_DIR, '.env');

export default async function configCmd(subcommand, positionals, flags) {
  if (subcommand === 'set' && positionals.length >= 2) {
    return configSet(positionals[0], positionals.slice(1).join('='), flags);
  }
  return configShow(flags);
}

async function configShow(flags) {
  if (!existsSync(ENV_PATH)) {
    output.auto('No .env file found', {});
    output.exit(0);
    return;
  }
  const content = readFileSync(ENV_PATH, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  if (flags.json) {
    const entries = lines.filter(l => !l.startsWith('#')).map(l => {
      const eq = l.indexOf('=');
      return eq > 0 ? { key: l.slice(0, eq).trim(), value: l.slice(eq + 1).trim() } : { key: l.trim(), value: '' };
    });
    output.json(entries);
    return;
  }

  const section = flags.section;
  for (const line of lines) {
    if (line.startsWith('#')) { output.print(line); continue; }
    if (section && !line.toLowerCase().includes(section.toLowerCase())) continue;
    output.print(line);
  }
  output.exit(0);
}

async function configSet(key, value, flags) {
  let content = '';
  let found = false;
  if (existsSync(ENV_PATH)) {
    content = readFileSync(ENV_PATH, 'utf-8');
    const lines = content.split('\n');
    content = lines.map(l => {
      const eq = l.indexOf('=');
      const k = eq > 0 ? l.slice(0, eq).trim() : '';
      if (k === key) { found = true; return key + '=' + value; }
      return l;
    }).join('\n');
  }
  if (!found) content += (content ? '\n' : '') + key + '=' + value;
  writeFileSync(ENV_PATH, content, 'utf-8');

  const sensitive = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD'].some(s => key.toUpperCase().includes(s));
  output.auto(sensitive ? 'Set ' + key + '=***' : 'Set ' + key + '=' + value, { key, value: sensitive ? '***' : value });
  output.exit(0);
}
