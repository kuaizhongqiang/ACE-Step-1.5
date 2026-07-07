# @acestep/engine

> Python 引擎通信层 — 封装 Gradio client，提供 TypeScript 调用接口

## 职责

`@acestep/engine` 是 Node.js 层与 Python 引擎之间的桥梁。通过 Gradio HTTP API 调用本地运行的 Python 引擎，暴露为 TypeScript 函数。

## 依赖

| 依赖 | 用途 |
|------|------|
| `@acestep/shared` | 共享类型 |
| `@gradio/client` | Gradio HTTP API 客户端 |

## 结构

```
src/
├── index.ts        # 统一导出入口
└── ...
```

## 使用

```typescript
import { generateMusic, checkEngineHealth } from '@acestep/engine';

// 健康检查
const status = await checkEngineHealth();

// 生成音乐
const result = await generateMusic({
  caption: '欢快的爵士乐',
  duration: 30,
});
```

## 开发

```bash
# 类型检查
npm run typecheck -w packages/engine
```
