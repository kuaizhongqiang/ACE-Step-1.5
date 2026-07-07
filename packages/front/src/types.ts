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
export interface Song extends Omit<SharedSong, 'coverUrl' | 'duration' | 'createdAt'> {
  coverUrl: string;          // required（shared 为 optional）
  duration: string;          // 格式化 "2:30"（shared 为 number?）
  createdAt: Date;           // Date 对象（shared 为 string）
  creator_avatar?: string;   // snake_case 别名（API 响应层暂未统一）
}

// ── 前端 Playlist 类型 ──────────────────────────────────────────────────────
export interface Playlist extends Omit<SharedPlaylist, 'coverUrl' | 'createdAt' | 'songCount' | 'songs'> {
  coverUrl?: string;
  creator?: string;
  creator_avatar?: string;
  songCount?: number;
  songIds?: string[];
  songs?: Song[];
}

// ── 前端 User 类型 ──────────────────────────────────────────────────────────
export interface User extends Omit<SharedUser, 'createdAt' | 'avatarUrl' | 'bannerUrl'> {
  createdAt: Date;
  avatarUrl?: string;
  bannerUrl?: string;
}

// ── 引用曲目类型 ────────────────────────────────────────────────────────────
export interface ReferenceTrack {
  id: string;
  filename: string;
  storageKey: string;
  duration: number | null;
  fileSizeBytes: number | null;
  tags: string[] | null;
  createdAt: string;
  audioUrl: string;
}
