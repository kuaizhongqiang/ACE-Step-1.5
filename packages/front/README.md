# @acestep/front

> React 前端 — 音乐生成界面、播放器、歌曲库

## 职责

`@acestep/front` 是 ACE-Step 的 Web 前端，提供完整的音乐生成和管理的用户界面：

- **音乐生成** — 文本输入 → AI 音乐生成，实时进度展示
- **音频播放器** — 播放、暂停、波形可视化
- **歌曲库** — 浏览、搜索、筛选已生成的歌曲
- **播放列表** — 创建和管理播放列表
- **设置页面** — 模型选择、生成参数配置

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| Vite | 6 | 构建工具 |
| TailwindCSS | 3 | 样式方案 |
| TypeScript | 5.8 | 类型安全 |
| Lucide React | 0.563 | 图标库 |
| @ffmpeg/ffmpeg | 0.12 | 音频处理 |

## 依赖

| 依赖 | 用途 |
|------|------|
| `@acestep/shared` | 共享类型定义 |

## 结构

```
src/
├── main.tsx          # 应用入口
├── App.tsx           # 根组件
├── components/       # UI 组件
│   ├── CreatePanel.tsx     # 音乐生成面板
│   ├── LibraryView.tsx     # 歌曲库视图
│   ├── PlaylistDetail.tsx  # 播放列表详情
│   ├── SongList.tsx        # 歌曲列表
│   ├── SearchPage.tsx      # 搜索页面
│   ├── Player/             # 播放器组件
│   └── ...
├── pages/            # 页面组件
├── hooks/            # 自定义 Hooks
└── types.ts          # 前端专用类型
```

## 开发

```bash
# 启动开发服务器 (:3000)
npm run dev -w packages/front

# 生产构建
npm run build -w packages/front

# 预览生产构建
npm run preview -w packages/front

# 类型检查
npm run typecheck -w packages/front
```
