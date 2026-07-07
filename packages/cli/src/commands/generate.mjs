/**
 * Generate command — CLI music generation via engine API
 */
import { generateMusicViaAPI, getJobStatus } from '@acestep/engine';
import output from '../output.mjs';

export default async function generateCmd(subcommand, flags, options, positionals) {
  const prompt = (positionals.join(' ') || options.prompt || '').trim();
  if (!prompt) {
    output.printError('请提供音乐描述\n用法: acestep generate "描述文字" [--style pop] [--duration 30]\n');
    output.exit(1);
    return;
  }

  const style = options.style || 'pop';
  const duration = parseInt(options.duration, 10) || 30;
  const lyrics = options.lyrics || '';
  const instrumental = flags.instrumental || false;
  const bpm = parseInt(options.bpm, 10) || undefined;
  const keyScale = options.key || undefined;

  output.print('正在生成音乐...\n');
  output.print(`  描述: ${prompt}\n`);
  output.print(`  风格: ${style}\n`);
  output.print(`  时长: ${duration}s\n`);
  if (lyrics) output.print(`  歌词: ${lyrics.slice(0, 50)}${lyrics.length > 50 ? '...' : ''}\n`);

  try {
    const { jobId } = await generateMusicViaAPI({
      customMode: true,
      prompt,
      lyrics: lyrics || '',
      style,
      title: prompt.slice(0, 60) || 'Untitled',
      instrumental,
      duration: duration > 0 ? duration : undefined,
      bpm: bpm || undefined,
      keyScale: keyScale || undefined,
    });

    output.print(`\n任务已提交 (ID: ${jobId})\n`);
    output.print('正在等待生成完成...\n');

    // Poll for completion
    let completed = false;
    while (!completed) {
      await sleep(2000);
      const status = await getJobStatus(jobId);
      if (status.status === 'succeeded' && status.result) {
        output.print('\n生成完成！\n');
        for (const url of status.result.audioUrls) {
          output.print(`  音频: ${url}\n`);
        }
        completed = true;
      } else if (status.status === 'failed') {
        output.printError(`\n生成失败: ${status.error || '未知错误'}\n`);
        completed = true;
      } else {
        output.print(`  进度: ${status.stage || status.status}...\n`);
      }
    }

    output.exit(0);
  } catch (err) {
    output.printError(`生成请求失败: ${err.message}\n`);
    output.print('请确保引擎正在运行 (acestep start engine)\n');
    output.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
