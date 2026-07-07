/**
 * Help text generator
 */
import output from './output.mjs';

export default function help(cmd) {
  const HELP = {
    default: `
ACE-Step 1.5 CLI — 本地 AI 音乐生成管理工具

用法: acestep <command> [options]

命令:
  入门
    help [command]        显示帮助信息
    version               显示版本号
    info                  项目信息概览
    env                   环境变量（脱敏）

  配置
    config [--section]    配置查看 / config set KEY VALUE

  服务
    start [server|engine] 后台启动服务
    stop [server|engine]  优雅关闭服务
    restart               重启服务
    status                服务运行状态
    health                健康检查
    dev                   开发模式（engine + server + front 同时启动）

  模型
    model list            列出可用模型
    model switch <name>   切换当前模型
    model download [name] 下载模型

  生成
    generate "描述"       生成音乐
    install               首次安装（依赖 + 模型）

  数据
    list                  列出资源 (styles/songs/jobs/users/playlists)
    logs [-n N] [-f]      查看日志

  构建/清理
    build                 构建前端生产包
    cleanup [audio|logs]  清理临时文件

选项:
  --json                 JSON 输出模式
  --help, -h             显示帮助

示例:
  acestep start engine             启动 Python 引擎
  acestep start                    启动 Express 服务
  acestep model list               列出可用模型
  acestep generate "流行歌曲"      生成音乐
`,
    install: `
acestep install [--skip-models]

首次安装环境：
  1. uv sync — 安装 Python 依赖
  2. npm install — 安装 Node.js 依赖
  3. acestep-download — 下载模型

选项:
  --skip-models         跳过模型下载

示例:
  acestep install                  完整安装
  acestep install --skip-models    仅安装依赖
`,
    model: `
acestep model <list|switch|download> [name]

模型管理:
  list                  列出可用模型
  switch <name>         切换当前模型
  download [name]       下载模型

示例:
  acestep model list
  acestep model switch acestep-v15-turbo
  acestep model download acestep-v15-xl-base
`,
    generate: `
acestep generate "描述" [--style pop] [--duration 30] [--lyrics "歌词"]

从命令行生成音乐。

参数:
  "描述"                音乐描述（必填）
  --style <风格>        音乐风格 (默认: pop)
  --duration <秒>       生成时长 (默认: 30)
  --lyrics "歌词"       歌词文本
  --instrumental        纯音乐（无歌词）
  --bpm <数字>          BPM
  --key <调式>          调式

示例:
  acestep generate "轻快的电子音乐" --style electronic --duration 60
  acestep generate "钢琴抒情曲" --lyrics "月色洒满窗台" --bpm 80
`,
    build: `
acestep build

构建前端生产包 (Vite build)。

示例:
  acestep build
`,
    cleanup: `
acestep cleanup [audio|logs|cache] [--age <天>]

清理临时文件和过期数据。

子命令:
  (无)                 清理全部
  audio                清理过期音频文件
  logs                 清理日志文件
  cache                清理缓存

选项:
  --age <天>           音频过期天数 (默认: 7)

示例:
  acestep cleanup                 清理全部
  acestep cleanup audio --age 30  清理30天前的音频
  acestep cleanup logs            清理日志
`,
    dev: `
acestep dev [--engine-port 7860] [--server-port 3001] [--front-port 3000]

开发模式 — 同时启动引擎、服务、前端。

选项:
  --engine-port <端口>  Python 引擎端口 (默认: 7860)
  --server-port <端口>  Express 端口 (默认: 3001)
  --front-port <端口>   Vite 端口 (默认: 3000)
`,
    start: `
acestep start [server|engine] [--port <端口>] [--foreground]

启动服务。

子命令:
  server               启动 Express 服务 (默认)
  engine               启动 Python 引擎

选项:
  --port <端口>        指定端口
  --foreground         前台运行

示例:
  acestep start                    启动 Express
  acestep start engine             启动 Python 引擎
  acestep start --port 8080        指定端口
`,
    stop: `
acestep stop [server|engine] [--force] [--timeout <毫秒>]

停止服务。

子命令:
  server               停止 Express 服务 (默认)
  engine               停止 Python 引擎

选项:
  --force              强制停止
  --timeout <毫秒>     等待超时 (默认: 10000)
`,
  };

  const text = HELP[cmd] || `未知命令: ${cmd}。运行 'acestep help' 查看可用命令。\n`;
  output.print(text);
  output.exit(0);
}
