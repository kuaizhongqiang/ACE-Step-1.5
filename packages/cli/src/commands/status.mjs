/**
 * Status command — check if server is running
 */
import output from '../output.mjs';
import pid from '../pid.mjs';
import { readEnv } from '../env.mjs';

export default async function statusCmd(flags) {
  const currentPid = pid.readPid();
  const running = currentPid ? pid.isAlive(currentPid) : false;

  if (!running) {
    output.auto('Server is not running', { running: false });
    output.exit(3);
    return;
  }

  const procInfo = pid.getProcessInfo(currentPid);
  const env = readEnv();
  const port = env.sections.server?.find(([k]) => k === 'PORT')?.[1] || '3001';

  const status = {
    running: true,
    pid: currentPid,
    port: parseInt(port, 10),
    memory: procInfo.memory,
    uptime: procInfo.uptime,
  };

  output.auto(
    `Server is running\n  PID: ${status.pid}\n  Port: ${status.port}\n  Memory: ${status.memory}`,
    status
  );
  output.exit(0);
}
