/**
 * Status command — check all service statuses
 */
import output from '../output.mjs';
import pid from '../pid.mjs';
import { readEnv } from '../env.mjs';

export default async function statusCmd(flags) {
  const allPids = pid.readAllPids();
  const services = [];

  for (const [service, currentPid] of Object.entries(allPids)) {
    const running = currentPid ? pid.isAlive(currentPid) : false;
    const procInfo = running ? pid.getProcessInfo(currentPid) : {};
    const portKey = service === 'engine' ? 'GRADIO_PORT' : 'SERVER_PORT';
    const defaultPort = service === 'engine' ? '7860' : '3001';
    const port = process.env[portKey] || defaultPort;

    services.push({
      name: service,
      running,
      pid: currentPid || null,
      port: parseInt(port, 10),
      memory: procInfo.memory || 'N/A',
      uptime: procInfo.uptime || 0,
    });
  }

  const allRunning = services.every(s => s.running);
  const lines = services.map(s =>
    `  ${s.name.charAt(0).toUpperCase() + s.name.slice(1)}: ${s.running ? 'RUNNING' : 'STOPPED'}` +
    (s.running ? ` (PID: ${s.pid}, Port: ${s.port}, Memory: ${s.memory})` : '')
  );

  output.auto(
    ACE_STEP_ASCII + '\n' + lines.join('\n'),
    { running: allRunning, services }
  );
  output.exit(allRunning ? 0 : 3);
}

const ACE_STEP_ASCII = `
  ╔══════════════════════════╗
  ║      ACE-Step 1.5       ║
  ╚══════════════════════════╝
`;
