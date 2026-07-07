import http from 'http';
import output from '../output.mjs';
import { readEnv } from '../env.mjs';

export default async function healthCmd(flags, options) {
  const serverPort = options.serverPort || getDefaultPort('server', '3001');
  const enginePort = options.enginePort || getDefaultPort('engine', '7860');

  const results = await Promise.allSettled([
    checkService('Server', `http://localhost:${serverPort}/health`),
    checkService('Engine', `http://localhost:${enginePort}/health`),
  ]);

  const serverOk = results[0].status === 'fulfilled' && results[0].value;
  const engineOk = results[1].status === 'fulfilled' && results[1].value;

  const lines = [
    `  Server: ${serverOk ? 'OK' : 'FAIL'}`,
    `  Engine: ${engineOk ? 'OK' : 'FAIL'}`,
  ];

  output.auto(
    ACE_STEP_ASCII + '\n' + lines.join('\n'),
    { server: serverOk ? 'ok' : 'error', engine: engineOk ? 'ok' : 'error' }
  );
  output.exit(serverOk && engineOk ? 0 : 2);
}

async function checkService(name, url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function getDefaultPort(service, fallback) {
  try {
    const key = service === 'engine' ? 'GRADIO_PORT' : 'SERVER_PORT';
    return process.env[key] || fallback;
  } catch { return fallback; }
}

const ACE_STEP_ASCII = `
  ╔══════════════════════════╗
  ║      ACE-Step 1.5       ║
  ╚══════════════════════════╝
`;
