/**
 * Help text generator
 */
import output from './output.mjs';

export default function help(cmd) {
  const HELP = {
    default: `
ACE-Step UI CLI — Local AI Music Generator Management Tool

Usage: node server/cli.mjs <command> [options]

Commands:
  L1 — 入门命令
    help [command]        显示帮助信息
    version               显示版本号
    info                  项目信息概览
    env                   环境变量（脱敏）

  L2 — 查询命令
    config [--section]    配置查看 / config set KEY VALUE
    status                服务运行状态
    health                健康检查（Server / DB / Gradio）
    list                  列出资源 (styles/models/songs/jobs/users/playlists)

  L3 — 控制命令
    dev                   开发模式（前端 + 后端）
    start [--port]        后台启动
    stop [--force]        优雅关闭
    restart               重启
    generate              音频生成

  L4 — 运维命令
    logs [-n N] [-f]      查看日志
    build [--watch]       构建前端
    cleanup [--dry-run]   清理孤立文件

Options:
  --json                 JSON 输出模式
  --help, -h             显示帮助

Examples:
  node server/cli.mjs start --port 3001
  node server/cli.mjs status --json
  node server/cli.mjs logs -f --level error
`,
  };

  const text = HELP[cmd] || `Unknown command: ${cmd}. Run 'node server/cli.mjs help' for available commands.`;
  output.print(text);
  output.exit(0);
}
