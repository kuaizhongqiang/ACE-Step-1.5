/**
 * Parameter mapping — transforms GenerationParams into Gradio API arguments
 */
import type { GenerationParams } from '@acestep/shared';
import { prepareAudioFile } from './audio.js';

export async function buildGradioArgs(params: GenerationParams): Promise<unknown[]> {
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

export function parseGenerationDetails(details: string | undefined): {
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
