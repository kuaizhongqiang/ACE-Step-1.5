import output from '../output.mjs';
import pid from '../pid.mjs';
import { stopDaemon } from '../daemon.mjs';

export default async function stopCmd(subcommand, flags, options) {
  if (subcommand === 'engine') {
    return stopService('engine', flags, options);
  }

  if (subcommand === 'llm') {
    output.auto('LLM is a remote API, cannot stop locally', { message: 'LLM is remote API' });
    output.exit(0);
    return;
  }
  if (subcommand === 'music') {
    output.auto('Use Gradio API to stop music generation', { message: 'Stop via Gradio API' });
    output.exit(0);
    return;
  }

  return stopService('server', flags, options);
}

async function stopService(service, flags, options) {
  const currentPid = pid.readPid(service);
  if (!currentPid || !pid.isAlive(currentPid)) {
    output.auto(`${service.charAt(0).toUpperCase() + service.slice(1)} is not running`, { running: false });
    output.exit(3);
    return;
  }

  const timeout = parseInt(options.timeout, 10) || 10000;
  const result = await stopDaemon(currentPid, { timeout, force: !!flags.force });
  pid.cleanPid(service);

  output.auto(`${service.charAt(0).toUpperCase() + service.slice(1)} stopped (${result.method})`, {
    success: true, method: result.method, service,
  });
  output.exit(0);
}
