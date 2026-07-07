/**
 * Generate command — CLI music generation via engine API
 */
import output from '../output.mjs';

export default async function generateCmd(subcommand, flags, options, positionals) {
  const prompt = positionals.join(' ') || options.prompt;
  if (!prompt) {
    output.printError('请提供音乐描述\n用法: acestep generate "描述文字" [--style pop] [--duration 30]\n');
    output.exit(1);
    return;
  }

  const style = options.style || 'pop';
  const duration = parseInt(options.duration, 10) || 30;

  output.print(`正在生成音乐...\n`);
  output.print(`  描述: ${prompt}\n`);
  output.print(`  风格: ${style}\n`);
  output.print(`  时长: ${duration}s\n`);
  output.print(`\n此功能需要通过 API 调用 Gradio。\n`);
  output.print(`请确保 engine 正在运行 (acestep start engine)\n`);
  output.exit(0);
}
