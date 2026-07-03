/**
 * ACE-Step 核心引擎服务
 * 管理 Gradio API 调用、任务队列、Python fallback 生成
 */

import { writeFile, mkdir, copyFile, rm, readFile } from 'fs/promises';
import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handle_file } from '@gradio/client';
import { config } from './config.js';
import { getGradioClient, resetGradioClient, isGradioAvailable } from './gradio-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = config.paths.audioDir;
const ACESTEP_API = config.acestep.apiUrl;
const ACESTEP_DIR = config.paths.projectRoot;
const SCRIPTS_DIR = config.paths.scriptsDir;
const PYTHON_SCRIPT = path.join(SCRIPTS_DIR, 'simple_generate.py');

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function getAudioDuration(filePath: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf-8', timeout: 10000 },
    );
    const duration = parseFloat(result.trim());
    return isNaN(duration) ? 0 : Math.round(duration);
  } catch {
    return 0;
  }
}

export function resolvePythonPath(baseDir: string): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;

  const isWindows = process.platform === 'win32';
  const pythonExe = isWindows ? 'python.exe' : 'python';

  const portablePath = path.join(baseDir, 'python_embeded', pythonExe);
  if (existsSync(portablePath)) return portablePath;

  const venvDirs = ['env', '.venv', 'venv'];
  for (const venvDir of venvDirs) {
    const venvPython = isWindows
      ? path.join(baseDir, venvDir, 'Scripts', pythonExe)
      : path.join(baseDir, venvDir, 'bin', 'python');
    if (existsSync(venvPython)) return venvPython;
  }

  return isWindows
    ? path.join(baseDir, 'env', 'Scripts', pythonExe)
    : path.join(baseDir, 'env', 'bin', 'python');
}

// ── 音频路径处理 ──────────────────────────────────────────────────────────────

function resolveAudioPath(audioUrl: string): string {
  if (audioUrl.startsWith('/audio/')) {
    return path.join(AUDIO_DIR, audioUrl.replace('/audio/', ''));
  }
  if (audioUrl.startsWith('http')) {
    try {
      const parsed = new URL(audioUrl);
      if (parsed.pathname.startsWith('/audio/')) {
        return path.join(AUDIO_DIR, parsed.pathname.replace('/audio/', ''));
      }
    } catch { /* ignore */ }
  }
  return audioUrl;
}

async function prepareAudioFile(audioUrl: string | undefined): Promise<unknown> {
  if (!audioUrl) return null;
  const filePath = resolveAudioPath(audioUrl);
  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.flac': 'audio/flac', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
      '.opus': 'audio/opus', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4',
    };
    const blob = new Blob([buffer], { type: mimeMap[ext] || 'audio/mpeg' });
    return handle_file(blob);
  } catch {
    if (audioUrl.startsWith('http')) return handle_file(audioUrl);
    return null;
  }
}

// ── 类型定义 ──────────────────────────────────────────────────────────────────

export interface GenerationParams {
  customMode: boolean;
  songDescription?: string;
  lyrics: string;
  style: string;
  title: string;
  instrumental: boolean;
  vocalLanguage?: string;
  duration?: number;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  inferenceSteps?: number;
  guidanceScale?: number;
  batchSize?: number;
  randomSeed?: boolean;
  seed?: number;
  thinking?: boolean;
  enhance?: boolean;
  audioFormat?: 'mp3' | 'flac';
  inferMethod?: 'ode' | 'sde';
  shift?: number;
  lmTemperature?: number;
  lmCfgScale?: number;
  lmTopK?: number;
  lmTopP?: number;
  lmNegativePrompt?: string;
  lmBackend?: 'pt' | 'vllm';
  lmModel?: string;
  referenceAudioUrl?: string;
  sourceAudioUrl?: string;
  referenceAudioTitle?: string;
  sourceAudioTitle?: string;
  audioCodes?: string;
  repaintingStart?: number;
  repaintingEnd?: number;
  instruction?: string;
  audioCoverStrength?: number;
  taskType?: string;
  useAdg?: boolean;
  cfgIntervalStart?: number;
  cfgIntervalEnd?: number;
  customTimesteps?: string;
  useCotMetas?: boolean;
  useCotCaption?: boolean;
  useCotLanguage?: boolean;
  autogen?: boolean;
  constrainedDecodingDebug?: boolean;
  allowLmBatch?: boolean;
  getScores?: boolean;
  getLrc?: boolean;
  scoreScale?: number;
  lmBatchChunkSize?: number;
  trackName?: string;
  completeTrackClasses?: string[];
  isFormatCaption?: boolean;
  ditModel?: string;
}

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

// ── 健康检查 ──────────────────────────────────────────────────────────────────

export async function checkSpaceHealth(): Promise<boolean> {
  return isGradioAvailable();
}

// ── 模型管理 ──────────────────────────────────────────────────────────────────

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

async function switchModelIfNeeded(ditModel: string): Promise<void> {
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

export function resetClient(): void {
  resetGradioClient();
}

// ── Gradio 参数映射 ───────────────────────────────────────────────────────────

async function buildGradioArgs(params: GenerationParams): Promise<unknown[]> {
  const caption = params.style || 'pop music';
  const prompt = params.customMode ? caption : (params.songDescription || caption);
  const lyrics = params.instrumental ? '' : (params.lyrics || '');
  const isThinking = params.thinking ?? false;
  const isEnhance = params.enhance ?? false;
  const referenceAudio = await prepareAudioFile(params.referenceAudioUrl);
  const sourceAudio = await prepareAudioFile(params.sourceAudioUrl);

  const needsSource = params.taskType === 'cover' || params.taskType === 'audio2audio' || params.taskType === 'repaint';
  if (needsSource && params.sourceAudioUrl && sourceAudio === null) {
    throw new Error(`Source audio file could not be loaded from: ${params.sourceAudioUrl}`);
  }

  const useCot = isEnhance || isThinking;

  return [
    prompt,
    lyrics,
    params.bpm && params.bpm > 0 ? params.bpm : 0,
    params.keyScale || '',
    params.timeSignature || '',
    params.vocalLanguage || 'en',
    params.inferenceSteps ?? 8,
    params.guidanceScale ?? 7.0,
    params.randomSeed !== false,
    String(params.seed ?? -1),
    referenceAudio,
    params.duration && params.duration > 0 ? params.duration : -1,
    Math.min(Math.max(params.batchSize ?? 1, 1), 16),
    sourceAudio,
    params.audioCodes || '',
    params.repaintingStart ?? 0.0,
    params.repaintingEnd ?? -1,
    params.instruction || 'Fill the audio semantic mask with the style described in the text prompt.',
    params.audioCoverStrength ?? 1.0,
    0.0,
    (params.taskType === 'audio2audio' ? 'cover' : params.taskType) || 'text2music',
    params.useAdg ?? false,
    params.cfgIntervalStart ?? 0.0,
    params.cfgIntervalEnd ?? 1.0,
    params.shift ?? 3.0,
    params.inferMethod || 'ode',
    params.customTimesteps || '',
    params.audioFormat || 'mp3',
    params.lmTemperature ?? 0.85,
    isThinking,
    params.lmCfgScale ?? 2.0,
    params.lmTopK ?? 0,
    params.lmTopP ?? 0.9,
    params.lmNegativePrompt || 'NO USER INPUT',
    useCot ? (params.useCotMetas ?? true) : false,
    useCot ? (params.useCotCaption ?? true) : false,
    useCot ? (params.useCotLanguage ?? true) : false,
    params.isFormatCaption ?? false,
    params.constrainedDecodingDebug ?? false,
    params.allowLmBatch ?? true,
    params.getScores ?? false,
    params.getLrc ?? false,
    params.scoreScale ?? 0.5,
    params.lmBatchChunkSize ?? 8,
    params.trackName || null,
    params.completeTrackClasses || [],
    true,
    -1.0,
    0.0,
    1.0,
    params.autogen ?? false,
  ];
}

// ── 音频下载 ──────────────────────────────────────────────────────────────────

async function downloadGradioAudioFile(
  fileObj: { url?: string; path?: string; orig_name?: string },
  destPath: string,
): Promise<void> {
  await mkdir(path.dirname(destPath), { recursive: true });

  if (fileObj.path && existsSync(fileObj.path)) {
    await copyFile(fileObj.path, destPath);
    return;
  }

  if (fileObj.url) {
    const response = await fetch(fileObj.url);
    if (!response.ok) throw new Error(`Failed to download Gradio audio: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw new Error('Downloaded audio file is empty');
    const tmpPath = destPath + '.tmp';
    await writeFile(tmpPath, buffer);
    const { rename } = await import('fs/promises');
    await rename(tmpPath, destPath);
    return;
  }

  throw new Error('Gradio file object has neither path nor url');
}

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
  await processGenerationViaPython(jobId, params, job);
}

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

function isAudioFile(name: string): boolean {
  return /\.(mp3|flac|wav|ogg|m4a)$/i.test(name);
}

function parseGenerationDetails(details: string | undefined): {
  bpm?: number; duration?: number; keyScale?: string; timeSignature?: string;
} {
  if (!details) return {};
  try {
    const bpmMatch = details.match(/BPM:\s*(\d+)/i);
    const durationMatch = details.match(/Duration:\s*([\d.]+)/i);
    const keyMatch = details.match(/Key:\s*([A-G][#b]?\s*(?:major|minor))/i);
    const timeMatch = details.match(/Time Signature:\s*(\d+\/\d+)/i);
    return {
      bpm: bpmMatch ? parseInt(bpmMatch[1]) : undefined,
      duration: durationMatch ? parseFloat(durationMatch[1]) : undefined,
      keyScale: keyMatch ? keyMatch[1] : undefined,
      timeSignature: timeMatch ? timeMatch[1] : undefined,
    };
  } catch {
    return {};
  }
}

// ── Python Fallback ───────────────────────────────────────────────────────────

async function processGenerationViaPython(jobId: string, params: GenerationParams, job: ActiveJob): Promise<void> {
  const caption = params.style || 'pop music';
  const prompt = params.customMode ? caption : (params.songDescription || caption);
  const lyrics = params.instrumental ? '' : (params.lyrics || '');

  console.log(`Job ${jobId}: Using Python spawn (Gradio not available)`, {
    prompt: prompt.slice(0, 50),
    lyricsPreview: lyrics.slice(0, 50),
  });

  try {
    const jobOutputDir = path.join(ACESTEP_DIR, 'output', jobId);
    await mkdir(jobOutputDir, { recursive: true });

    const durationToSend = params.duration && params.duration > 0 ? params.duration : 60;
    const args = [
      '--prompt', prompt,
      '--duration', String(durationToSend),
      '--batch-size', String(params.batchSize ?? 1),
      '--infer-steps', String(params.inferenceSteps ?? 8),
      '--guidance-scale', String(params.guidanceScale ?? 10.0),
      '--audio-format', params.audioFormat ?? 'mp3',
      '--output-dir', jobOutputDir,
      '--json',
    ];

    if (lyrics) args.push('--lyrics', lyrics);
    if (params.instrumental) args.push('--instrumental');
    if (params.bpm && params.bpm > 0) args.push('--bpm', String(params.bpm));
    if (params.keyScale) args.push('--key-scale', params.keyScale);
    if (params.timeSignature) args.push('--time-signature', params.timeSignature);
    if (params.vocalLanguage) args.push('--vocal-language', params.vocalLanguage);
    if (params.seed !== undefined && params.seed >= 0 && !params.randomSeed) args.push('--seed', String(params.seed));
    if (params.shift !== undefined) args.push('--shift', String(params.shift));
    const resolvedTaskType = params.taskType === 'audio2audio' ? 'cover' : params.taskType;
    if (resolvedTaskType && resolvedTaskType !== 'text2music') args.push('--task-type', resolvedTaskType);
    if (params.referenceAudioUrl) args.push('--reference-audio', resolveAudioPath(params.referenceAudioUrl));
    if (params.sourceAudioUrl) args.push('--src-audio', resolveAudioPath(params.sourceAudioUrl));
    if (params.audioCodes) args.push('--audio-codes', params.audioCodes);
    if (params.repaintingStart !== undefined && params.repaintingStart > 0) args.push('--repainting-start', String(params.repaintingStart));
    if (params.repaintingEnd !== undefined && params.repaintingEnd > 0) args.push('--repainting-end', String(params.repaintingEnd));
    if (params.taskType === 'cover' || params.taskType === 'repaint' || params.sourceAudioUrl) {
      args.push('--audio-cover-strength', String(params.audioCoverStrength ?? 1.0));
    } else if (params.audioCoverStrength !== undefined && params.audioCoverStrength !== 1.0) {
      args.push('--audio-cover-strength', String(params.audioCoverStrength));
    }
    if (params.instruction) args.push('--instruction', params.instruction);
    if (params.thinking) args.push('--thinking');
    if (params.lmTemperature !== undefined) args.push('--lm-temperature', String(params.lmTemperature));
    if (params.lmCfgScale !== undefined) args.push('--lm-cfg-scale', String(params.lmCfgScale));
    if (params.lmTopK !== undefined && params.lmTopK > 0) args.push('--lm-top-k', String(params.lmTopK));
    if (params.lmTopP !== undefined) args.push('--lm-top-p', String(params.lmTopP));
    if (params.lmNegativePrompt) args.push('--lm-negative-prompt', params.lmNegativePrompt);
    if (params.useCotMetas === false) args.push('--no-cot-metas');
    if (params.useCotCaption === false) args.push('--no-cot-caption');
    if (params.useCotLanguage === false) args.push('--no-cot-language');
    if (params.useAdg) args.push('--use-adg');
    if (params.cfgIntervalStart !== undefined && params.cfgIntervalStart > 0) args.push('--cfg-interval-start', String(params.cfgIntervalStart));
    if (params.cfgIntervalEnd !== undefined && params.cfgIntervalEnd < 1.0) args.push('--cfg-interval-end', String(params.cfgIntervalEnd));

    const result = await runPythonGeneration(args);
    if (!result.success) throw new Error(result.error || 'Generation failed');
    if (!result.audio_paths || result.audio_paths.length === 0) throw new Error('No audio files generated');

    const audioUrls: string[] = [];
    let actualDuration = 0;
    for (const srcPath of result.audio_paths) {
      const ext = srcPath.includes('.flac') ? '.flac' : '.mp3';
      const filename = `${jobId}_${audioUrls.length}${ext}`;
      const destPath = path.join(AUDIO_DIR, filename);
      await mkdir(AUDIO_DIR, { recursive: true });
      await copyFile(srcPath, destPath);
      if (audioUrls.length === 0) actualDuration = getAudioDuration(destPath);
      audioUrls.push(`/audio/${filename}`);
    }

    try { await rm(jobOutputDir, { recursive: true, force: true }); } catch { /* ignore */ }

    job.status = 'succeeded';
    job.result = {
      audioUrls,
      duration: actualDuration > 0 ? actualDuration : (params.duration || 0),
      bpm: params.bpm,
      keyScale: params.keyScale,
      timeSignature: params.timeSignature,
      status: 'succeeded',
    };
    job.rawResponse = result;
    console.log(`Job ${jobId}: Completed via Python with ${audioUrls.length} audio files`);
  } catch (error) {
    console.error(`Job ${jobId}: Generation failed`, error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Generation failed';
    try {
      const jobOutputDir = path.join(ACESTEP_DIR, 'output', jobId);
      await rm(jobOutputDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

interface PythonResult {
  success: boolean;
  audio_paths?: string[];
  elapsed_seconds?: number;
  error?: string;
}

function runPythonGeneration(scriptArgs: string[], timeoutMs = 600000): Promise<PythonResult> {
  return new Promise((resolve) => {
    const pythonPath = resolvePythonPath(ACESTEP_DIR);
    const args = [PYTHON_SCRIPT, ...scriptArgs];
    const proc = spawn(pythonPath, args, {
      cwd: ACESTEP_DIR,
      env: { ...process.env, ACESTEP_PATH: ACESTEP_DIR },
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 5000);
      resolve({ success: false, error: `Generation timed out after ${timeoutMs / 1000}s` });
    }, timeoutMs);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      for (const line of data.toString().split('\n')) {
        if (line.trim()) console.log(`[ACE-Step] ${line}`);
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ success: false, error: stderr || `Process exited with code ${code}` });
        return;
      }
      const lines = stdout.split('\n').filter(l => l.trim());
      const jsonLine = lines.find(l => l.startsWith('{'));
      if (!jsonLine) {
        resolve({ success: false, error: 'No JSON output from generation script' });
        return;
      }
      try {
        resolve(JSON.parse(jsonLine));
      } catch {
        resolve({ success: false, error: 'Invalid JSON from generation script' });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });
  });
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

export function cleanupJob(jobId: string): void {
  activeJobs.delete(jobId);
}

export function cleanupOldJobs(maxAgeMs = 3600000): void {
  const now = Date.now();
  for (const [jobId, job] of activeJobs) {
    if (now - job.startTime > maxAgeMs) activeJobs.delete(jobId);
  }
}
