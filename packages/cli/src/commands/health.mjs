import http from 'http';
import output from '../output.mjs';
import { readEnv } from '../env.mjs';

export default async function healthCmd(flags, options) {
  const port = options.port || getDefaultPort();

  try {
    await httpGet(`http://localhost:${port}/health`);
    output.auto('Health: OK (server)', { status: 'ok', service: 'ACE-Step UI API' });
    output.exit(0);
  } catch {
    output.auto('Health: FAIL - server not running', { status: 'error', error: 'server_not_running' });
    output.exit(2);
  }
}

function getDefaultPort() {
  try {
    const env = readEnv();
    const portEntry = env.sections.server?.find(([k]) => k === 'PORT');
    return portEntry?.[1] || '3001';
  } catch {
    return '3001';
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}
