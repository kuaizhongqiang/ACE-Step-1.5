// @acestep/engine — 核心引擎 barrel export

export {
  generateMusicViaAPI,
  getJobStatus,
  getJobRawResponse,
  getAudioStream,
  downloadAudio,
  downloadAudioToBuffer,
  discoverEndpoints,
  checkSpaceHealth,
  cleanupJob,
  cleanupOldJobs,
  resetClient,
  resolvePythonPath,
} from './acestep.js';

export type {
  GenerationParams,
  JobStatus,
  GenerationResult,
} from './acestep.js';

export {
  getGradioClient,
  resetGradioClient,
  isGradioAvailable,
} from './gradio-client.js';

export {
  chatCompletion,
  formatMusicDescription,
  generateCoT,
} from './deepseek.js';

export {
  generationQueue,
} from './generation-queue.js';

export type {
  QueueConfig,
} from './generation-queue.js';
