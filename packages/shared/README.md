# @acestep/shared

> ACE-Step 共享类型定义包 — 零依赖，纯 TypeScript 类型

## 职责

`@acestep/shared` 是所有 Node.js 包的类型权威来源。定义跨包共享的接口、枚举、类型别名。

**关键约束**：此包零运行时依赖，只导出类型。

## 结构

```
src/
├── index.ts        # 统一导出入口
├── types.ts        # 核心类型定义（Song, Playlist, GenerationParams 等）
└── ...
```

## 使用

```typescript
// 在 @acestep/server、@acestep/front 中引用
import type { Song, Playlist, GenerationParams } from '@acestep/shared';
```

## 开发

```bash
# 类型检查
npm run typecheck -w packages/shared
```
