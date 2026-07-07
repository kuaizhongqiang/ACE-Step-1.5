# @acestep/server

> Express API 服务 — 音乐生成、歌曲库管理、DeepSeek 文本增强

## 职责

`@acestep/server` 是 ACE-Step 的中间层 API 服务：

- **音乐生成 API** — 接收前端请求，编排 Python 引擎调用
- **歌曲库管理** — SQLite 存储歌曲元数据，CRUD + 搜索
- **播放列表** — 创建、编辑、管理播放列表
- **DeepSeek 集成** — 调用 DeepSeek API 进行文本增强（丰富歌词、优化 prompt）

## 依赖

| 依赖 | 用途 |
|------|------|
| `@acestep/engine` | Python 引擎通信 |
| `express` | HTTP 框架 |
| `better-sqlite3` | 嵌入式数据库 |
| `jsonwebtoken` | JWT 认证 |
| `multer` | 文件上传 |
| `helmet` | 安全头 |

## 结构

```
src/
├── index.ts        # Express 应用入口
├── routes/         # API 路由模块
├── db/             # SQLite 数据库层
└── middleware/      # 中间件
```

## API 路由

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/songs` | GET/POST | 歌曲列表/创建 |
| `/api/songs/:id` | GET/PUT/DELETE | 歌曲详情/更新/删除 |
| `/api/generate` | POST | 音乐生成 |
| `/api/playlists` | GET/POST | 播放列表 |
| `/api/search` | GET | 搜索 |
| `/api/health` | GET | 健康检查 |
| `/audio/:id` | GET | 音频文件 |

## 开发

```bash
# 启动开发模式（热重载）
npm run dev -w packages/server

# 类型检查
npm run typecheck -w packages/server

# 数据库迁移
npm run db:migrate -w packages/server
```
