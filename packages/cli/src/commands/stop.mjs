import output from '../output.mjs';
import pid from '../pid.mjs';
import { stopDaemon } from '../daemon.mjs';

export default async function stopCmd(subcommand, flags, options) {
  if (subcommand === 'engine') {
    return stopService('engine', flags, options);
  }

  if (subcommand === 'llm') {
    output.auto('LLM 是远程 API，无法本地停止', { message: 'LLM is remote API' });
    output.exit(0);
    return;
  }
  if (subcommand === 'music') {
    output.auto('请通过 Gradio API 停止音乐生成', { message: 'Stop via Gradio API' });
    output.exit(0);
    return;
  }

  return stopService('server', flags, options);
}

async function stopService(service, flags, options) {
  const currentPid = pid.readPid(service);
  if (!currentPid || !pid.isAlive(currentPid)) {
    const svcName = service === 'engine' ? '引擎' : '服务';
    output.auto(`${svcName}未在运行`, { running: false });
    output.exit(3);
    return;
  }

  const timeout = parseInt(options.timeout, 10) || 10000;
  const result = await stopDaemon(currentPid, { timeout, force: !!flags.force });
  pid.cleanPid(service);

  const svcName = service === 'engine' ? '引擎' : '服务';
  output.auto(`${svcName}已停止 (${result.method})`, {
    success: true, method: result.method, service,
  });
  output.exit(0);
}
