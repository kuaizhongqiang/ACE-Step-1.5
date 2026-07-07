import output from '../output.mjs';
import { spawnDev } from '../daemon.mjs';

export default async function devCmd(flags, options) {
  const enginePort = options.enginePort || '7860';
  const serverPort = options.port || '3001';
  const frontPort = options.frontendPort || '3000';

  output.print(`Starting dev mode (engine:${enginePort}, server:${serverPort}, front:${frontPort})...`);
  spawnDev({ enginePort: parseInt(enginePort, 10), serverPort: parseInt(serverPort, 10), frontPort: parseInt(frontPort, 10) });
}
