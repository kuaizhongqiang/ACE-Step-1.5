# ACE-Step-1.5 迁移方案

> 将 `kuaizhongqiang/ace-step-ui` 的 Node.js 层合并到 `kuaizhongqiang/ACE-Step-1.5`，
> 形成 Python 引擎 + Node.js 编排 + React 前端的单体仓库。
> `kuaizhongqiang/ace-step-ui` 改造完成后归档。

---

## 目标目录结构

```
kuaizhongqiang/ACE-Step-1.5/
│
├── 🔒 Python 层 (不动)
│   ├── acestep/                    # AI 引擎核心
│   ├── openrouter/                 # OpenRouter API 服务
│   ├── cli.py                      # 生成向导
│   ├── train.py                    # 训练入口
│   ├── generate_examples.py
│   ├── profile_inference.py
│   ├── pyproject.toml / uv.lock    # Python 依赖
│   ├── requirements*.txt
│   ├── docs/                       # 上游文档
│   ├── assets/                     # 资源
│   ├── examples/                   # 400+ 示例
│   ├── scripts/                    # 辅助脚本
│   └── Dockerfile* / docker-compose*
│
├── 🆕 Node.js 层 (从 ace-step-ui 迁移)
│   ├── package.json                # 统一 Node.js 依赖 (frontend + server + CLI)
│   ├── package-lock.json
│   │
│   ├── server/                     # Express 中间层
│   │   ├── cli.mjs                  # CLI 入口
│   │   ├── package.json             # server 独立依赖
│   │   └── src/
│   │       ├── index.ts             # Express 入口
│   │       ├── config/
│   │       │   └── index.ts
│   │       ├── db/
│   │       │   ├── migrate.ts
│   │       │   ├── pool.ts
│   │       │   └── sqlite.ts
│   │       ├── middleware/
│   │       │   └── auth.ts
│   │       ├── routes/
│   │       │   ├── songs.ts
│   │       │   ├── generate.ts
│   │       │   ├── playlists.ts
│   │       │   ├── referenceTrack.ts
│   │       │   └── contact.ts
│   │       ├── services/
│   │       │   ├── acestep.ts
│   │       │   ├── deepseek.ts
│   │       │   ├── generationQueue.ts
│   │       │   ├── gradio-client.ts
│   │       │   ├── cleanup.ts
│   │       │   └── storage/
│   │       │       ├── factory.ts
│   │       │       ├── index.ts
│   │       │       └── local.ts
│   │       ├── scripts/
│   │       │   ├── backfill-avatars.ts
│   │       │   └── test-queue.ts
│   │       └── cli/
│   │           ├── daemon.mjs
│   │           ├── env.mjs
│   │           ├── exit-codes.mjs
│   │           ├── help.mjs
│   │           ├── output.mjs
│   │           ├── pid.mjs
│   │           └── commands/
│   │               ├── config.mjs
│   │               ├── dev.mjs
│   │               ├── health.mjs
│   │               ├── info.mjs
│   │               ├── list.mjs
│   │               ├── logs.mjs
│   │               ├── start.mjs
│   │               ├── status.mjs
│   │               └── stop.mjs
│   │
│   ├── ui/                         # React 前端
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   ├── index.html
│   │   ├── index.css
│   │   ├── types.ts
│   │   ├── global.d.ts
│   │   ├── vite-env.d.ts
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── components/
│   │   ├── context/
│   │   ├── i18n/
│   │   ├── services/
│   │   └── utils/
│   │
│   ├── data/                       # 共享数据
│   │   ├── all_style.txt
│   │   ├── main_style.txt
│   │   ├── genres.ts
│   │   └── news.json
│   │
│   ├── bin/
│   │   └── cli.js                  # npx 入口
│   │
│   └── public/                     # 前端构建输出 + 音频
│       ├── audio/
│       └── (dist/)
│
├── 🔧 配置文件
│   ├── .env                        # 统一环境变量 (服务端 + Python 配置合并)
│   ├── .env.example
│   ├── .gitignore                  # 合并后的 gitignore
│   ├── cliff.toml
│   ├── start-all.bat
│   ├── start-all.sh
│   └── setup.sh / setup.bat
│
├── 📄 文档 (重写)
│   ├── README.md                   # 中文重写
│   ├── CODEBUDDY.md                # AI Agent 指南
│   ├── AGENTS.md                   # 保留，增加 Node.js 层说明
│   ├── CONTRIBUTING.md
│   └── LICENSE
│
└── ❌ 删除 (迁移后可清理的启动脚本)
    ├── start_gradio_ui.bat  (所有 16 个 .bat)
    ├── start_gradio_ui.sh   (所有 18 个 .sh)
    ├── start_api_server.*
    ├── check_update.*
    ├── quick_test.*
    ├── test_env_detection.*
    ├── test_git_update.*
    ├── merge_config.*
    ├── run_api_server.sh
    ├── run_openrouter_api_server.sh
    ├── close_api_server.sh
    └── install_uv.*
```

---

## 迁移清单

### Phase 1: 基础结构 (目标: `npm install` 成功)

| 操作 | 源 | 目标 |
|------|---|------|
| 创建目录 | — | `server/`, `ui/`, `data/`, `bin/`, `public/` |
| 迁 server src | `ace-step-ui/server/src/` | `server/src/` |
| 迁 CLI | `ace-step-ui/server/cli.mjs` | `server/cli.mjs` |
| 迁 CLI 模块 | `ace-step-ui/server/src/cli/` | `server/src/cli/` |
| 迁 Server 配置 | `ace-step-ui/server/package.json` | `server/package.json` |
| 迁前端 | `ace-step-ui/components/` 等 | `ui/components/` |
| 迁前端配置 | `ace-step-ui/` vite/ts/tailwind | `ui/` |
| 迁服务层 | `ace-step-ui/services/` | `ui/services/` |
| 根 package.json | 新建 Monorepo npm workspaces | — |
| 合并 .gitignore | 两边的合并 | `.gitignore` |
| 合并 .env.example | 两边合并 | `.env.example` |

### Phase 2: 功能对齐

| 操作 | 说明 |
|------|------|
| `server/src/config/index.ts` | 更新路径引用 (指向相对路径) |
| `ui/vite.config.ts` | 更新 API 代理 / root 引用 |
| 全局类型引用更新 | `types.ts` 的相对导入 |
| `deepseek.ts` | 保持，text-to-text 统一入口 |
| Gradio 调用链路 | `acestep.ts` → 适配本仓库的 Gradio API 端口 |
| `package.json` scripts | `dev`, `build`, `start` 等 |

### Phase 3: CLI 统一

| 操作 | 说明 |
|------|------|
| `cli.mjs` 新增命令 | `start engine` / `stop engine` 管理 Python 进程 |
| `cli.mjs` 新增命令 | `generate` 族 (text/cover/reference) |
| 删除 shell 脚本 | 34 个 .bat/.sh 全部删除 |
| 新增 | `start-all.sh` / `start-all.bat` 一键启动 |

### Phase 4: 文档 + 收尾

| 操作 | 说明 |
|------|------|
| 重写 `README.md` | 中文 + 新架构说明 |
| 更新 `AGENTS.md` | 增加 Node.js 层指南 |
| 新增 `CODEBUDDY.md` | 全栈指引 |
| 新增 `server/README.md` | 路由表 + CLI 命令 |
| 新增 `ui/README.md` | 组件树 + 状态管理 |
| 新增 `docs/MIGRATION_PLAN.md` | 即本文档 |
| CI 更新 | `npm ci` + `tsc --noEmit` + `npm run build` |

### Phase 5: 清理

| 操作 | 说明 |
|------|------|
| 归档 `ace-step-ui` | 设为只读，README 加迁移公告 |
| Theme-UI 打包配置 | 确认 `dist/` 路径正常 |
| 发布策略 | 作为一个统一包发布 |

---

## 关键决策

### 1. 包管理器双轨制

```
npm  → server/ + ui/ + CLI (Node.js 层)
uv   → acestep/ + openrouter/ (Python 层)

根 package.json: workspaces = ["server", "ui"]
```

### 2. .env 统一

```env
# === Python 引擎 ===
ACESTEP_CONFIG_PATH=acestep-v15-turbo
ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-1.7B
PORT=7860                          # Gradio 端口
LANGUAGE=zh

# === Node.js 服务 ===
SERVER_PORT=3001                   # Express 端口
DEEPSEEK_API_KEY=sk-xxx
ACESTEP_API_URL=http://localhost:7860  # Gradio 地址 (本仓库内)
DATABASE_PATH=./data/songs.db

# === 共享 ===
JWT_SECRET=xxx
NODE_ENV=production
```

### 3. CLI 统一入口

```
node server/cli.mjs start          # 启动 Node.js Express
node server/cli.mjs start engine   # 启动 Python Gradio
node server/cli.mjs dev            # 一键启动全部 (Gradio + Express + Vite)
node server/cli.mjs generate "描述" # 音乐生成
```

### 4. 不迁移的内容

| 内容 | 原因 |
|------|------|
| `audiomass-editor/` | 太大，作为可选扩展 |
| `server/audio-editor/` | 同上，暂不迁移 |
| `.github/` workflows | 重写 (适配新结构) |
| `package-lock.json` | 重新生成 |

---

## 文件统计

| 分类 | 迁移文件数 | 新增/重写 | 删除文件数 (启动脚本) |
|------|-----------|-----------|---------------------|
| Server | 21 | 0 | — |
| CLI | 16 | 0 | — |
| 前端 | 37 | 0 | — |
| 数据 | 4 | 0 | — |
| 配置/文档 | 12 | 5 (README 等) | — |
| Shell 脚本 | — | 2 (start-all) | 34 (.bat/.sh) |
| **合计** | **~90** | **~7** | **34** |
