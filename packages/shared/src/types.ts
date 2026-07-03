// =============================================================================
// @acestep/shared — 统一类型定义
// 所有属性使用 camelCase，API 响应层做 snake_case → camelCase 转换
// =============================================================================

// ── 歌曲 ──────────────────────────────────────────────────────────────────────

export interface Song {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  caption?: string;
  coverUrl?: string;
  audioUrl?: string;
  duration?: number;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  tags: string[];
  isPublic: boolean;
  likeCount: number;
  viewCount: number;
  userId?: string;
  createdAt: string;
  creator?: string;
  creatorAvatar?: string;
  ditModel?: string;
  generationParams?: unknown;

  // Generation state
  isGenerating?: boolean;
  queuePosition?: number;
  progress?: number;
  stage?: string;
}

// ── 播放列表 ──────────────────────────────────────────────────────────────────

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
  userId?: string;
  createdAt?: string;
  songCount?: number;
  songs?: Song[];
  creator?: string;
  creatorAvatar?: string;
}

// ── 评论 ──────────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  songId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

// ── 用户 ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  createdAt?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isAdmin?: boolean;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
}

export interface UserProfile extends User {
  publicSongs?: Song[];
  publicPlaylists?: Playlist[];
  stats?: {
    totalSongs: number;
    totalLikes: number;
  };
}

// ── 音乐生成参数 ──────────────────────────────────────────────────────────────

export interface GenerationParams {
  // Mode
  customMode: boolean;
  songDescription?: string;

  // Custom Mode
  prompt?: string;
  lyrics: string;
  style: string;
  title: string;
  ditModel?: string;

  // Common
  instrumental: boolean;
  vocalLanguage?: string;

  // Music Parameters
  duration?: number;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;

  // Generation Settings
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

  // LM Parameters
  lmTemperature?: number;
  lmCfgScale?: number;
  lmTopK?: number;
  lmTopP?: number;
  lmNegativePrompt?: string;
  lmBackend?: 'pt' | 'vllm';
  lmModel?: string;

  // Expert Parameters
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
}

// ── 生成任务 ──────────────────────────────────────────────────────────────────

export interface GenerationJob {
  jobId: string;
  id?: string;
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed';
  queuePosition?: number;
  etaSeconds?: number;
  progress?: number;
  stage?: string;
  params?: unknown;
  createdAt?: string;
  result?: {
    audioUrls: string[];
    bpm?: number;
    duration?: number;
    keyScale?: string;
    timeSignature?: string;
  };
  error?: string;
}

// ── 前端视图 ──────────────────────────────────────────────────────────────────

export type View = 'create' | 'library' | 'profile' | 'song' | 'playlist' | 'search' | 'news';

// ── 播放器 ────────────────────────────────────────────────────────────────────

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
}

// ── 搜索 ──────────────────────────────────────────────────────────────────────

export interface SearchResult {
  songs: Song[];
  creators: UserProfile[];
  playlists: Playlist[];
}

// ── 联系表单 ──────────────────────────────────────────────────────────────────

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  category: 'general' | 'support' | 'business' | 'press' | 'legal';
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: User;
  token: string;
}

// ── API 响应转换工具 ──────────────────────────────────────────────────────────

/**
 * 将 API 返回的 snake_case Song 转换为 camelCase
 */
export function transformSong(raw: Record<string, unknown>): Song {
  return {
    id: raw.id as string,
    title: raw.title as string,
    lyrics: (raw.lyrics as string) || '',
    style: (raw.style as string) || '',
    caption: raw.caption as string | undefined,
    coverUrl: (raw.cover_url || raw.coverUrl) as string | undefined,
    audioUrl: (raw.audio_url || raw.audioUrl) as string | undefined,
    duration: (raw.duration as number) || undefined,
    bpm: raw.bpm as number | undefined,
    keyScale: (raw.key_scale || raw.keyScale) as string | undefined,
    timeSignature: (raw.time_signature || raw.timeSignature) as string | undefined,
    tags: (raw.tags as string[]) || [],
    isPublic: (raw.is_public ?? raw.isPublic ?? true) as boolean,
    likeCount: (raw.like_count ?? raw.likeCount ?? 0) as number,
    viewCount: (raw.view_count ?? raw.viewCount ?? 0) as number,
    userId: (raw.user_id || raw.userId) as string | undefined,
    createdAt: (raw.created_at || raw.createdAt || new Date().toISOString()) as string,
    creator: raw.creator as string | undefined,
    creatorAvatar: (raw.creator_avatar || raw.creatorAvatar) as string | undefined,
    ditModel: (raw.dit_model || raw.ditModel) as string | undefined,
    generationParams: raw.generation_params || raw.generationParams,
    isGenerating: raw.isGenerating as boolean | undefined,
    queuePosition: raw.queuePosition as number | undefined,
    progress: raw.progress as number | undefined,
    stage: raw.stage as string | undefined,
  };
}

/**
 * 将 API 返回的 snake_case Playlist 转换为 camelCase
 */
export function transformPlaylist(raw: Record<string, unknown>): Playlist {
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: raw.description as string | undefined,
    coverUrl: (raw.cover_url || raw.coverUrl) as string | undefined,
    isPublic: (raw.is_public ?? raw.isPublic) as boolean | undefined,
    userId: (raw.user_id || raw.userId) as string | undefined,
    createdAt: (raw.created_at || raw.createdAt) as string | undefined,
    songCount: (raw.song_count ?? raw.songCount) as number | undefined,
    songs: raw.songs ? (raw.songs as any[]).map(s => transformSong(s)) : undefined,
    creator: raw.creator as string | undefined,
    creatorAvatar: (raw.creator_avatar || raw.creatorAvatar) as string | undefined,
  };
}
