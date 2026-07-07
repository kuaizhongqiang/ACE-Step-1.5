/**
 * Build command — build frontend production bundle
 */
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import output from '../output.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..', '..');

export default async function buildCmd(flags, options) {
  output.print('构建前端生产包...\n');
  try {
    execSync('npm run build -w packages/front', { cwd: ROOT_DIR, stdio: 'inherit', timeout: 120000 });
    output.print('前端构建完成\n');
    output.exit(0);
  } catch (e) {
    output.printError('构建失败: ' + e.message);
    output.exit(1);
  }
}
