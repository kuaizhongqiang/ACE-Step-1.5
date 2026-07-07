# @acestep/cli

> ACE-Step CLI 管理工具 — 统一管理 Python 引擎和 Node.js 服务

## 职责

`@acestep/cli` 是 ACE-Step 的命令行入口，负责：

- **服务管理** — 启动、停止、重启 Python 引擎和 Express 服务
- **进程监控** — 查看运行状态、健康检查、日志查看
- **音乐生成** — 命令行直接生成音乐
- **配置管理** — 查看和修改项目配置
- **环境安装** — 一键安装 Python 和 Node.js 依赖

## 依赖

| 依赖 | 用途 |
|------|------|
| `@acestep/engine` | Python 引擎通信（健康检查） |

## 安装

```bash
# 全局安装（从 npm）
npm install -g @acestep/cli

# 或本地 link 开发
cd packages/cli && npm link
```

## 使用

```bash
# 帮助
acestep help

# 一键启动全部服务
acestep start

# 启动 Python 引擎
acestep start engine

# 启动 Express 服务
acestep start server

# 停止所有服务
acestep stop

# 查看状态
acestep status

# 健康检查
acestep health

# 实时日志
acestep logs -f

# 查看配置
acestep config

# 列出音乐风格
acestep list styles

# CLI 生成音乐
acestep generate "欢快的爵士乐"

# 环境安装（Python + Node.js 依赖）
acestep install

# 清理缓存
acestep clean
```

## 结构

```
src/
├── cli.mjs         # CLI 入口（纯 .mjs，零编译）
└── ...
```

## 开发

```bash
# 语法检查（无需编译）
node --check packages/cli/src/cli.mjs

# 本地测试
node packages/cli/src/cli.mjs help
```
