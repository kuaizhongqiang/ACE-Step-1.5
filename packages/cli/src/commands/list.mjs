import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import output from '../output.mjs';
import { readEnv } from '../env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..', '..');

export default async function listCmd(subcommand, flags, options, positionals) {
  switch (subcommand) {
    case 'styles': return listStyles(flags, options, positionals);
    case 'models': return listModels(flags);
    case 'songs':  return listSongs(flags, options);
    case 'jobs':   return listJobs(flags, options);
    default:
      output.print('Available: styles, models, songs, jobs');
      output.exit(1);
  }
}

function getPort() {
  try {
    const env = readEnv();
    const p = env.sections.server?.find(([k]) => k === 'PORT');
    return p?.[1] || '3001';
  } catch { return '3001'; }
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:' + getPort() + path, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    }).on('error', () => reject(new Error('Server not running')));
  });
}

async function listStyles(flags, options, positionals) {
  const mainPath = join(ROOT_DIR, 'data', 'main_style.txt');
  const allPath = join(ROOT_DIR, 'data', 'all_style.txt');
  const filter = options.filter || positionals[0] || '';

  if (flags.json) {
    const all = existsSync(allPath) ? readFileSync(allPath, 'utf-8').split('\n').filter(Boolean) : [];
    const main = existsSync(mainPath) ? readFileSync(mainPath, 'utf-8').split('\n').filter(Boolean) : [];
    const matched = filter ? all.filter(s => s.toLowerCase().includes(filter.toLowerCase())) : all;
    output.json({ total: all.length, main: main.length, matched: matched.length, styles: matched });
    return;
  }

  const main = existsSync(mainPath) ? readFileSync(mainPath, 'utf-8').split('\n').filter(Boolean) : [];
  if (filter) {
    const matched = main.filter(s => s.toLowerCase().includes(filter.toLowerCase()));
    output.print('Matching styles (' + matched.length + '):');
    matched.forEach(s => output.print('  ' + s));
  } else {
    output.print('Main styles (' + main.length + ' total):');
    main.slice(0, 20).forEach(s => output.print('  ' + s));
    output.print('... use --filter to search');
  }
  output.exit(0);
}

async function listModels(flags) {
  const models = [
    { id: 'acestep-v15-base', name: '1.5B' },
    { id: 'acestep-v15-sft', name: '1.5S' },
    { id: 'acestep-v15-turbo-shift3', name: '1.5TS3' },
  ];
  output.auto(models.map(m => '  ' + m.id).join('\n'), models);
  output.exit(0);
}

async function listSongs(flags, options) {
  try {
    const limit = options.limit || 20;
    const data = await httpGet('/api/songs?limit=' + limit + '&offset=0');
    const songs = data.songs || [];
    output.table(['ID', 'Title', 'Style', 'Duration'], songs.map(s => [
      (s.id || '').slice(0, 8), s.title || '', s.style || '', String(s.duration || '')
    ]));
  } catch (e) {
    output.printError('Failed: ' + e.message);
    output.exit(2);
  }
}

async function listJobs(flags, options) {
  try {
    const data = await httpGet('/api/generate/history');
    const jobs = (data.jobs || []).slice(0, parseInt(options.limit, 10) || 20);
    output.table(['Job ID', 'Status', 'Title'], jobs.map(j => [
      (j.id || j.jobId || '').slice(0, 8), j.status || '', (j.params?.title) || ''
    ]));
  } catch (e) {
    output.printError('Failed: ' + e.message);
    output.exit(2);
  }
}
