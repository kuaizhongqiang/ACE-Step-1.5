/**
 * Info command — project overview
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import output from '../output.mjs';
import { readEnv } from '../env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..', '..');

export default async function infoCmd(flags) {
  const pkgPath = join(ROOT_DIR, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf-8')) : {};

  const env = readEnv();

  const info = {
    name: pkg.name || 'ace-step-ui',
    version: pkg.version || 'unknown',
    description: pkg.description || 'Local AI Music Generator',
    paths: {
      root: ROOT_DIR,
      server: join(ROOT_DIR, 'server'),
      audio: join(ROOT_DIR, 'server', 'public', 'audio'),
    },
    config: env.sections,
    runtime: {
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
    },
  };

  output.auto(
    `ACE-Step UI v${info.version}\n` +
    `  Description: ${info.description}\n` +
    `  Node: ${info.runtime.node} (${info.runtime.platform})\n` +
    `  Root: ${info.paths.root}\n` +
    `  Audio: ${info.paths.audio}\n`,
    info
  );
  output.exit(0);
}
