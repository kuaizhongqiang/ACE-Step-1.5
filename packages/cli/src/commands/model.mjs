/**
 * Model command — list, switch, download DiT models
 */
import { execSync } from 'child_process';
import output from '../output.mjs';

export default async function modelCmd(subcommand, flags, options, positionals) {
  switch (subcommand) {
    case 'list':
      return listModels();
    case 'switch':
      return switchModel(positionals[0]);
    case 'download':
      return downloadModel(positionals[0], flags);
    default:
      output.print('用法: acestep model <list|switch|download> [name]\n');
      output.exit(0);
  }
}

function listModels() {
  output.print('可用模型:\n');
  output.print('  acestep-v15-xl-base       — 完整质量 (4B)\n');
  output.print('  acestep-v15-turbo         — 快速生成 (2B)\n');
  output.print('  acestep-v15-turbo-shift1   — 快速 + 偏移1\n');
  output.print('  acestep-v15-turbo-shift3   — 快速 + 偏移3\n');
  output.print('  acestep-v15-turbo-continuous — 连续 timestep\n');
  output.print('  acestep-5Hz-lm-1.7B       — LM 模型\n');
  output.exit(0);
}

function switchModel(name) {
  if (!name) {
    output.printError('请指定模型名称\n');
    output.exit(1);
    return;
  }
  output.print(`切换模型至: ${name}\n`);
  output.print('请在 Gradio UI 或 API 中设置 model 参数。\n');
  output.exit(0);
}

function downloadModel(name, flags) {
  if (name) {
    output.print(`下载模型: ${name}...\n`);
    try {
      execSync(`uv run acestep-download --model ${name}`, { stdio: 'inherit', timeout: 600000 });
    } catch {
      output.printError('下载失败\n');
      output.exit(1);
    }
  } else {
    output.print('下载默认模型...\n');
    try {
      execSync('uv run acestep-download', { stdio: 'inherit', timeout: 600000 });
    } catch {
      output.printError('下载失败\n');
      output.exit(1);
    }
  }
  output.exit(0);
}
