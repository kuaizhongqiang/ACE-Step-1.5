/**
 * DeepSeek API 服务 — 替代本地 LM 进行文本类任务
 */

import { config } from './config.js';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

interface DeepSeekResponse {
  id: string;
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage: { total_tokens: number; prompt_tokens: number; completion_tokens: number };
}

const API_URL = 'https://api.deepseek.com/v1/chat/completions';

/**
 * 调用 DeepSeek API 进行对话补全
 */
export async function chatCompletion(
  messages: DeepSeekMessage[],
  options: { temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<string> {
  if (!config.deepseek.apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const body: DeepSeekRequest = {
    model: config.deepseek.model || 'deepseek-chat',
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
  };

  if (options.json) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.deepseek.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown error');
    throw new Error(`DeepSeek API error (${response.status}): ${err}`);
  }

  const data: DeepSeekResponse = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * 将音乐描述转换为结构化元数据
 */
export async function formatMusicDescription(description: string): Promise<Record<string, unknown>> {
  const systemPrompt = `You are a music AI assistant. Given a user's music description, extract structured metadata.
Respond in JSON format with these fields:
- caption: detailed musical description for generation
- lyrics: suggested lyrics (or empty string for instrumental)
- bpm: beats per minute (number, null if unknown)
- duration: duration in seconds (number, null if unknown)
- key_scale: musical key (string, null if unknown)
- time_signature: time signature (string, null if unknown)
- vocal_language: language for vocals (string, default "en")
- instrumental: whether this should be instrumental (boolean)`;

  const userPrompt = `Describe this music concept: "${description}"`;
  const result = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { json: true, temperature: 0.3 });

  try {
    return JSON.parse(result);
  } catch {
    return { caption: description, error: 'Failed to parse structured output' };
  }
}

/**
 * 生成 Chain-of-Thought 元数据用于增强生成
 */
export async function generateCoT(songDescription: string, lyrics: string, style: string): Promise<{
  cot: string;
  caption?: string;
  language?: string;
}> {
  const prompt = `You are an expert music producer. Analyze this song and provide high-level production notes.
Song description: "${songDescription}"
Lyrics: "${lyrics || 'none'}"
Style: "${style}"

Provide a JSON response with:
- cot: your chain-of-thought analysis for production (2-3 sentences)
- caption: a refined caption for the DiT model
- language: the vocal language code (e.g., "en", "zh", "ja")`;

  const result = await chatCompletion([
    { role: 'system', content: 'You are a music production expert.' },
    { role: 'user', content: prompt },
  ], { json: true, temperature: 0.5 });

  try {
    return JSON.parse(result);
  } catch {
    return { cot: '', caption: songDescription };
  }
}

export default { chatCompletion, formatMusicDescription, generateCoT };
