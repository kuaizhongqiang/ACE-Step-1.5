/**
 * 前端类型定义
 * 通用类型从 @acestep/shared 导入并重新导出
 * 仅保留前端特有的类型扩展
 */

// ── 从 shared 导入并重新导出 ─────────────────────────────────────────────────
export type {
  Comment,
  GenerationJob,
  GenerationParams,
  PlayerState,
  View,
  AuthResponse,
  SearchResult,
  ContactFormData,
} from '@acestep/shared';

// ── 前端特有 Song 类型（扩展 shared × 前端渲染字段）─────────────────────────
// TODO(M2): 类型归一化 — 统一为 @acestep/shared 后移除本地定义
export interface Song {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  coverUrl: string;
  duration: string;        // 前端格式 "2:30"，不同于 shared 的 duration?: number
  createdAt: Date;          // Date 对象，不同于 shared 的 string
  isGenerating?: boolean;
  queuePosition?: number;
  progress?: number;
  stage?: string;
  generationParams?: any;
  tags: string[];
  audioUrl?: string;
  isPublic?: boolean;
  likeCount?: number;
  viewCount?: number;
  userId?: string;
  creator?: string;
  creator_avatar?: string;
  ditModel?: string;
}

// ── 前端特有 Playlist 类型 ────────────────────────────────────────────────────
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  cover_url?: string;
  songIds?: string[];
  isPublic?: boolean;
  is_public?: boolean;
  user_id?: string;
  creator?: string;
  created_at?: string;
  song_count?: number;
  songs?: any[];
}

// ── 前端特有 User/UserProfile（字段形状与 shared 不同）────────────────────────
export interface User {
  id: string;
  username: string;
  createdAt: Date;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  isAdmin?: boolean;
  avatar_url?: string;
  banner_url?: string;
}

export interface UserProfile {
  user: User;
  publicSongs: Song[];
  publicPlaylists: Playlist[];
  stats: {
    totalSongs: number;
    totalLikes: number;
  };
}
