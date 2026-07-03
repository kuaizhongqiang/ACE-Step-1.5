// @acestep/engine — 轻量环境配置
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录 (包路径: packages/engine/src/config.ts → 上3层到项目根)
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

export const config = {
  // ACE-Step Gradio API
  acestep: {
    apiUrl: process.env.ACESTEP_API_URL || 'http://localhost:7860',
  },

  // DeepSeek API
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },

  // 路径
  paths: {
    projectRoot: PROJECT_ROOT,
    audioDir: process.env.AUDIO_DIR || path.join(PROJECT_ROOT, 'public', 'audio'),
    scriptsDir: path.join(PROJECT_ROOT, 'scripts'),
    dataDir: path.join(PROJECT_ROOT, 'data'),
  },
};
