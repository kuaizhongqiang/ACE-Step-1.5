# ACE-Step 1.5 — 5 包重构设计与实施方案

> 将 `ace-step-ui`（Node.js 层）合并到 `ACE-Step-1.5`（Python 引擎），
> 重构为 5 包 npm workspace monorepo。
> **核心原则：功能只增不减、去容器化、CLI 主导、中文优先。**

---

## 目录

1. [现状分析](#1-现状分析)
2. [目标架构](#2-目标架构)
3. [5 包职责与边界](#3-5-包职责与边界)
4. [Milestone 1：结构跑通](#4-milestone-1结构跑通)
5. [Milestone 2：功能就绪](#5-milestone-2功能就绪)
6. [Milestone 3：CLI 强化 + 中文](#6-milestone-3cli-强化--中文)
7. [配置与合并策略](#7-配置与合并策略)
8. [CI/CD 更新](#8-cicd-更新)
9. [验证方案](#9-验证方案)

---

## 1. 现状分析

### 源项目：`ace-step-ui`（`F:\Project\ace-step-ui`）

完整功能的 Node.js 全栈应用，包含：

| 层 | 技术栈 | 规模 |
|---|--------|------|
| 后端 | Express 4 + TypeScript + SQLite | 20 个源文件，~5400 行 |
| CLI | Node.js ESM `.mjs` | 9 个命令模块，~600 行 |
| 前端 | React 19 + Vite 6 + Tailwind 3 | 19 个组件 + 3 context，~10600 行 |
| API 层 | 通用 fetch 封装 | 1 个文件，~530 行 |
| i18n | 4 语言平铺翻译 | ~2100 行 |
| CI/CD | GitHub Actions 发布 3 npm 包 | commitlint + tsc + build |

### 目标项目：`ACE-Step-1.5`（`f:\Project\ACE-Step-1.5`）

| 层 | 状态 | 规模 |
|---|------|------|
| Python 引擎 `acestep/` | **生产可用** | ~592 源文件，含完整 Gradio UI + FastAPI |
| `server/` | **空壳**（仅 package.json） | 7 个空目录，零 .ts 文件 |
| `ui/` | **空壳**（仅 package.json） | 零 .ts/.tsx 文件 |
| `data/` | **空**（仅 .gitkeep） | 无风格列表数据 |
| CI `ci.yml` | **超前引用** | 引用 `packages/*` 路径（尚未存在） |

### 关键差距

1. **代码零重叠**：`server/` 和 `ui/` 是空壳，ace-step-ui 的完整代码需要全量迁入
2. **类型两套**：`types.ts`（前端 PascalCase）和 `services/api.ts`（API snake_case）有重复类型
3. **acestep.ts 需拆分**：991 行的生成服务同时包含 engine 核心逻辑 + Express 请求处理
4. **CLI 需扩展**：当前只管理 Express，需增加 Python 进程管理、模型管理、`generate` 命令
5. **CI 超前设计**：已引用 `packages/` 结构，但目录未创建

---

## 2. 目标架构

```
ACE-Step-1.5/
├── acestep/                  # [不动] Python AI 引擎
├── openrouter/               # [不动] OpenRouter API 服务
├── packages/                 # [新建] npm workspace 5 包
│   ├── engine/               # 核心引擎（TypeScript）
│   ├── server/               # 薄 Express 路由层（TypeScript）
│   ├── cli/                  # CLI 入口 + 命令模块（纯 .mjs）
│   ├── front/                # React UI 层（TypeScript + Vite）
│   └── shared/               # 纯类型包（零运行时依赖）
├── data/                     # [迁入] 风格列表、genres、news
│   ├── main_style.txt        # 从 ace-step-ui/data/
│   ├── all_style.txt         # 从 ace-step-ui/data/
│   ├── genres.ts             # 从 ace-step-ui/data/
│   └── news.json             # 从 ace-step-ui/data/
├── public/                   # [新建] 音频输出 + front 构建产物
│   └── audio/
├── docs/                     # [已有] 文档
│   └── DESIGN.md             # 本文档
├── package.json              # [改] workspaces → ["packages/*"]
├── .env                      # [新建] 统一环境变量
├── .env.example              # [改] 合并 Python + Node.js（单文件）
├── .gitignore                # [改] 合并两方的 gitignore
└── pyproject.toml            # [不动] uv Python
```

### 依赖流向

```
cli ────→ engine（启停进程、CLI 生成音乐）
cli ────→ server（健康检查 HTTP）
server ─→ engine（API 生成请求 → Gradio）
front ──→ server（HTTP API）
shared ─→ engine, server, front 引用类型（零运行时依赖）
```

---

## 3. 5 包职责与边界

### 3.1 `packages/engine/` — 核心引擎层（TypeScript）

**职责**：所有与音乐生成直接相关的逻辑
**不允许**：直接写 HTTP 路由、操作数据库、管理进程
engine 使用 **TypeScript**（与 ace-step-ui 原代码一致），加 tsconfig + `tsx` 依赖。server 和 cli 引用时由 tsx/tsc 处理，无需 engine 自己编译产出。

| 源文件（ace-step-ui） | 目标路径 | 处理方式 |
|----------------------|---------|---------|
| `server/src/services/acestep.ts` | `packages/engine/src/acestep.ts` | 拆分：保留 Gradio 客户端、参数映射、模型切换、Python spawn 降级、任务队列。**移除** Express 请求处理部分 |
| `server/src/services/gradio-client.ts` | `packages/engine/src/gradio-client.ts` | 直接复制 |
| `server/src/services/generationQueue.ts` | `packages/engine/src/generation-queue.ts` | 直接复制 |
| `server/src/services/deepseek.ts` | `packages/engine/src/deepseek.ts` | 直接复制 |

**新增文件**：
- `packages/engine/src/index.ts` — barrel export
- `packages/engine/package.json`
- `packages/engine/tsconfig.json`

### 3.2 `packages/server/` — 薄路由层（TypeScript）

**职责**：Express 路由、JWT 鉴权、SQLite CRUD、请求转发到 engine
**不允许**：直接调用 Gradio API、管理 Python 进程

| 源文件（ace-step-ui） | 目标路径 | 处理方式 |
|----------------------|---------|---------|
| `server/src/index.ts` | `packages/server/src/index.ts` | 直接复制，路径引用改为 `@acestep/engine` |
| `server/src/config/index.ts` | `packages/server/src/config/index.ts` | 直接复制 |
| `server/src/db/pool.ts` | `packages/server/src/db/pool.ts` | 直接复制 |
| `server/src/db/sqlite.ts` | `packages/server/src/db/sqlite.ts` | 直接复制 |
| `server/src/db/migrate.ts` | `packages/server/src/db/migrate.ts` | 直接复制 |
| `server/src/middleware/auth.ts` | `packages/server/src/middleware/auth.ts` | 直接复制 |
| `server/src/routes/songs.ts` | `packages/server/src/routes/songs.ts` | 直接复制 |
| `server/src/routes/generate.ts` | `packages/server/src/routes/generate.ts` | **修改**：从 `@acestep/engine` 导入 acestep 服务 |
| `server/src/routes/playlists.ts` | `packages/server/src/routes/playlists.ts` | 直接复制 |
| `server/src/routes/referenceTrack.ts` | `packages/server/src/routes/referenceTrack.ts` | 直接复制 |
| `server/src/routes/contact.ts` | `packages/server/src/routes/contact.ts` | 直接复制 |
| `server/src/services/storage/factory.ts` | `packages/server/src/services/storage/factory.ts` | 直接复制 |
| `server/src/services/storage/local.ts` | `packages/server/src/services/storage/local.ts` | 直接复制 |
| `server/src/services/storage/index.ts` | `packages/server/src/services/storage/index.ts` | 直接复制 |
| `server/src/services/cleanup.ts` | `packages/server/src/services/cleanup.ts` | 直接复制 |

### 3.3 `packages/cli/` — CLI 入口（纯 `.mjs`）

**职责**：进程管理（Python/Express/Vite）、日志、健康检查、`generate` 命令、配置管理
**不允许**：写业务逻辑、直接调 Gradio
**格式说明**：CLI 保持 ace-step-ui 原有的 `.mjs` 格式，不引入 TypeScript 编译。

| 源文件（ace-step-ui） | 目标路径 | 处理方式 |
|----------------------|---------|---------|
| `server/cli.mjs` | `packages/cli/src/cli.mjs` | 复制 + 扩展：增加 `install`、`model`、`start engine`、`stop engine` 命令 |
| `server/src/cli/output.mjs` | `packages/cli/src/output.mjs` | 直接复制 |
| `server/src/cli/env.mjs` | `packages/cli/src/env.mjs` | 直接复制 |
| `server/src/cli/pid.mjs` | `packages/cli/src/pid.mjs` | 复制 + 增加 Python PID 管理 |
| `server/src/cli/daemon.mjs` | `packages/cli/src/daemon.mjs` | **重写**：增加 Python 进程 spawn（`uv run acestep`） |
| `server/src/cli/help.mjs` | `packages/cli/src/help.mjs` | 直接复制 + 新命令 |
| `server/src/cli/exit-codes.mjs` | `packages/cli/src/exit-codes.mjs` | 直接复制 |
| `server/src/cli/commands/config.mjs` | `packages/cli/src/commands/config.mjs` | 直接复制 |
| `server/src/cli/commands/dev.mjs` | `packages/cli/src/commands/dev.mjs` | **重写**：同时启动 engine + server + front |
| `server/src/cli/commands/health.mjs` | `packages/cli/src/commands/health.mjs` | 复制 + 增加 Python 健康检查 |
| `server/src/cli/commands/info.mjs` | `packages/cli/src/commands/info.mjs` | 复制 + 增加 Python/GPU 信息 |
| `server/src/cli/commands/list.mjs` | `packages/cli/src/commands/list.mjs` | 直接复制 |
| `server/src/cli/commands/logs.mjs` | `packages/cli/src/commands/logs.mjs` | 复制 + 增加 Python 日志 |
| `server/src/cli/commands/start.mjs` | `packages/cli/src/commands/start.mjs` | **重写**：支持 `engine` 子命令启动 Python |
| `server/src/cli/commands/status.mjs` | `packages/cli/src/commands/status.mjs` | 复制 + 增加 Python 状态 |
| `server/src/cli/commands/stop.mjs` | `packages/cli/src/commands/stop.mjs` | **重写**：支持 `engine` 子命令停止 Python |

**新增命令模块**（ace-step-ui 引用但未实现）：
- `packages/cli/src/commands/install.mjs`
- `packages/cli/src/commands/model.mjs`
- `packages/cli/src/commands/generate.mjs`
- `packages/cli/src/commands/build.mjs`
- `packages/cli/src/commands/cleanup.mjs`

**无 tsconfig.json** — CI 中通过 `node --check` 做语法验证。

### 3.4 `packages/front/` — React UI（TypeScript + Vite）

**职责**：纯展示层，所有数据通过 HTTP API 获取
**不允许**：直接调用 engine 或 Gradio，不依赖 `@acestep/engine` 运行时包

| 源文件（ace-step-ui） | 目标路径 | 处理方式 |
|----------------------|---------|---------|
| `index.html` | `packages/front/index.html` | 直接复制，title 改为中文 |
| `index.tsx` | `packages/front/src/index.tsx` | 直接复制 |
| `index.css` | `packages/front/src/index.css` | 直接复制 |
| `App.tsx` | `packages/front/src/App.tsx` | 直接复制 |
| `types.ts` | `packages/front/src/types.ts` | **改为引用** `@acestep/shared` 的类型，保留 UI 专用类型 |
| `vite.config.ts` | `packages/front/vite.config.ts` | 直接复制，proxy 路径更新 |
| `tsconfig.json` | `packages/front/tsconfig.json` | 直接复制 |
| `tailwind.config.js` | `packages/front/tailwind.config.js` | 直接复制 |
| `postcss.config.js` | `packages/front/postcss.config.js` | 直接复制 |
| `vite-env.d.ts` | `packages/front/src/vite-env.d.ts` | 直接复制 |
| `global.d.ts` | `packages/front/src/global.d.ts` | 直接复制 |
| `components/*.tsx` (19 个) | `packages/front/src/components/*.tsx` | 直接复制 |
| `context/*.tsx` (3 个) | `packages/front/src/context/*.tsx` | 直接复制 |
| `services/api.ts` | `packages/front/src/services/api.ts` | 直接复制，类型引用改为 `@acestep/shared` |
| `i18n/translations.ts` | `packages/front/src/i18n/translations.ts` | 直接复制，默认语言改为 zh |
| `utils/cover.ts` | `packages/front/src/utils/cover.ts` | 直接复制 |
| `utils/avatar.ts` | `packages/front/src/utils/avatar.ts` | 直接复制 |

### 3.5 `packages/shared/` — 纯类型包

**职责**：零运行时依赖的类型定义包，engine、server、front 都依赖它获取类型但不引入运行时代码。
**只包含 `.d.ts` 或 `.ts` 类型文件**，无任何运行时逻辑。

| 类型名 | 来源（ace-step-ui） | 说明 |
|--------|-------------------|------|
| `Song` | `types.ts` + `services/api.ts` | 统一为 camelCase。API 响应中的 `audio_url` → `audioUrl`，`is_public` → `isPublic` |
| `Playlist` | `types.ts` + `services/api.ts` | 同上归一化 |
| `GenerationParams` | `types.ts` | ~50 字段的音乐生成参数，保持全部字段 |
| `User` | `types.ts` | 用户信息 |
| `UserProfile` | `services/api.ts` | 用户资料 + 公开歌曲/播放列表 |
| `Comment` | `types.ts` | 评论 |
| `View` | `types.ts` | 前端视图枚举：`'create'│'library'│'profile'│'song'│'playlist'│'search'│'news'` |
| `PlayerState` | `types.ts` | 播放器状态 |
| `GenerationStatus` | `services/api.ts` | 生成任务状态 |
| `SearchResult` | `services/api.ts` | 搜索结果 |

**`packages/shared/package.json`**：
```json
{
  "name": "@acestep/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**`packages/shared/tsconfig.json`**：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### 3.6 `data/` 目录

| 源文件（ace-step-ui） | 目标路径 |
|----------------------|---------|
| `data/main_style.txt` | `ACE-Step-1.5/data/main_style.txt` |
| `data/all_style.txt` | `ACE-Step-1.5/data/all_style.txt` |
| `data/genres.ts` | `ACE-Step-1.5/data/genres.ts` |
| `data/news.json` | `ACE-Step-1.5/data/news.json` |

---

## 4. Milestone 1：结构跑通

**目标**：`npm install` 通过，5 包目录结构完整，server + front + shared 的 TypeScript 类型检查通过。

### 4.1 Step 1：初始化 5 包目录 + 删除空壳

**先删除** `server/` 和 `ui/` 空壳目录（避免与 `packages/server/` `packages/front/` 混淆）：
```bash
rm -rf server ui
```

**创建以下目录和配置：**

```
packages/
  engine/package.json + src/
  server/package.json + tsconfig.json + src/
  cli/package.json + src/
  front/package.json + tsconfig.json + src/
  shared/package.json + tsconfig.json + src/
public/audio/
```

#### 根 `package.json`

```json
{
  "name": "ace-step",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "echo '请手动启动: uv run acestep & npx tsx packages/server/src/index.ts & npm run dev -w packages/front'",
    "dev:python": "uv run acestep",
    "dev:server": "npm run dev -w packages/server",
    "dev:front": "npm run dev -w packages/front",
    "build": "npm run build -w packages/front",
    "typecheck": "npm run typecheck -w packages/engine && npm run typecheck -w packages/server && npm run typecheck -w packages/front && npm run typecheck -w packages/shared",
    "setup": "node packages/cli/src/cli.mjs install",
    "clean": "node packages/cli/src/cli.mjs clean"
  },
  "engines": { "node": ">=18" }
}
```

> `typecheck` 包含 engine、server、front、shared 四包 TypeScript 检查。CLI（纯 .mjs）通过 `node --check` 验证语法。

#### `packages/engine/package.json`

```json
{
  "name": "@acestep/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gradio/client": "^2.0.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  }
}
```

#### `packages/engine/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

#### `packages/server/package.json`

```json
{
  "name": "@acestep/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "db:migrate": "tsx src/db/migrate.ts"
  },
  "dependencies": {
    "@acestep/engine": "*",
    "express": "^4.18.0",
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.0",
    "multer": "^2.0.2",
    "node-cron": "^4.2.1",
    "uuid": "^9.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "@types/express": "^4.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/cors": "^2.8.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/multer": "^2.0.0",
    "@types/node-cron": "^3.0.0",
    "@types/uuid": "^9.0.0"
  }
}
```

> `multer` 版本保持原始 ace-step-ui 的 `^2.0.2`（非 `^1.4.5`）。

#### `packages/server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

#### `packages/cli/package.json`（纯 .mjs，无 tsconfig）

```json
{
  "name": "@acestep/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "acestep": "./src/cli.mjs"
  },
  "scripts": {},
  "dependencies": {
    "@acestep/engine": "*"
  },
  "devDependencies": {}
}
```

> 无 `tsconfig.json`。CLI 语法验证走 `node --check src/cli.mjs`。

#### `packages/front/package.json`

```json
{
  "name": "@acestep/front",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3000",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@acestep/shared": "*",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "lucide-react": "^0.563.0",
    "@ffmpeg/ffmpeg": "^0.12.0",
    "@ffmpeg/util": "^0.12.0"
  },
  "devDependencies": {
    "vite": "^6.2.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.8.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node": "^20.0.0"
  }
}
```

> front 依赖 `@acestep/shared`（纯类型包），**不依赖** `@acestep/engine`（避免把 `@gradio/client` 拉进前端 bundle）。

#### `packages/front/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4.2 Step 2：迁入代码

按以下批次执行文件复制，每个批次完成后执行 `tsc --noEmit`（engine + server + front + shared 四包）+ `node --check packages/cli/src/cli.mjs` 验证：

**批次 A — shared 层**（先创建类型，后续包引用）：
1. 新建 `packages/shared/src/index.ts` — 导出所有类型
2. 创建 `packages/shared/src/types.ts` — Song, Playlist, GenerationParams, User 等

**批次 B — engine 层**：
1. `ace-step-ui/server/src/services/acestep.ts` → `packages/engine/src/acestep.ts`
   - 保留：`GenerationParams`、`generateMusicViaAPI`、`getJobStatus`、`getAudioStream`、`discoverEndpoints`、`checkSpaceHealth`、`cleanupJob`、`downloadAudioToBuffer`、`resolvePythonPath`
   - 移出：Express 请求处理、路由层中间件调用
2. `ace-step-ui/server/src/services/gradio-client.ts` → `packages/engine/src/gradio-client.ts`
3. `ace-step-ui/server/src/services/generationQueue.ts` → `packages/engine/src/generation-queue.ts`
4. `ace-step-ui/server/src/services/deepseek.ts` → `packages/engine/src/deepseek.ts`
5. 新建 `packages/engine/src/index.ts` — barrel export

**批次 C — server 层**：
1. 从 ace-step-ui `server/src/` 复制全部源文件到 `packages/server/src/`
2. 修改 `index.ts` 中的 import 路径：`../services/acestep` → `@acestep/engine`
3. 修改 `routes/generate.ts` 中的 import 路径：从 `@acestep/engine` 导入 acestep services

**批次 D — CLI 层**：
1. ace-step-ui `server/cli.mjs` → `packages/cli/src/cli.mjs`
2. ace-step-ui `server/src/cli/` → `packages/cli/src/`
3. ace-step-ui `server/src/cli/commands/` → `packages/cli/src/commands/`
4. 修改 `daemon.mjs`：增加 Python 进程管理
5. 修改 `start.mjs` / `stop.mjs`：支持 `engine` 子命令

**批次 E — front 层**：
1. 从 ace-step-ui 根目录复制全部前端文件到 `packages/front/`
2. 调整目录结构：`index.html` → 根，`*.tsx` → `src/`
3. 类型引用改为 `@acestep/shared`

**批次 F — data 目录**：
1. 复制 `ace-step-ui/data/main_style.txt` → `ACE-Step-1.5/data/main_style.txt`
2. 复制 `ace-step-ui/data/all_style.txt` → `ACE-Step-1.5/data/all_style.txt`
3. 复制 `ace-step-ui/data/genres.ts` → `ACE-Step-1.5/data/genres.ts`
4. 复制 `ace-step-ui/data/news.json` → `ACE-Step-1.5/data/news.json`

### 4.3 Step 3：类型归一化

**核心原则**：公共类型只在 `packages/shared/src/types.ts` 定义一份。

| 当前位置 | 类型 | 处理方式 |
|---------|------|---------|
| ace-step-ui `types.ts` | Song, Playlist, GenerationParams, User, View | **迁移到** `@acestep/shared`，front 引用 shared |
| ace-step-ui `services/api.ts` | Song, Playlist (snake_case) | **合并到 shared types**，统一 camelCase |
| 两套 Song 的差异 | `audioUrl` vs `audio_url` | 统一为 camelCase，API 响应层做转换 |

**命名规范**（`packages/shared/src/types.ts`）：
- camelCase 属性名（`audioUrl`、`isPublic`、`likeCount`）
- 前端 `services/api.ts` 中新增 `transformSong()` 函数，将 API 响应（snake_case）转为 camelCase
- `GenerationParams` 保持全部 ~50 字段（与 Gradio API 参数一一对应）

### 4.4 Step 4：`npm install` 验证

```bash
# 清理旧的 node_modules 和空壳
rm -rf node_modules server ui

# 根 workspace 安装
npm install

# TypeScript 检查（engine + server + front + shared 四包）
npm run typecheck

# 语法检查（cli 纯 .mjs）
node --check packages/cli/src/cli.mjs
```

**验证标准**：
- [ ] `npm install` 成功，无依赖冲突
- [ ] `npm run typecheck` 通过（engine + server + front + shared 四包）
- [ ] `node --check packages/cli/src/cli.mjs` 通过（cli 纯 .mjs）
- [ ] `data/` 目录文件存在
- [ ] `public/audio/` 目录存在（.gitkeep）

---

## 5. Milestone 2：功能就绪

**目标**：所有现有功能保持，端到端：front → server → engine → Gradio → 音频输出

### 5.1 Step 1：`acestep.ts` 拆分

`packages/engine/src/acestep.ts`（原 991 行）拆分为：

```
packages/engine/src/
  index.ts          # barrel export
  params.ts         # GenerationParams 类型 + 51 参数映射
  client.ts         # Gradio API 调用（generate, status, download）
  python.ts         # Python 进程 fallback + spawn
  model.ts          # 模型发现/切换
  queue.ts          # 任务队列（引用 generation-queue.ts）
```

**拆分规则**（遵循现有 AGENTS.md 的 ≤200 LOC 策略）：
- `params.ts` — 类型定义 + 参数映射逻辑
- `client.ts` — HTTP 调用 Gradio endpoint
- `python.ts` — Python subprocess fallback
- `model.ts` — DiT 模型管理
- `queue.ts` — 任务队列逻辑

### 5.2 Step 2：CLI 进程管理

**`packages/cli/src/daemon.mjs`** 增加：

```javascript
// Python 引擎进程管理
async function spawnEngine({ port }) {
  // uv run acestep --port ${port}
  // 等待 Gradio 就绪（轮询 /health 或 /）
  // 写入 engine.pid
}

async function stopEngine(pid) {
  // SIGTERM → 等待 → SIGKILL / taskkill /F
}

// 修改 dev 命令：同时启动 engine + server + front
async function spawnDev() {
  await spawnEngine({ port: 7860 });
  await spawnServer({ port: 3001 });
  await spawnFront({ port: 3000 }); // Vite dev server
}
```

### 5.3 Step 3：路径修正

所有硬编码路径需要修正：

| 旧路径（ace-step-ui） | 新路径（ACE-Step-1.5） |
|----------------------|----------------------|
| `server/public/audio/` | `public/audio/` |
| `server/logs/` | `logs/` |
| `data/`（在 ace-step-ui 根目录） | `ACE-Step-1.5/data/` |
| `./data/acestep.db` | `./data/acestep.db`（不变） |
| `server/src/` | `packages/server/src/` |
| Gradio API `http://localhost:8001` | `http://localhost:7860`（统一端口） |

### 5.4 Step 4：.env 单文件合并

Python 引擎配置 + Node.js 层配置合并为一个 `.env.example` 文件（**不保留双文件**）：

```env
# === ACE-Step 1.5 统一配置 ===

# --- Python 引擎 ---
ACESTEP_CONFIG_PATH=acestep-v15-turbo
ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-1.7B
GRADIO_PORT=7860
LANGUAGE=zh

# --- Node.js 服务 ---
SERVER_PORT=3001
FRONT_PORT=3000
NODE_ENV=development

# --- DeepSeek LLM ---
DEEPSEEK_API_KEY=sk-xxx

# --- 数据库 ---
DATABASE_PATH=./data/acestep.db

# --- JWT ---
JWT_SECRET=ace-step-local-secret

# --- 存储 ---
AUDIO_DIR=./public/audio
```

### 5.5 Step 5：端到端验证

> **注意**：M2 时不依赖 M3 的 CLI 新命令，直接使用底层调用验证。

```bash
# 1. 安装依赖
npm install
uv sync

# 2. 启动 Python 引擎
uv run acestep &
# === 等待 Gradio 就绪 :7860

# 3. 启动 Express 服务
npx tsx packages/server/src/index.ts &
# === Express :3001 就绪

# 4. 启动前端开发服务器
npm run dev -w packages/front &
# === Vite :3000

# 5. CLI 生成测试（通过 engine 客户端直接调 Gradio API）
npx tsx packages/engine/src/client.ts --prompt "温柔的钢琴曲 舒缓 治愈" --duration 30
# === 音频文件输出到 public/audio/

# 6. API 生成测试
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"title":"测试","style":"pop","duration":30}'
```

**验证标准**：
- [ ] Python Gradio 启动在 :7860
- [ ] Express 启动在 :3001
- [ ] `node packages/cli/src/cli.mjs status` 显示服务状态
- [ ] CLI 生成输出音频文件
- [ ] 前端通过 Vite proxy 访问 Express API
- [ ] Express 转发生成请求到 Gradio
- [ ] 音频文件存储到 `public/audio/`

---

## 6. Milestone 3：CLI 强化 + 中文

**目标**：CLI 完整命令实现、中文默认、去容器化完成

### 6.1 CLI 完整命令

| 命令 | 状态 | 说明 |
|------|------|------|
| `acestep install` | 新增 | 首次安装（uv sync + npm install + 模型下载） |
| `acestep dev` | 重写 | 一键启动全部（engine + server + front） |
| `acestep start engine` | 新增 | 启动 Python Gradio |
| `acestep start server` | 复制 | 启动 Express |
| `acestep stop engine` | 新增 | 停止 Python |
| `acestep stop server` | 复制 | 停止 Express |
| `acestep status` | 扩展 | 全部服务状态 |
| `acestep health` | 扩展 | engine + server + front 健康检查 |
| `acestep logs` | 扩展 | 支持 --engine / --server 过滤 |
| `acestep info` | 扩展 | GPU、模型列表、Python 路径 |
| `acestep model list` | 新增 | 列出已下载模型 |
| `acestep model switch` | 新增 | 切换 DiT 模型 |
| `acestep model download` | 新增 | 下载模型 |
| `acestep generate` | 新增 | CLI 直接生成音乐 |
| `acestep config` | 复制 | 查看/修改 .env |
| `acestep env` | 复制 | 环境诊断 |
| `acestep build` | 新增 | 构建 front 生产包 |
| `acestep clean` | 新增 | 清理临时文件 + 过期音频 |
| `acestep list styles` | 复制 | 列出音乐风格 |
| `acestep list models` | 复制 | 列出模型 |

### 6.2 中文默认

| 改动项 | 当前值 | 目标值 |
|--------|--------|--------|
| 前端 `I18nContext` 默认语言 | `navigator.language` 探测 | `zh` |
| `LANGUAGE` 环境变量默认 | `en` | `zh` |
| CLI 输出 | 英文 | **中文** |
| `README.md` | 中英混合 | **纯中文** |
| 所有文档 | 多语言 | **中文优先** |
| `index.html` title | "Local AI Music Generator" | "ACE-Step - 本地 AI 音乐生成" |
| 代码注释 | 部分英文 | **中文** |

### 6.3 去容器化

**删除文件**：
- `Dockerfile`
- `Dockerfile.jetson`
- `docker-compose.yml`
- `docker-compose.jetson.yml`

**删除 34 个 `.bat` / `.sh` 启动脚本**（具体清单）：
- `start_gradio_ui.bat`（16 个同名变体）
- `start_api_server.bat`（4 个同名变体）
- `start_gradio_ui.sh`（18 个同名变体）
- `start_api_server.sh`（4 个同名变体）
- `run_api_server.sh`
- `run_openrouter_api_server.sh`
- `close_api_server.sh`
- `check_update.bat` / `check_update.sh`
- `quick_test.bat` / `quick_test.sh`
- `test_env_detection.bat` / `test_env_detection.sh`
- `test_git_update.bat` / `test_git_update.sh`
- `setup.bat` / `setup.sh`
- `start.bat` / `start.sh`
- `start-all.bat` / `start-all.sh`
- `stop-all.sh`
- `install_uv.bat` / `install_uv.sh`
- `merge_config.bat` / `merge_config.sh`

> 注：ace-step-ui 和 ACE-Step-1.5 两边的 `.bat`/`.sh` 一并删除，最终 CLI 全权接管进程生命周期。

**修改文档**：
- `README.md` 中移除 Docker 安装方式
- `docs/` 中移除 Docker 相关文档

### 6.4 归档源项目

在 `ace-step-ui` 仓库根目录添加 `ARCHIVED.md`：

```markdown
# 此仓库已归档

代码已合并到 [ACE-Step-1.5](https://github.com/kuaizhongqiang/ACE-Step-1.5)，
重构为 5 包 monorepo 架构。

后续所有开发将在 ACE-Step-1.5 进行。
```

---

## 7. 配置与合并策略

### 7.1 `.gitignore` 合并

ACE-Step-1.5 已有合理的 `.gitignore`，需补充 ace-step-ui 的额外排除项并删除空壳引用：

```gitignore
# === Node.js 层（从 ace-step-ui 补充） ===
logs/
packages/*/dist/
public/audio/*.mp3
public/audio/*.wav
packages/*/.vite/

# === 已有的（保留不动） ===
checkpoints/
node_modules/
*.mp3
*.wav
.env
.env.local
```

删除 `.gitignore` 中引用 `server/` 和 `ui/` 的规则（这两个目录已删除）。

### 7.2 环境文件

**合并为单文件**：`ACE-Step-1.5/.env.example`

内容见 [5.4 Step 4：.env 单文件合并](#54-step-4env-单文件合并)。删除旧的 `ACE-Step-1.5/env.example`（Node.js 层面板配置）。

### 7.3 废弃文件清理

**M1 Step 1 即删除**：
- `server/` 和 `ui/` 空壳目录

**M3 完成时删除**：
- `Dockerfile*`、`docker-compose*`
- 所有 `.bat` / `.sh` 启动脚本
- `data/.gitkeep`

---

## 8. CI/CD 更新

### 8.1 GitHub Actions — `ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  python-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync
      - run: uv run python -m unittest discover -s . -p "*_test.py"

  typescript-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx tsc --noEmit -p packages/engine/tsconfig.json
      - run: npx tsc --noEmit -p packages/shared/tsconfig.json
      - run: npx tsc --noEmit -p packages/server/tsconfig.json
      - run: npx tsc --noEmit -p packages/front/tsconfig.json

  javascript-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: node --check packages/cli/src/cli.mjs

  front-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build -w packages/front
```

> 关键区别：`node-version: 20`（与原始 ace-step-ui CI 一致）、拆出独立的 `javascript-check` job 来验证 cli 的 `.mjs` 文件。

### 8.2 自动 Tag（auto-tag.yml）

现有 `auto-tag.yml` 基于 PR label（patch/minor/major）自动 bump 版本。

**版本同步策略**：
- **`package.json`**：auto-tag 自动更新根 `package.json` 版本号
- **`pyproject.toml`**：Python 引擎版本独立维护，不自动跟随 Node.js 版本
- tag 格式：`v{major}.{minor}.{patch}`

### 8.3 无 Docker 构建

删除 `container.yml`（去容器化）。

---

## 9. 验证方案

### 9.1 每个 Step 的快速验证

```bash
# 类型检查（engine + server + front + shared 四包）
npm run typecheck

# 语法检查（cli 纯 .mjs）
node --check packages/cli/src/cli.mjs
```

### 9.2 Milestone 验收

| Milestone | 验收标准 |
|-----------|---------|
| M1 | `npm install` + `npm run typecheck` + `node --check engine + cli` 通过 |
| M2 | Python Gradio :7860 + Express :3001 启动，API 生成请求成功返回 |
| M3 | 所有 CLI 命令可用，中文界面默认，无 Docker 文件，无 .bat/.sh |

### 9.3 端到端测试脚本

```bash
#!/bin/bash
# e2e-test.sh — 完整链路测试
set -e

echo "=== 1. 环境检查 ==="
node --version
python --version
uv --version

echo "=== 2. 安装依赖 ==="
npm install
uv sync

echo "=== 3. TypeScript 类型检查 ==="
npm run typecheck

echo "=== 4. 语法检查（CLI 纯 .mjs）==="
node --check packages/cli/src/cli.mjs

echo "=== 5. Python 测试 ==="
uv run python -m unittest discover -s . -p "*_test.py"

echo "=== 6. 启动服务 ==="
uv run acestep &
ENGINE_PID=$!
sleep 15  # 等待 Gradio 就绪
npx tsx packages/server/src/index.ts &
SERVER_PID=$!
sleep 3

echo "=== 7. 健康检查 ==="
curl -s http://localhost:3001/health | grep -q "ok" && echo "Express OK"
curl -s http://localhost:7860/ -o /dev/null && echo "Gradio OK"

echo "=== 8. API 测试 ==="
curl -s -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"title":"e2e测试","style":"pop","duration":15}'

echo "=== 9. 停止服务 ==="
kill $SERVER_PID 2>/dev/null
kill $ENGINE_PID 2>/dev/null

echo "=== ✅ 全部通过 ==="
```

---

## 附录 A：文件操作清单（按批次）

### M1 创建/复制文件（总计 ~80 个）

| 批次 | 文件数 | 操作 |
|------|--------|------|
| A (shared .ts) | 4 | `index.ts`, `types.ts`, `package.json`, `tsconfig.json` |
| B (engine .ts) | 7 | `acestep.ts`, `gradio-client.ts`, `generation-queue.ts`, `deepseek.ts`, `index.ts`, `package.json`, `tsconfig.json` |
| C (server .ts) | 17 | 复制 15 个源文件 + `package.json` + `tsconfig.json` |
| D (cli .mjs) | 10 | `cli.mjs` + 8 模块 + `package.json` |
| E (front .tsx) | 30 | 复制所有前端文件 + `package.json` + `tsconfig.json` |
| F (data) | 4 | `main_style.txt`, `all_style.txt`, `genres.ts`, `news.json` |
| 根配置 | 3 | 根 `package.json`, `.env.example`, `.gitignore` 更新 |
| 新建目录 | 3 | `packages/`, `packages/*/src/`, `public/audio/` |
| 删除空壳 | 2 | `server/`, `ui/` |

### M2 修改文件（总计 ~10 个）

| 文件 | 改动 |
|------|------|
| `packages/engine/src/acestep.ts` | 拆分为 5 模块 |
| `packages/cli/src/daemon.mjs` | 增加 Python 进程管理 |
| `packages/cli/src/commands/start.mjs` | 增加 engine 子命令 |
| `packages/cli/src/commands/stop.mjs` | 增加 engine 子命令 |
| `packages/cli/src/commands/dev.mjs` | 同时启动 engine + server + front |
| `packages/cli/src/commands/status.mjs` | 增加 engine 状态 |
| `packages/cli/src/commands/health.mjs` | 增加 engine 健康检查 |
| `packages/server/src/routes/generate.ts` | import 改为 `@acestep/engine` |
| `packages/server/src/index.ts` | import 路径修正 |
| `.env.example` | 合并 Python + Node.js 为单文件 |

### M3 创建/删除文件

**新建**：
- `packages/cli/src/commands/install.mjs`
- `packages/cli/src/commands/model.mjs`
- `packages/cli/src/commands/generate.mjs`
- `packages/cli/src/commands/build.mjs`
- `packages/cli/src/commands/cleanup.mjs`
- `ARCHIVED.md`（放到 ace-step-ui 仓库）

**删除**：
- `Dockerfile`、`Dockerfile.jetson`
- `docker-compose.yml`、`docker-compose.jetson.yml`
- 34 个 `.bat` / `.sh` 启动脚本（详见 6.3）
- `data/.gitkeep`

---

## 附录 B：package 运行时依赖关系

```
@acestep/engine
  ├── dependencies: @gradio/client
  ├── devDependencies: tsx, typescript, @types/node
  └── 格式: .ts (通过 tsx 运行)

@acestep/server
  ├── dependencies: @acestep/engine, express, better-sqlite3, cors, helmet, jsonwebtoken, multer@^2.0.2, node-cron, uuid, dotenv
  ├── devDependencies: tsx, typescript, @types/*
  └── 格式: .ts (通过 tsx 运行)

@acestep/cli
  ├── dependencies: @acestep/engine
  └── 格式: .mjs (纯 JS，零编译)

@acestep/front
  ├── dependencies: @acestep/shared, react, react-dom, lucide-react, @ffmpeg/ffmpeg, @ffmpeg/util
  ├── devDependencies: vite, typescript, tailwindcss, autoprefixer, postcss, @types/*
  └── 格式: .ts/.tsx (通过 Vite + tsc)

@acestep/shared
  ├── devDependencies: typescript
  ├── 零运行时依赖
  └── 格式: .ts (类型定义 + tsconfig)
```

---

## 附录 C：关键风险与缓解

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| `acestep.ts` 拆分破坏现有功能 | 中 | 先在 engine 包中保留完整副本，再逐步拆分；每个拆分 step 后跑端到端测试 |
| npm workspace 中 `@acestep/*` 包引用 | 低 | npm workspace 原生支持 `"*"` 版本号引用本地包 |
| Python 进程管理跨平台问题 | 中 | daemon.mjs 已有 Windows `tasklist`/`taskkill` 处理 |
| Gradio 端口冲突（7860 vs 8001） | 低 | 统一为 7860，通过 `.env` 可配置 |
| 前端 proxy 配置迁移 | 低 | Vite proxy 配置简单，复制即可 |
| CLI 新增 5 个命令未实现 | 中 | M3 专门处理；M2 不使用这些命令不影响核心功能 |
| `data/` 目录 `.gitignore` 排除问题 | 低 | `.gitignore` 已正确豁免 `main_style.txt` 等文件 |
| `@acestep/shared` 类型与 engine 内部类型脱节 | 低 | engine 是 .ts，同时使用自身内部类型和 `@acestep/shared`，需在 M2 拆分时确保同步更新 |
