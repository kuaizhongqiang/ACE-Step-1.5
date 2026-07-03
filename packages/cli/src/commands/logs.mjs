import { createReadStream, existsSync, statSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import output from '../output.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_DIR = join(__dirname, '..', '..', '..');
const LOG_FILE = join(SERVER_DIR, 'logs', 'server.log');

export default async function logsCmd(flags, options) {
  const logPath = options['log-dir'] ? join(options['log-dir'], 'server.log') : LOG_FILE;
  const n = parseInt(options.n, 10) || 50;
  const follow = !!flags.f;
  const level = options.level || '';
  const grep = options.grep || '';

  if (!existsSync(logPath)) {
    output.printError('No log file found at ' + logPath);
    output.exit(1);
    return;
  }

  const allLines = [];
  const rl = createInterface({ input: createReadStream(logPath, { encoding: 'utf-8' }) });

  for await (const line of rl) {
    if (level && !line.includes('[' + level.toUpperCase() + ']')) continue;
    if (grep && !line.toLowerCase().includes(grep.toLowerCase())) continue;
    allLines.push(line);
  }

  allLines.slice(-n).forEach(l => output.print(l));

  if (follow) {
    let lastSize = statSync(logPath).size;
    watchFile(logPath, (curr) => {
      if (curr.size > lastSize) {
        const stream = createReadStream(logPath, { start: lastSize, encoding: 'utf-8' });
        stream.on('data', chunk => process.stdout.write(chunk));
        lastSize = curr.size;
      }
    });
  }
  output.exit(0);
}
