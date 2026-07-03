# ACE-Step 1.5 - GitHub Copilot Instructions

## Project Overview

ACE-Step 1.5 是一个开源 AI 音乐生成系统，基于 5Hz Language Model + Diffusion Transformer。

## Tech Stack

- **Python 3.11-3.12** / **PyTorch 2.7+** / **Gradio 6.2** / **FastAPI** / **uv**
- **Node.js ≥ 18** / **TypeScript** / **Express 4** / **React 19** / **Vite 6** / **TailwindCSS 3**
- **SQLite** (better-sqlite3) / **npm workspaces** monorepo

## 4 包架构

```
packages/
├── engine/    # 核心：音频生成 + LLM + 模型管理 + 任务队列
├── server/    # 薄层：Express 路由 + JWT 鉴权 + SQLite
├── cli/       # 全局大脑：进程管理 + 命令行 + 状态查询
└── front/     # 纯展示：React 组件 + i18n（中文优先）
```

## Multi-Platform Support

**CRITICAL**: 支持 CUDA / ROCm / XPU / MPS / MLX / CPU。
- **不可修改非目标平台路径**
- CUDA 代码改动不能破坏 MPS/CPU/MLX 路径
- 使用 `gpu_config.py` 进行硬件检测

## Key Conventions

- **Python**: PEP 8, 4 spaces, double quotes, loguru logger
- **TypeScript**: 从 engine 引用类型定义，不在多处重复
- **中文优先**: 文档 / CLI 输出 / 前端默认语言为中文
- **功能只增不减**: 迁移改造必须保持所有现有功能

## Resources

- **CODEBUDDY.md** — AI Agent 全栈指南
- **AGENTS.md** — Python 开发规范
- **docs/MIGRATION_PLAN.md** — 迁移方案与里程碑
