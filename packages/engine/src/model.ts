/**
 * Model management — DiT model discovery and switching
 */
import { config } from './config.js';
import { isGradioAvailable, resetGradioClient } from './gradio-client.js';

const ACESTEP_API = config.acestep.apiUrl;

export async function checkSpaceHealth(): Promise<boolean> {
  return isGradioAvailable();
}

async function getActiveModel(): Promise<string | null> {
  try {
    const res = await fetch(`${ACESTEP_API}/v1/models`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    const models = data?.data?.models || data?.models || [];
    return models[0]?.name || null;
  } catch {
    return null;
  }
}

export async function switchModelIfNeeded(ditModel: string): Promise<void> {
  const activeModel = await getActiveModel();
  if (activeModel === ditModel) return;

  console.log(`[Model] Switching from '${activeModel ?? 'unknown'}' to '${ditModel}'`);
  const res = await fetch(`${ACESTEP_API}/v1/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ditModel, init_llm: false }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Model switch to '${ditModel}' failed: ${res.status} ${err}`);
  }
  console.log(`[Model] Switched to '${ditModel}'`);
}

export async function discoverEndpoints(): Promise<unknown> {
  return { provider: 'acestep-gradio', endpoint: ACESTEP_API };
}

export { resetGradioClient as resetClient } from './gradio-client.js';
