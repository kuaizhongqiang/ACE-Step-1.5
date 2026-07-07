/**
 * Install command — first-time setup
 * uv sync + npm install + model download
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import output from '../output.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..', '..');

export default async function installCmd(flags, options) {
  const skipModels = flags['skip-models'];

  output.print('=== ACE-Step 1.5 安装 ===\n');

  // Step 1: Python deps
  output.print('[1/3] 安装 Python 依赖 (uv sync)...\n');
  try {
    execSync('uv sync', { cwd: ROOT_DIR, stdio: 'inherit', timeout: 300000 });
    output.print('  Python 依赖安装完成\n');
  } catch (e) {
    output.printError('  Python 依赖安装失败: ' + e.message);
    output.exit(1);
    return;
  }

  // Step 2: Node.js deps
  output.print('[2/3] 安装 Node.js 依赖 (npm install)...\n');
  try {
    execSync('npm install', { cwd: ROOT_DIR, stdio: 'inherit', timeout: 300000 });
    output.print('  Node.js 依赖安装完成\n');
  } catch (e) {
    output.printError('  Node.js 依赖安装失败: ' + e.message);
    output.exit(1);
    return;
  }

  // Step 3: Model download
  if (!skipModels) {
    output.print('[3/3] 下载模型...\n');
    try {
      execSync('uv run acestep-download', { cwd: ROOT_DIR, stdio: 'inherit', timeout: 600000 });
      output.print('  模型下载完成\n');
    } catch (e) {
      output.printError('  模型下载失败（可后续手动运行 acestep model download）: ' + e.message);
    }
  } else {
    output.print('[3/3] 跳过模型下载 (--skip-models)\n');
  }

  output.print('\n安装完成！运行 acestep dev 启动。\n');
  output.exit(0);
}
