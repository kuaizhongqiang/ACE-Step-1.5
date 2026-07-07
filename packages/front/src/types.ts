/**
 * 前端类型定义
 * 通用类型从 @acestep/shared 导入，前端专用扩展在此添加
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
  UserProfile,
} from '@acestep/shared';

import type {
  Song as SharedSong,
  Playlist as SharedPlaylist,
  User as SharedUser,
} from '@acestep/shared';

// ── 前端 Song 类型 — 扩展 shared 以适应前端渲染需求 ─────────────────────────
// shared 的 Song 使用 camelCase + number/string 类型。
// 前端需要 Date 对象、格式化字符串等，因此做 Omit 后重新声明冲突字段。
export interface Song extends Omit<SharedSong, 'coverUrl' | 'duration' | 'createdAt'> {
  coverUrl: string;          // required（shared 为 optional）
  duration: string;          // 格式化 "2:30"（shared 为 number?）
  createdAt: Date;           // Date 对象（shared 为 string）
  creator_avatar?: string;   // snake_case 别名（兼容旧代码）
}

// ── 前端 Playlist 类型 ──────────────────────────────────────────────────────
export interface Playlist extends Omit<SharedPlaylist, 'coverUrl' | 'createdAt' | 'songCount'> {
  coverUrl?: string;
  cover_url?: string;
  is_public?: boolean;
  user_id?: string;
  creator?: string;
  creator_avatar?: string;
  created_at?: string;
  song_count?: number;
  songs?: any[];
  songIds?: string[];
}

// ── 前端 User 类型 ──────────────────────────────────────────────────────────
export interface User extends Omit<SharedUser, 'createdAt' | 'avatarUrl' | 'bannerUrl'> {
  createdAt: Date;
  avatar_url?: string;
  banner_url?: string;
}
