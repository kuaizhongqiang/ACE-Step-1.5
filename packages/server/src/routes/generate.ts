import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';
import { generateUUID } from '../db/sqlite.js';
import { config } from '../config/index.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import type { GenerationParams } from '@acestep/shared';
import { getGradioClient } from '@acestep/engine';
import {
  generateMusicViaAPI,
  getJobStatus,
  getAudioStream,
  discoverEndpoints,
  checkSpaceHealth,
  cleanupJob,
  getJobRawResponse,
  downloadAudioToBuffer,
  resolvePythonPath,
} from '@acestep/engine';
import { getStorageProvider } from '../services/storage/factory.js';

const router = Router();

function autoTitle(params: { title?: string; lyrics?: string; instrumental?: boolean; style?: string; songDescription?: string }): string {
  if (params.title?.trim()) return params.title.trim();
  if (!params.instrumental && params.lyrics) {
    for (const line of params.lyrics.split('\n')) {
      const t = line.trim();
      if (t && !/^\[.*\]$/.test(t)) return t.length > 40 ? t.slice(0, 40).trimEnd() + '…' : t;
    }
  }
  const source = params.style || params.songDescription || '';
  if (source) {
    const words = source.trim().split(/\s+/).slice(0, 4).join(' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return 'Untitled';
}

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3',
      'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/x-flac',
      'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm', 'video/mp4',
    ];
    const allowedExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.mp4', '.aac', '.ogg', '.webm', '.opus'];
    const fileExt = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (allowedTypes.includes(file.mimetype) || (fileExt && allowedExtensions.includes(fileExt))) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only common audio formats are allowed. Received: ${file.mimetype} (${file.originalname})`));
    }
  },
});

router.post('/upload-audio', authMiddleware, (req: AuthenticatedRequest, res: Response, next: Function) => {
  audioUpload.single('audio')(req, res, (err: any) => {
    if (err) { res.status(400).json({ error: err.message || 'Invalid file upload' }); return; }
    next();
  });
}, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Audio file is required' }); return; }
    const storage = getStorageProvider();
    const extFromName = path.extname(req.file.originalname || '').toLowerCase();
    const extFromType = (() => {
      switch (req.file.mimetype) {
        case 'audio/mpeg': case 'audio/mp3': case 'audio/mpeg3': case 'audio/x-mpeg-3': return '.mp3';
        case 'audio/wav': case 'audio/x-wav': return '.wav';
        case 'audio/flac': case 'audio/x-flac': return '.flac';
        case 'audio/ogg': return '.ogg';
        case 'audio/mp4': case 'audio/x-m4a': case 'audio/aac': return '.m4a';
        case 'audio/webm': return '.webm';
        case 'video/mp4': return '.mp4';
        default: return '';
      }
    })();
    const ext = extFromName || extFromType || '.audio';
    const key = `references/${req.user!.id}/${Date.now()}-${generateUUID()}${ext}`;
    const storedKey = await storage.upload(key, req.file.buffer, req.file.mimetype);
    res.json({ url: storage.getPublicUrl(storedKey), key: storedKey });
  } catch (error) {
    console.error('Upload reference audio error:', error);
    res.status(500).json({ error: 'Failed to upload audio' });
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body as GenerationParams;
    if (!body.customMode && !body.songDescription) { res.status(400).json({ error: 'Song description required for simple mode' }); return; }
    if (body.customMode && !body.style && !body.lyrics && !body.referenceAudioUrl) { res.status(400).json({ error: 'Style, lyrics, or reference audio required for custom mode' }); return; }

    const params = { ...body };
    const localJobId = generateUUID();
    await pool.query(
      `INSERT INTO generation_jobs (id, user_id, status, params, created_at, updated_at)
       VALUES (?, ?, 'queued', ?, datetime('now'), datetime('now'))`,
      [localJobId, req.user!.id, JSON.stringify(params)],
    );

    const { jobId: hfJobId } = await generateMusicViaAPI(params);
    await pool.query(
      `UPDATE generation_jobs SET acestep_task_id = ?, status = 'running', updated_at = datetime('now') WHERE id = ?`,
      [hfJobId, localJobId],
    );

    res.json({ jobId: localJobId, status: 'queued', queuePosition: 1 });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: (error as Error).message || 'Generation failed' });
  }
});

router.get('/status/:jobId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobResult = await pool.query(
      `SELECT id, user_id, acestep_task_id, status, params, result, error, created_at
       FROM generation_jobs WHERE id = ?`,
      [req.params.jobId],
    );
    if (jobResult.rows.length === 0) { res.status(404).json({ error: 'Job not found' }); return; }
    const job = jobResult.rows[0];
    if (job.user_id !== req.user!.id) { res.status(403).json({ error: 'Access denied' }); return; }

    if (['pending', 'queued', 'running'].includes(job.status) && job.acestep_task_id) {
      try {
        const aceStatus = await getJobStatus(job.acestep_task_id);
        if (aceStatus.status !== job.status) {
          let updateQuery = 'UPDATE generation_jobs SET status = ?, updated_at = datetime(\'now\')';
          const updateParams: unknown[] = [aceStatus.status];
          if (aceStatus.status === 'succeeded' && aceStatus.result) {
            updateQuery += ', result = ?';
            updateParams.push(JSON.stringify(aceStatus.result));
          } else if (aceStatus.status === 'failed' && aceStatus.error) {
            updateQuery += ', error = ?';
            updateParams.push(aceStatus.error);
          }
          updateQuery += ' WHERE id = ? AND status = ?';
          updateParams.push(req.params.jobId, job.status);
          const updateResult = await pool.query(updateQuery, updateParams);
          const wasUpdated = updateResult.rowCount > 0;

          if (aceStatus.status === 'succeeded' && aceStatus.result && wasUpdated) {
            const params = typeof job.params === 'string' ? JSON.parse(job.params) : job.params;
            const audioUrls = aceStatus.result.audioUrls.filter((url: string) => {
              const lower = url.toLowerCase();
              return lower.endsWith('.mp3') || lower.endsWith('.flac') || lower.endsWith('.wav');
            });
            const localPaths: string[] = [];
            const storage = getStorageProvider();

            for (let i = 0; i < audioUrls.length; i++) {
              const audioUrl = audioUrls[i];
              const variationSuffix = audioUrls.length > 1 ? ` (v${i + 1})` : '';
              const songTitle = autoTitle(params) + variationSuffix;
              const songId = generateUUID();

              try {
                const { buffer } = await downloadAudioToBuffer(audioUrl);
                const ext = audioUrl.includes('.flac') ? '.flac' : '.mp3';
                const storageKey = `${req.user!.id}/${songId}${ext}`;
                await storage.upload(storageKey, buffer, `audio/${ext.slice(1)}`);
                const storedPath = storage.getPublicUrl(storageKey);
                await pool.query(
                  `INSERT INTO songs (id, user_id, title, lyrics, style, caption, audio_url,
                                      duration, bpm, key_scale, time_signature, tags, is_public, generation_params,
                                      created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
                  [
                    songId, req.user!.id, songTitle,
                    params.instrumental ? '[Instrumental]' : params.lyrics,
                    params.style, params.style, storedPath,
                    aceStatus.result.duration && aceStatus.result.duration > 0 ? aceStatus.result.duration : (params.duration || 0),
                    aceStatus.result.bpm || params.bpm, aceStatus.result.keyScale || params.keyScale,
                    aceStatus.result.timeSignature || params.timeSignature, JSON.stringify([]),
                    JSON.stringify(params),
                  ],
                );
                localPaths.push(storedPath);
              } catch (downloadError) {
                console.error(`Failed to download audio ${i + 1}:`, downloadError);
                await pool.query(
                  `INSERT INTO songs (id, user_id, title, lyrics, style, caption, audio_url,
                                      duration, bpm, key_scale, time_signature, tags, is_public, generation_params,
                                      created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
                  [
                    songId, req.user!.id, songTitle,
                    params.instrumental ? '[Instrumental]' : params.lyrics,
                    params.style, params.style, audioUrl,
                    aceStatus.result.duration && aceStatus.result.duration > 0 ? aceStatus.result.duration : (params.duration || 0),
                    aceStatus.result.bpm || params.bpm, aceStatus.result.keyScale || params.keyScale,
                    aceStatus.result.timeSignature || params.timeSignature, JSON.stringify([]),
                    JSON.stringify(params),
                  ],
                );
                localPaths.push(audioUrl);
              }
            }
            aceStatus.result.audioUrls = localPaths;
            cleanupJob(job.acestep_task_id);
          }
        }
        res.json({
          jobId: req.params.jobId, status: aceStatus.status,
          queuePosition: aceStatus.queuePosition, etaSeconds: aceStatus.etaSeconds,
          progress: aceStatus.progress, stage: aceStatus.stage,
          result: aceStatus.result, error: aceStatus.error,
        });
        return;
      } catch (aceError) {
        console.error('ACE-Step status check error:', aceError);
      }
    }

    res.json({
      jobId: req.params.jobId, status: job.status,
      result: job.result && typeof job.result === 'string' ? JSON.parse(job.result) : job.result,
      error: job.error,
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/audio', async (req, res: Response) => {
  try {
    const audioPath = req.query.path as string;
    if (!audioPath) { res.status(400).json({ error: 'Path required' }); return; }
    const audioResponse = await getAudioStream(audioPath);
    if (!audioResponse.ok) { res.status(audioResponse.status).json({ error: 'Failed to fetch audio' }); return; }
    const contentType = audioResponse.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const contentLength = audioResponse.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const reader = audioResponse.body?.getReader();
    if (!reader) { res.status(500).json({ error: 'Failed to read audio stream' }); return; }
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(value);
      return pump();
    };
    await pump();
  } catch (error) {
    console.error('Audio proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, acestep_task_id, status, params, result, error, created_at
       FROM generation_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id],
    );
    res.json({ jobs: result.rows });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/endpoints', authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const endpoints = await discoverEndpoints();
    res.json({ endpoints });
  } catch (error) {
    console.error('Discover endpoints error:', error);
    res.status(500).json({ error: 'Failed to discover endpoints' });
  }
});

router.get('/models', async (_req, res: Response) => {
  try {
    const ACESTEP_DIR = process.env.ACESTEP_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
    const checkpointsDir = path.join(ACESTEP_DIR, 'checkpoints');
    const ALL_DIT_MODELS = [
      'acestep-v15-turbo', 'acestep-v15-base', 'acestep-v15-sft',
      'acestep-v15-turbo-shift1', 'acestep-v15-turbo-shift3', 'acestep-v15-turbo-continuous',
    ];
    let activeModel: string | null = null;
    try {
      const apiRes = await fetch(`${config.acestep.apiUrl}/v1/models`);
      if (apiRes.ok) {
        const data = await apiRes.json() as any;
        const gradioModels = data?.data?.models || data?.models || [];
        if (gradioModels.length > 0) activeModel = gradioModels[0]?.name || null;
      }
    } catch { /* ignore */ }

    const { existsSync, statSync, readdirSync } = await import('fs');
    const downloaded = new Set<string>();
    for (const model of ALL_DIT_MODELS) {
      const modelPath = path.join(checkpointsDir, model);
      try { if (existsSync(modelPath) && statSync(modelPath).isDirectory()) downloaded.add(model); } catch { /* skip */ }
    }
    try {
      for (const entry of readdirSync(checkpointsDir)) {
        if (entry.startsWith('acestep-v15-') && statSync(path.join(checkpointsDir, entry)).isDirectory()) {
          downloaded.add(entry);
          if (!ALL_DIT_MODELS.includes(entry)) ALL_DIT_MODELS.push(entry);
        }
      }
    } catch { /* checkpoints dir may not exist */ }

    const models = ALL_DIT_MODELS.map(name => ({ name, is_active: name === activeModel, is_preloaded: downloaded.has(name) }));
    models.sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      if (a.is_preloaded !== b.is_preloaded) return a.is_preloaded ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/random-description', authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const client = await getGradioClient();
    const result = await client.predict('/load_random_simple_description', []);
    const data = result.data as unknown[];
    res.json({ description: data[0] || '', instrumental: data[1] || false, vocalLanguage: data[2] || 'unknown' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/health', async (_req, res: Response) => {
  try {
    const healthy = await checkSpaceHealth();
    res.json({ healthy, aceStepUrl: config.acestep.apiUrl });
  } catch (error) {
    res.json({ healthy: false, aceStepUrl: config.acestep.apiUrl, error: (error as Error).message });
  }
});

router.get('/limits', async (_req, res: Response) => {
  try {
    const { spawn } = await import('child_process');
    const ACESTEP_DIR = process.env.ACESTEP_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
    const SCRIPTS_DIR = path.join(ACESTEP_DIR, 'scripts');
    const LIMITS_SCRIPT = path.join(SCRIPTS_DIR, 'get_limits.py');
    const pythonPath = resolvePythonPath(ACESTEP_DIR);

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      const proc = spawn(pythonPath, [LIMITS_SCRIPT], { cwd: ACESTEP_DIR, env: { ...process.env, ACESTEP_PATH: ACESTEP_DIR } });
      let stdout = ''; let stderr = '';
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0 && stdout) {
          try { resolve({ success: true, data: JSON.parse(stdout) }); } catch { resolve({ success: false, error: 'Failed to parse limits result' }); }
        } else { resolve({ success: false, error: stderr || 'Failed to read limits' }); }
      });
      proc.on('error', (err) => resolve({ success: false, error: err.message }));
    });
    if (result.success && result.data) res.json(result.data);
    else res.status(500).json({ error: result.error || 'Failed to load limits' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/debug/:taskId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawResponse = getJobRawResponse(req.params.taskId);
    if (!rawResponse) { res.status(404).json({ error: 'Job not found or no raw response available' }); return; }
    res.json({ rawResponse });
  } catch (error) { res.status(500).json({ error: (error as Error).message }); }
});

router.post('/format', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caption, lyrics, bpm, duration, keyScale, timeSignature, temperature, topK, topP, lmModel, lmBackend } = req.body;
    if (!caption) { res.status(400).json({ error: 'Caption/style is required' }); return; }

    const ACESTEP_API_URL = config.acestep.apiUrl;
    const paramObj: Record<string, unknown> = {};
    if (bpm && bpm > 0) paramObj.bpm = bpm;
    if (duration && duration > 0) paramObj.duration = duration;
    if (keyScale) paramObj.key = keyScale;
    if (timeSignature) paramObj.time_signature = timeSignature;

    try {
      const apiRes = await fetch(`${ACESTEP_API_URL}/format_input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: caption, lyrics: lyrics || '',
          temperature: temperature ?? 0.85, param_obj: paramObj,
        }),
        signal: AbortSignal.timeout(300_000),
      });
      const apiData = await apiRes.json() as any;
      if (!apiRes.ok || apiData.code !== 200) {
        res.status(500).json({ success: false, error: apiData.error || apiData.detail || `Format API returned ${apiRes.status}` });
        return;
      }
      const d = apiData.data;
      res.json({ caption: d.caption, lyrics: d.lyrics, bpm: d.bpm, duration: d.duration, key_scale: d.key_scale, time_signature: d.time_signature, vocal_language: d.vocal_language });
      return;
    } catch (fetchErr: any) {
      if (fetchErr?.name !== 'AbortError' && (fetchErr?.code === 'ECONNREFUSED' || fetchErr?.cause?.code === 'ECONNREFUSED')) {
        console.warn('[Format] REST API unreachable, falling back to Python spawn');
      } else {
        res.status(500).json({ success: false, error: fetchErr?.message || 'Format request failed' });
        return;
      }
    }

    const { spawn } = await import('child_process');
    const ACESTEP_DIR = process.env.ACESTEP_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
    const SCRIPTS_DIR = path.join(ACESTEP_DIR, 'scripts');
    const FORMAT_SCRIPT = path.join(SCRIPTS_DIR, 'format_sample.py');
    const pythonPath = resolvePythonPath(ACESTEP_DIR);
    const args = [FORMAT_SCRIPT, '--caption', caption, '--json'];
    if (lyrics) args.push('--lyrics', lyrics);
    if (bpm && bpm > 0) args.push('--bpm', String(bpm));
    if (duration && duration > 0) args.push('--duration', String(duration));
    if (keyScale) args.push('--key-scale', keyScale);
    if (timeSignature) args.push('--time-signature', timeSignature);
    if (temperature !== undefined) args.push('--temperature', String(temperature));
    if (topK && topK > 0) args.push('--top-k', String(topK));
    if (topP !== undefined) args.push('--top-p', String(topP));
    if (lmModel) args.push('--lm-model', lmModel);
    if (lmBackend) args.push('--lm-backend', lmBackend);

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
      const proc = spawn(pythonPath, args, { cwd: ACESTEP_DIR, env: { ...process.env, ACESTEP_PATH: ACESTEP_DIR } });
      let stdout = ''; let stderr = '';
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0 && stdout) {
          const lines = stdout.trim().split('\n');
          let jsonStr = '';
          for (let i = lines.length - 1; i >= 0; i--) { if (lines[i].startsWith('{')) { jsonStr = lines[i]; break; } }
          try { resolve({ success: true, data: JSON.parse(jsonStr || stdout) }); } catch { resolve({ success: false, error: 'Failed to parse format result' }); }
        } else { resolve({ success: false, error: stderr || stdout || `Format process exited with code ${code}` }); }
      });
      proc.on('error', (err) => resolve({ success: false, error: err.message }));
    });
    if (result.success && result.data) res.json(result.data);
    else res.status(500).json({ success: false, error: result.error });
  } catch (error) {
    console.error('[Format] Route error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
