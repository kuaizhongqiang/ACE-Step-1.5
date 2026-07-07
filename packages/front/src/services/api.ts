/**
 * ACE-Step API 服务层
 *
 * 职责：
 * 1. 封装所有 HTTP 请求（Express API）
 * 2. 将 snake_case 响应转换为 camelCase（使用 @acestep/shared 的工具函数）
 * 3. 暴露 camelCase 类型供组件使用
 *
 * 外部组件应只使用本模块导出的类型，不应直接依赖内部 Raw 类型。
 */

import type {
  Song,
  Playlist,
  User,
  GenerationParams,
  GenerationJob,
  SearchResult,
  ContactFormData,
  AuthResponse,
  Comment,
  UserProfile,
} from '@acestep/shared';
import { transformSong, transformPlaylist } from '@acestep/shared';

// Use relative URLs so Vite proxy handles them (enables LAN access)
const API_BASE = '';

// ── 内部 Raw 类型（snake_case，匹配 API 响应格式）─────────────────────────────

interface RawUser {
  id: string;
  username: string;
  isAdmin?: boolean;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  createdAt?: string;
}

interface RawSong {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  caption?: string;
  cover_url?: string;
  audio_url?: string;
  duration?: number;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  tags: string[];
  is_public: boolean;
  like_count?: number;
  view_count?: number;
  user_id?: string;
  created_at: string;
  creator?: string;
  creator_avatar?: string;
  dit_model?: string;
  generation_params?: any;
  isGenerating?: boolean;
  queuePosition?: number;
  progress?: number;
  stage?: string;
  added_at?: string;
}

interface RawPlaylist {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  is_public?: boolean;
  user_id?: string;
  creator?: string;
  creator_avatar?: string;
  created_at?: string;
  song_count?: number;
}

// Resolve audio URL based on storage type
export function getAudioUrl(audioUrl: string | undefined | null, songId?: string): string | undefined {
  if (!audioUrl) return undefined;
  if (audioUrl.startsWith('/audio/')) return audioUrl;
  return audioUrl;
}

// ── HTTP 客户端 ──────────────────────────────────────────────────────────────

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(`${response.status}: ${error.error || error.message || 'Request failed'}`);
  }

  return response.json();
}

// ── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  auto: (): Promise<AuthResponse> => api('/api/auth/auto'),
  setup: (username: string): Promise<AuthResponse> =>
    api('/api/auth/setup', { method: 'POST', body: { username } }),
  me: (token: string): Promise<{ user: User }> =>
    api('/api/auth/me', { token }),
  logout: (): Promise<{ success: boolean }> =>
    api('/api/auth/logout', { method: 'POST' }),
  refresh: (token: string): Promise<AuthResponse> =>
    api('/api/auth/refresh', { method: 'POST', token }),
  updateUsername: (username: string, token: string): Promise<AuthResponse> =>
    api('/api/auth/username', { method: 'PATCH', body: { username }, token }),
};

// ── Songs API ────────────────────────────────────────────────────────────────

function rawSongToSong(raw: RawSong): Song {
  return transformSong(raw as unknown as Record<string, unknown>);
}

export const songsApi = {
  getMySongs: async (token: string): Promise<{ songs: Song[] }> => {
    const result = await api<{ songs: RawSong[] }>('/api/songs', { token });
    return { songs: result.songs.map(rawSongToSong) };
  },

  getPublicSongs: async (limit = 20, offset = 0): Promise<{ songs: Song[] }> => {
    const result = await api<{ songs: RawSong[] }>(`/api/songs/public?limit=${limit}&offset=${offset}`);
    return { songs: result.songs.map(rawSongToSong) };
  },

  getFeaturedSongs: async (): Promise<{ songs: Song[] }> => {
    const result = await api<{ songs: RawSong[] }>('/api/songs/public/featured');
    return { songs: result.songs.map(rawSongToSong) };
  },

  getSong: async (id: string, token?: string | null): Promise<{ song: Song }> => {
    const result = await api<{ song: RawSong }>(`/api/songs/${id}`, { token: token || undefined });
    return { song: rawSongToSong(result.song) };
  },

  getFullSong: async (id: string, token?: string | null): Promise<{ song: Song; comments: Comment[] }> => {
    const result = await api<{ song: RawSong; comments: any[] }>(`/api/songs/${id}/full`, { token: token || undefined });
    return { song: rawSongToSong(result.song), comments: result.comments };
  },

  createSong: (song: Partial<Song>, token: string): Promise<{ song: Song }> =>
    api('/api/songs', { method: 'POST', body: song, token }),

  updateSong: async (id: string, updates: Partial<Song>, token: string): Promise<{ song: Song }> => {
    const result = await api<{ song: RawSong }>(`/api/songs/${id}`, { method: 'PATCH', body: updates, token });
    return { song: rawSongToSong(result.song) };
  },

  deleteSong: (id: string, token: string): Promise<{ success: boolean }> =>
    api(`/api/songs/${id}`, { method: 'DELETE', token }),

  toggleLike: (id: string, token: string): Promise<{ liked: boolean }> =>
    api(`/api/songs/${id}/like`, { method: 'POST', token }),

  getLikedSongs: async (token: string): Promise<{ songs: Song[] }> => {
    const result = await api<{ songs: RawSong[] }>('/api/songs/liked/list', { token });
    return { songs: result.songs.map(rawSongToSong) };
  },

  togglePrivacy: (id: string, token: string): Promise<{ isPublic: boolean }> =>
    api(`/api/songs/${id}/privacy`, { method: 'PATCH', token }),

  trackPlay: (id: string, token?: string | null): Promise<{ viewCount: number }> =>
    api(`/api/songs/${id}/play`, { method: 'POST', token: token || undefined }),

  getComments: (id: string, token?: string | null): Promise<{ comments: Comment[] }> =>
    api(`/api/songs/${id}/comments`, { token: token || undefined }),

  addComment: (id: string, content: string, token: string): Promise<{ comment: Comment }> =>
    api(`/api/songs/${id}/comments`, { method: 'POST', body: { content }, token }),

  deleteComment: (commentId: string, token: string): Promise<{ success: boolean }> =>
    api(`/api/songs/comments/${commentId}`, { method: 'DELETE', token }),
};

// ── Generation API ──────────────────────────────────────────────────────────

export const generateApi = {
  startGeneration: (params: GenerationParams, token: string): Promise<GenerationJob> =>
    api('/api/generate', { method: 'POST', body: params, token }),

  getStatus: (jobId: string, token: string): Promise<GenerationJob> =>
    api(`/api/generate/status/${jobId}`, { token }),

  getHistory: (token: string): Promise<{ jobs: GenerationJob[] }> =>
    api('/api/generate/history', { token }),

  uploadAudio: async (file: File, token: string): Promise<{ url: string; key: string }> => {
    const formData = new FormData();
    formData.append('audio', file);
    const response = await fetch(`${API_BASE}/api/generate/upload-audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.details || error.error || 'Upload failed');
    }
    return response.json();
  },

  formatInput: (params: Record<string, unknown>, token: string): Promise<Record<string, unknown>> =>
    api('/api/generate/format', { method: 'POST', body: params, token }),

  getRandomDescription: (token: string): Promise<{
    description: string;
    instrumental: boolean;
    vocalLanguage: string;
  }> => api('/api/generate/random-description', { token }),
};

// ── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  getProfile: (username: string, token?: string | null): Promise<{ user: User }> =>
    api(`/api/users/${username}`, { token: token || undefined }),

  getPublicSongs: async (username: string): Promise<{ songs: Song[] }> => {
    const result = await api<{ songs: RawSong[] }>(`/api/users/${username}/songs`);
    return { songs: result.songs.map(rawSongToSong) };
  },

  getPublicPlaylists: async (username: string): Promise<{ playlists: Playlist[] }> => {
    const result = await api<{ playlists: RawPlaylist[] }>(`/api/users/${username}/playlists`);
    return { playlists: result.playlists.map(p => transformPlaylist(p as unknown as Record<string, unknown>)) };
  },

  getFeaturedCreators: (): Promise<{ creators: Array<User & { follower_count?: number }> }> =>
    api('/api/users/public/featured'),

  updateProfile: (updates: Partial<User>, token: string): Promise<{ user: User }> =>
    api('/api/users/me', { method: 'PATCH', body: updates, token }),

  uploadAvatar: async (file: File, token: string): Promise<{ user: User; url: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await fetch(`${API_BASE}/api/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.details || error.error || 'Upload failed');
    }
    return response.json();
  },

  uploadBanner: async (file: File, token: string): Promise<{ user: User; url: string }> => {
    const formData = new FormData();
    formData.append('banner', file);
    const response = await fetch(`${API_BASE}/api/users/me/banner`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }
    return response.json();
  },

  toggleFollow: (username: string, token: string): Promise<{ following: boolean; followerCount: number }> =>
    api(`/api/users/${username}/follow`, { method: 'POST', token }),

  getFollowers: (username: string): Promise<{ followers: User[] }> =>
    api(`/api/users/${username}/followers`),

  getFollowing: (username: string): Promise<{ following: User[] }> =>
    api(`/api/users/${username}/following`),

  getStats: (username: string, token?: string | null): Promise<{
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
  }> => api(`/api/users/${username}/stats`, { token: token || undefined }),
};

// ── Playlists API ────────────────────────────────────────────────────────────

export const playlistsApi = {
  create: (name: string, description: string, isPublic: boolean, token: string): Promise<{ playlist: Playlist }> =>
    api('/api/playlists', { method: 'POST', body: { name, description, isPublic }, token }),

  getMyPlaylists: async (token: string): Promise<{ playlists: Playlist[] }> => {
    const result = await api<{ playlists: RawPlaylist[] }>('/api/playlists', { token });
    return { playlists: result.playlists.map(p => transformPlaylist(p as unknown as Record<string, unknown>)) };
  },

  getPlaylist: async (id: string, token?: string | null): Promise<{ playlist: Playlist; songs: any[] }> => {
    const result = await api<{ playlist: RawPlaylist; songs: any[] }>(`/api/playlists/${id}`, { token: token || undefined });
    return {
      playlist: transformPlaylist(result.playlist as unknown as Record<string, unknown>),
      songs: result.songs,
    };
  },

  getFeaturedPlaylists: (): Promise<{ playlists: Playlist[] }> =>
    api('/api/playlists/public/featured'),

  addSong: (playlistId: string, songId: string, token: string): Promise<{ success: boolean }> =>
    api(`/api/playlists/${playlistId}/songs`, { method: 'POST', body: { songId }, token }),

  removeSong: (playlistId: string, songId: string, token: string): Promise<{ success: boolean }> =>
    api(`/api/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE', token }),

  update: (id: string, updates: Partial<Playlist>, token: string): Promise<{ playlist: Playlist }> =>
    api(`/api/playlists/${id}`, { method: 'PATCH', body: updates, token }),

  delete: (id: string, token: string): Promise<{ success: boolean }> =>
    api(`/api/playlists/${id}`, { method: 'DELETE', token }),
};

// ── Search API ───────────────────────────────────────────────────────────────

export const searchApi = {
  search: async (query: string, type?: 'songs' | 'creators' | 'playlists' | 'all'): Promise<SearchResult> => {
    const params = new URLSearchParams({ q: query });
    if (type && type !== 'all') params.append('type', type);
    const result = await api<SearchResult>(`/api/search?${params}`);
    return result;
  },
};

// ── Contact API ──────────────────────────────────────────────────────────────

export const contactApi = {
  submit: (data: ContactFormData): Promise<{ success: boolean; message: string; id: string }> =>
    api('/api/contact', { method: 'POST', body: data }),
};
