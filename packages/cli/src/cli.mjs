#!/usr/bin/env node

/**
 * ACE-Step UI CLI — Local AI Music Generator Management Tool
 *
 * Usage: node server/cli.mjs <command> [options]
 *
 * Core principle: 前台能操作的 API，CLI 尽量都有
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const { command, subcommand, flags, options, positionals } = parseArgs(args);

// ── Route commands ──────────────────────────────────────────────────────────
async function main() {
  switch (command) {
    case 'help':    return (await import('./src/cli/help.mjs')).default(subcommand);
    case 'version': return printVersion();
    case 'info':    return (await import('./src/cli/commands/info.mjs')).default(flags, options);
    case 'env':     return (await import('./src/cli/env.mjs')).show(flags);
    case 'config':  return (await import('./src/cli/commands/config.mjs')).default(subcommand, positionals, flags);
    case 'status':  return (await import('./src/cli/commands/status.mjs')).default(flags);
    case 'health':  return (await import('./src/cli/commands/health.mjs')).default(flags, options);
    case 'start':   return (await import('./src/cli/commands/start.mjs')).default(flags, options);
    case 'stop':    return (await import('./src/cli/commands/stop.mjs')).default(subcommand, flags, options);
    case 'restart': return (await import('./src/cli/commands/start.mjs')).restart(flags, options);
    case 'dev':     return (await import('./src/cli/commands/dev.mjs')).default(flags, options);
    case 'list':    return (await import('./src/cli/commands/list.mjs')).default(subcommand, flags, options, positionals);
    case 'logs':    return (await import('./src/cli/commands/logs.mjs')).default(flags, options);
    case 'build':   return (await import('./src/cli/commands/build.mjs')).default(flags, options);
    case 'cleanup': return (await import('./src/cli/commands/cleanup.mjs')).default(subcommand, flags, options);
    case 'generate':return (await import('./src/cli/commands/generate.mjs')).default(subcommand, flags, options, positionals);
    default:
      print(`Unknown command: ${command}\n`);
      const help = await import('./src/cli/help.mjs');
      help.default();
      exit(1);
  }
}

main().catch(err => {
  console.error('CLI error:', err.message);
  exit(1);
});

// ── Argument parser ─────────────────────────────────────────────────────────
function parseArgs(argv) {
  const result = {
    command: null,
    subcommand: null,
    flags: { json: false, force: false, wait: false, help: false },
    options: {},
    positionals: [],
  };

  let i = 0;
  // Collect flags/options
  while (i < argv.length && argv[i].startsWith('--')) {
    const arg = argv[i];
    if (arg === '--json') { result.flags.json = true; i++; continue; }
    if (arg === '--force') { result.flags.force = true; i++; continue; }
    if (arg === '--wait')  { result.flags.wait = true; i++; continue; }
    if (arg === '--help' || arg === '-h') { result.flags.help = true; i++; continue; }
    if (arg.includes('=')) {
      const [key, ...vals] = arg.slice(2).split('=');
      result.options[key] = vals.join('=');
    } else if (i + 1 < argv.length && !argv[i+1].startsWith('--')) {
      result.options[arg.slice(2)] = argv[i+1];
      i += 2;
    } else {
      result.flags[arg.slice(2)] = true;
      i++;
    }
  }

  // Collect positional commands
  while (i < argv.length) {
    if (!result.command) {
      result.command = argv[i];
    } else if (!result.subcommand && !argv[i].startsWith('--')) {
      result.subcommand = argv[i];
    } else {
      result.positionals.push(argv[i]);
    }
    i++;
  }

  if (result.flags.help && result.command) {
    // use it as help subcommand
    result.subcommand = result.command;
    result.command = 'help';
  }

  return result;
}

// ── Utilities ───────────────────────────────────────────────────────────────
function print(msg) { process.stdout.write(msg); }
function printVersion() {
  const pkgPath = join(__dirname, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  print(`ACE-Step UI v${pkg.version} (node ${process.version})\n`);
}
function exit(code) { process.exit(code); }

// ── Exit codes ──────────────────────────────────────────────────────────────
export const EXIT = {
  SUCCESS: 0,
  ERROR: 1,
  ALREADY_RUNNING: 2,
  NOT_RUNNING: 3,
  GENERATE_FAILED: 4,
  FILE_NOT_FOUND: 5,
  TIMEOUT: 6,
  LLM_NOT_INIT: 7,
};
