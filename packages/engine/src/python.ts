/**
 * Python process management — fallback generation when Gradio is unavailable
 */
import { spawn, execSync } from 'child_process';
import { writeFile, mkdir, copyFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { GenerationParams } from '@acestep/shared';
import { config } from './config.js';
import { getAudioDuration, resolveAudioPath } from './audio.js';

const ACESTEP_DIR = config.paths.projectRoot;
const SCRIPTS_DIR = config.paths.scriptsDir;
const AUDIO_DIR = config.paths.audioDir;
const PYTHON_SCRIPT = path.join(SCRIPTS_DIR, 'simple_generate.py');

export async function processGenerationViaPython(
  jobId: string,
  params: GenerationParams,
  audioDir: string,
): Promise<{ audioUrls: string[]; duration: number }> {
  const caption = params.style || 'pop music';
  const prompt = params.customMode ? caption : (params.songDescription || caption);
  const lyrics = params.instrumental ? '' : (params.lyrics || '');

  console.log(`Job ${jobId}: Using Python spawn (Gradio not available)`, {
    prompt: prompt.slice(0, 50),
    lyricsPreview: lyrics.slice(0, 50),
  });

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
    const destPath = path.join(audioDir, filename);
    await mkdir(audioDir, { recursive: true });
    await copyFile(srcPath, destPath);
    if (audioUrls.length === 0) actualDuration = getAudioDuration(destPath);
    audioUrls.push(`/audio/${filename}`);
  }

  try { await rm(jobOutputDir, { recursive: true, force: true }); } catch { /* ignore */ }

  return { audioUrls, duration: actualDuration > 0 ? actualDuration : (params.duration || 0) };
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
