# ACE-Step-1.5 迁移方案

> 将 `ace-step-ui` 合并到本仓库，重构为 4 包架构。
> 核心原则：**功能只增不减、去容器化、CLI 主导、中文优先**。

---

## 目标架构

```
ACE-Step-1.5/
├── acestep/              # Python 引擎（不动）
├── python/               # Python 运行时（uv 管理）
├── packages/
│   ├── engine/           # 核心：音频生成 + LLM + 模型管理 + 任务队列
│   ├── server/           # 薄层：Express 路由 + JWT + SQLite
│   ├── cli/              # 全局大脑：进程管理 + 命令行调用 + 状态查询
│   └── front/            # 纯展示：React UI
├── data/                 # 静态数据（风格列表、genres、news）
├── public/               # 输出：音频文件 + front 构建产物
├── docs/                 # 中文文档
├── package.json          # npm workspaces: ["packages/*"]
├── pyproject.toml        # uv 管理 Python 依赖
└── .env                  # 统一环境变量
```

---

## 4 包职责

| 包 | 干的事 | 不干的事 |
|----|--------|---------|
| **engine** | Gradio 客户端、参数映射、模型热切换、Python spawn 降级、音频存储、生成任务队列、DeepSeek LLM、类型定义 | 不碰数据库、不写路由 |
| **server** | Express 路由、JWT 鉴权、SQLite CRUD、请求转发 engine | 不关心 Gradio 内部细节 |
| **cli** | 进程启停（Python/Express/Vite）、日志查看、健康检查、`generate` 命令、配置管理 | 不写业务逻辑 |
| **front** | React 组件、i18n（中文优先）、播放器、歌曲管理 UI | 不直接调 engine |

### 依赖关系

```
cli ────→ engine（启停进程、CLI 生成）
cli ────→ server（健康检查 HTTP）
server ─→ engine（API 生成请求）
front ──→ server（HTTP API）
```

---

## 去容器化

- 删除 `Dockerfile`、`Dockerfile.jetson`、`docker-compose.yml`、`docker-compose.jetson.yml`
- 删除 34 个 `.bat` / `.sh` 启动脚本
- CLI 全权接管进程生命周期：`cli start engine` / `cli start server` / `cli dev`（一键全部）
- `cli install` 负责首次环境准备（`uv sync` + `npm install`）

---

## 发布与安装

**从 npm 安装，不 clone 仓库。** `cli` 包是唯一对外的入口，发布到 npm。

```bash
npm install -g acestep        # 全局安装 CLI（薄壳，只装 Node 命令）
acestep install                # 首次安装：拉 Python 引擎 + 依赖 + 模型
acestep dev                    # 一键启动全部
```

`acestep install` 做的事：

1. 环境检测（python/node版本、GPU型号、VRAM）
2. `pip install ace-step` → 装 Python 引擎
3. `npm install` → 装 server + front 依赖
4. 下载模型 → `checkpoints/`
5. 生成 `.env` 配置文件
6. 构建 front 生产包

支持 `acestep install --skip-models` 跳过模型下载，手动 `acestep model download` 补。

---

## CLI 命令设计（面向 openclaw）

CLI 需足够丰富，让 openclaw 能完全通过命令控制整个系统：

```
cli install                # 首次安装：uv sync + npm install + 模型下载
cli dev                    # 一键启动全部（engine + server + front）

cli start engine           # 启动 Python Gradio
cli start server           # 启动 Express API
cli stop  engine           # 停止
cli stop  server           # 停止
cli restart engine         # 重启

cli status                 # 全部运行状态
cli health                 # 健康检查（engine + server + front 可访问性）
cli logs                   # 实时日志（--engine / --server）
cli info                   # 系统信息（GPU、模型列表、Python 路径）

cli model list             # 列出已下载 / 可用模型
cli model switch <name>    # 切换当前 DiT 模型
cli model download <name>  # 下载指定模型

cli generate "描述"        # CLI 直接生成音乐（调 engine）
cli config                 # 查看 / 修改配置
cli env                    # 环境诊断

cli build                  # 构建 front 生产包
cli clean                  # 清理临时文件 + 过期音频
```

---

## 类型归一

`GenerationParams` 等类型只在 `packages/engine/src/types.ts` 定义一份。front 用到哪些字段自己按需引用，不强制全量同步。

---

## 中文改造

- 所有文档 / 注释 / CLI 输出 / 前端默认语言 → 中文
- `LANGUAGE=zh` 作为环境默认值
- i18n 保留多语言能力，但中文为第一语言

---

## MILESTONE 1：结构跑通

- 创建 `packages/engine`、`packages/server`、`packages/cli`、`packages/front`
- 从 `ace-step-ui` 迁入代码，拆进对应包
- `package.json` workspaces 配置
- `npm install` 全量通过
- 类型定义统一到 engine，三处重复消除
- `acestep.ts` 拆分进 engine 内部模块

## MILESTONE 2：功能就绪

- engine 内部拆模块完毕，所有现有功能保持（Gradio + Python spawn 降级、模型切换、任务队列、DeepSeek）
- server 减到薄层，只做路由转发 + DB
- CLI 接管所有进程管理，删除 .bat/.sh
- 路径修正：不再依赖外部 `ACESTEP_PATH`
- 端到端：front → server → engine → Gradio → 音频输出

## MILESTONE 3：CLI 强化 + 中文

- CLI 完整命令列表实现
- CLI 面向 openclaw 使用场景优化输出格式
- 中文文档、中文界面默认
- 去容器化完成：删除 Docker 相关文件
- 归档 `ace-step-ui`

---

## 自动化：Issue / PR / CI / Test / Publish

### Issue

模板分三类：Bug、Feature、Question。自动打 `triage` 标签。openclaw 可扫描 issue 列表判断当前待处理事项。

### PR

- `main` 分支保护，PR 必须通过 CI 才能合并
- CI 跑：`tsc --noEmit`（server + front）、`npm run build`（front）、Python unittest
- PR 描述模板：改了啥 + 影响范围 + 测试说明

### CI（GitHub Actions）

```
push / PR →
  ├── python-test：uv sync → unittest
  ├── typescript-check：tsc --noEmit (server + front)
  └── front-build：npm run build
```

不做 Docker build（已去容器化）。

### Test

- Python：`uv run python -m unittest discover`，现有用例保持
- Node：暂不要求单元测试（server 为薄转发层，核心逻辑在 engine），优先端到端验证
- 禁止 mock 整个系统只为测一个单元——那是分解问题，重构边界

### Tag

PR 合并到 `main` 后自动打 tag：

- CI 根据合并的 PR label 决定 bump 级别：
  - `patch` → v1.0.0 → v1.0.1（Bug fix）
  - `minor` → v1.0.0 → v1.1.0（Feature）
  - `major` → v1.0.0 → v2.0.0（Breaking）
- 无 label 时默认 `patch`
- 同步更新根 `package.json` 和 `pyproject.toml` 版本号
- tag 格式：`v{major}.{minor}.{patch}`，附带 release notes（从 PR 描述自动生成）

openclaw 可通过 `git tag --sort=-v:refname` 快速判断当前版本。

### Publish

```bash
# CLI 包发布到 npm
cd packages/cli && npm publish

# Python 引擎发布到 PyPI（如有需要）
uv build && uv publish
```

手动触发，不走 CI 自动发布。

---

## 不迁移的内容

| 内容 | 原因 |
|------|------|
| `audiomass-editor/` | 体积大，作为可选扩展 |
| `server/audio-editor/` | 同上 |
| `Dockerfile*` `docker-compose*` | 去容器化 |
| 34 个 `.bat`/`.sh` | CLI 替代 |
| `package-lock.json` | 重新生成 |
