/**
 * ACE-Step 核心引擎服务
 * Orchestrates generation pipeline: Gradio API → Python fallback → job queue
 *
 * Feature areas extracted to sub-modules:
 *   audio.ts   — audio file utilities, duration, download
 *   params.ts  — Gradio parameter mapping
 *   python.ts  — Python subprocess fallback
 *   model.ts   — DiT model discovery and switching
 *   generation-queue.ts — job queue management (separate system)
 */
import { readFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GenerationParams } from '@acestep/shared';
import { config } from './config.js';
import {
  switchModelIfNeeded, checkSpaceHealth, discoverEndpoints, resetClient,
} from './model.js';
import { getGradioClient, isGradioAvailable } from './gradio-client.js';
import { buildGradioArgs, parseGenerationDetails } from './params.js';
import { processGenerationViaPython, resolvePythonPath } from './python.js';
import {
  getAudioDuration, resolveAudioPath, downloadGradioAudioFile, isAudioFile,
} from './audio.js';

// Re-export for public API (index.ts barrel export)
export { resolvePythonPath };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = config.paths.audioDir;
const ACESTEP_API = config.acestep.apiUrl;
const ACESTEP_DIR = config.paths.projectRoot;

// ── 类型定义 ──────────────────────────────────────────────────────────────────

export interface GenerationResult {
  audioUrls: string[];
  duration: number;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  status: string;
}

export interface JobStatus {
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  queuePosition?: number;
  etaSeconds?: number;
  progress?: number;
  stage?: string;
  result?: GenerationResult;
  error?: string;
}

interface ActiveJob {
  params: GenerationParams;
  startTime: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  taskId?: string;
  result?: GenerationResult;
  error?: string;
  processPromise?: Promise<void>;
  rawResponse?: unknown;
  queuePosition?: number;
  progress?: number;
  stage?: string;
}

const activeJobs = new Map<string, ActiveJob>();
const jobQueue: string[] = [];
let isProcessingQueue = false;

setInterval(() => cleanupOldJobs(3600000), 600000);

// ── 健康检查 + 模型 ──────────────────────────────────────────────────────────

export { checkSpaceHealth, discoverEndpoints, resetClient };

// ── 任务队列 ──────────────────────────────────────────────────────────────────

export async function generateMusicViaAPI(params: GenerationParams): Promise<{ jobId: string }> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const job: ActiveJob = {
    params,
    startTime: Date.now(),
    status: 'queued',
    queuePosition: jobQueue.length + 1,
  };
  activeJobs.set(jobId, job);
  jobQueue.push(jobId);
  console.log(`Job ${jobId}: Queued at position ${job.queuePosition}`);
  processQueue().catch(err => console.error('Queue processing error:', err));
  return { jobId };
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  while (jobQueue.length > 0) {
    const jobId = jobQueue[0];
    const job = activeJobs.get(jobId);
    if (job && job.status === 'queued') {
      try {
        await processGeneration(jobId, job.params, job);
      } catch (error) {
        console.error(`Queue processing error for ${jobId}:`, error);
      }
    }
    jobQueue.shift();
    jobQueue.forEach((id, index) => {
      const queuedJob = activeJobs.get(id);
      if (queuedJob) queuedJob.queuePosition = index + 1;
    });
  }
  isProcessingQueue = false;
}

async function processGeneration(jobId: string, params: GenerationParams, job: ActiveJob): Promise<void> {
  job.status = 'running';
  job.stage = 'Starting generation...';

  if ((params.taskType === 'cover' || params.taskType === 'audio2audio') && !params.sourceAudioUrl && !params.audioCodes) {
    job.status = 'failed';
    job.error = `task_type='${params.taskType}' requires a source audio or audio codes`;
    return;
  }

  const gradioUp = await isGradioAvailable();
  if (gradioUp) {
    try {
      await processGenerationViaGradio(jobId, params, job);
      return;
    } catch (error) {
      console.error(`Job ${jobId}: Gradio generation failed, trying Python spawn fallback`, error);
    }
  }
  await processGenerationViaPythonFallback(jobId, params, job);
}

// ── Gradio 生成 ──────────────────────────────────────────────────────────────

async function processGenerationViaGradio(jobId: string, params: GenerationParams, job: ActiveJob): Promise<void> {
  if (params.ditModel) {
    job.stage = `Loading model ${params.ditModel}...`;
    await switchModelIfNeeded(params.ditModel);
  }

  const client = await getGradioClient();
  const args = await buildGradioArgs(params);
  const caption = params.style || 'pop music';
  const prompt = params.customMode ? caption : (params.songDescription || caption);

  console.log(`Job ${jobId}: Using Gradio /generation_wrapper`, {
    prompt: prompt.slice(0, 50),
    duration: params.duration,
    batchSize: params.batchSize,
  });

  job.stage = 'Generating music via Gradio...';
  const result = await client.predict('/generation_wrapper', args);
  const data = result.data as unknown[];

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Gradio returned unexpected data format: ${typeof data}`);
  }

  const allFiles = data[8];
  const genDetails = data[9] as string | undefined;
  const genStatus = data[10] as string | undefined;

  let audioFileObjects: Array<{ url?: string; path?: string; orig_name?: string }> = [];

  if (Array.isArray(allFiles) && allFiles.length > 0) {
    audioFileObjects = allFiles.filter(
      (f: any) => f && (f.path || f.url) && isAudioFile(f.orig_name || f.path || ''),
    );
  }

  if (audioFileObjects.length === 0) {
    for (let i = 0; i < 8; i++) {
      const fileObj = data[i] as any;
      if (fileObj && (fileObj.path || fileObj.url)) {
        audioFileObjects.push(fileObj);
      }
    }
  }

  if (audioFileObjects.length === 0) {
    throw new Error(`Gradio generation returned no audio files. Status: ${genStatus || 'unknown'}. Details: ${genDetails || 'none'}`);
  }

  const audioUrls: string[] = [];
  let actualDuration = 0;
  const audioFormat = params.audioFormat ?? 'mp3';

  for (const fileObj of audioFileObjects) {
    const origName = fileObj.orig_name || fileObj.path || '';
    const ext = origName.includes('.flac') ? '.flac' : `.${audioFormat}`;
    const filename = `${jobId}_${audioUrls.length}${ext}`;
    const destPath = path.join(AUDIO_DIR, filename);
    await downloadGradioAudioFile(fileObj, destPath);
    if (audioUrls.length === 0) actualDuration = getAudioDuration(destPath);
    audioUrls.push(`/audio/${filename}`);
  }

  const metas = parseGenerationDetails(genDetails);
  const finalDuration = actualDuration > 0 ? actualDuration : (metas.duration || params.duration || 0);

  job.status = 'succeeded';
  job.result = {
    audioUrls,
    duration: finalDuration,
    bpm: metas.bpm || params.bpm,
    keyScale: metas.keyScale || params.keyScale,
    timeSignature: metas.timeSignature || params.timeSignature,
    status: 'succeeded',
  };
  job.rawResponse = { genDetails, genStatus };
  console.log(`Job ${jobId}: Completed via Gradio with ${audioUrls.length} audio files`);
}

// ── Python Fallback ───────────────────────────────────────────────────────────

async function processGenerationViaPythonFallback(jobId: string, params: GenerationParams, job: ActiveJob): Promise<void> {
  job.stage = 'Generating music via Python fallback...';
  try {
    const { audioUrls, duration } = await processGenerationViaPython(jobId, params, AUDIO_DIR);
    job.status = 'succeeded';
    job.result = {
      audioUrls,
      duration,
      bpm: params.bpm,
      keyScale: params.keyScale,
      timeSignature: params.timeSignature,
      status: 'succeeded',
    };
    console.log(`Job ${jobId}: Completed via Python with ${audioUrls.length} audio files`);
  } catch (error) {
    console.error(`Job ${jobId}: Generation failed`, error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Generation failed';
  }
}

// ── 任务状态 ──────────────────────────────────────────────────────────────────

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const job = activeJobs.get(jobId);
  if (!job) return { status: 'failed', error: 'Job not found' };
  if (job.status === 'succeeded' && job.result) return { status: 'succeeded', result: job.result };
  if (job.status === 'failed') return { status: 'failed', error: job.error || 'Generation failed' };
  const elapsed = Math.floor((Date.now() - job.startTime) / 1000);
  if (job.status === 'queued') {
    return { status: job.status, queuePosition: job.queuePosition, etaSeconds: (job.queuePosition || 1) * 180 };
  }
  return { status: job.status, etaSeconds: Math.max(0, 180 - elapsed), progress: job.progress, stage: job.stage };
}

export function getJobRawResponse(jobId: string): unknown | null {
  return activeJobs.get(jobId)?.rawResponse || null;
}

// ── 音频流 ──────────────────────────────────────────────────────────────────

export async function getAudioStream(audioPath: string): Promise<Response> {
  if (audioPath.startsWith('http')) return fetch(audioPath);
  if (audioPath.startsWith('/audio/')) {
    const localPath = path.join(AUDIO_DIR, audioPath.replace('/audio/', ''));
    try {
      const buffer = await readFile(localPath);
      const ext = localPath.endsWith('.flac') ? 'flac' : 'mpeg';
      return new Response(buffer, { status: 200, headers: { 'Content-Type': `audio/${ext}` } });
    } catch {
      return new Response(null, { status: 404 });
    }
  }
  if (audioPath.startsWith('/')) {
    try {
      const buffer = await readFile(audioPath);
      const ext = audioPath.endsWith('.flac') ? 'flac' : audioPath.endsWith('.wav') ? 'wav' : 'mpeg';
      return new Response(buffer, { status: 200, headers: { 'Content-Type': `audio/${ext}` } });
    } catch { /* fall through */ }
  }
  return fetch(`${ACESTEP_API}/v1/audio?path=${encodeURIComponent(audioPath)}`);
}

export async function downloadAudio(remoteUrl: string, songId: string): Promise<string> {
  await mkdir(AUDIO_DIR, { recursive: true });
  const response = await getAudioStream(remoteUrl);
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const ext = remoteUrl.includes('.flac') ? '.flac' : '.mp3';
  const filename = `${songId}${ext}`;
  const filepath = path.join(AUDIO_DIR, filename);
  await writeFile(filepath, Buffer.from(buffer));
  return `/audio/${filename}`;
}

export async function downloadAudioToBuffer(remoteUrl: string): Promise<{ buffer: Buffer; size: number }> {
  const response = await getAudioStream(remoteUrl);
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), size: arrayBuffer.byteLength };
}

// ── 清理 ──────────────────────────────────────────────────────────────────────

export function cleanupJob(jobId: string): void {
  activeJobs.delete(jobId);
}

export function cleanupOldJobs(maxAgeMs = 3600000): void {
  const now = Date.now();
  for (const [jobId, job] of activeJobs) {
    if (now - job.startTime > maxAgeMs) activeJobs.delete(jobId);
  }
}
