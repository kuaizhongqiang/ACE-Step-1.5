# DESIGN.md 最终审核意见

> 所有之前报告的问题已修正。本轮发现的 6 个问题全部是 engine `.mjs`→`.ts` 转换后的残留引用。

---

## 🔴 残留引用（6 个，全部同一根因）

engine 从 `.mjs` 改为 `.ts` 后，以下位置的引用未更新：

### 1. Section 5.1 — 拆分图仍写 `.mjs`

**Line 584-601**：
```
packages/engine/src/acestep.mjs（原 991 行）拆分为：  ← 应为 .ts
  index.mjs         # barrel export                 ← 应为 index.ts
  params.mjs        # ...                           ← 应为 params.ts
  client.mjs        # ...                           ← 应为 client.ts
  python.mjs        # ...                           ← 应为 python.ts
  model.mjs         # ...                           ← 应为 model.ts
  queue.mjs         # ...                           ← 应为 queue.ts
```
6 个文件名全部需改为 `.ts`。

### 2. Section 5.5 — 验证命令写 `client.mjs`

**Line 694**：
```bash
node packages/engine/src/client.mjs --prompt "..."
```
应为：
```bash
npx tsx packages/engine/src/client.ts --prompt "..."
```

### 3. Section 9.2 — M2 验收标准引用了 M3 命令

**Line 926**：
```
M2 | `node cli.mjs generate` 输出音频
```
`generate` 是 M3 命令。M2 应改为：
```
M2 | Python Gradio :7860 + Express :3001 启动，API 生成请求成功返回
```

### 4. 附录 A M2 表格 — 文件名 `.mjs`

**Line 1000**：`packages/engine/src/acestep.mjs` → `acestep.ts`

### 5. 附录 C 风险表 — 过时描述

**Line 1070**：
```
engine 是 .mjs 无类型声明，shared 中的类型靠手动保持同步
```
应为：
```
engine 是 .ts，同时使用自身内部类型和 @acestep/shared 类型，需保持同步
```

### 6. Section 8.1 CI — 注释过时

**Line 873 注释**：`不尝试 tsc 扫描 engine/cli` — 实际 CI 已包含 `packages/engine/tsconfig.json` 的 tsc 扫描（line 869）。
应为：`拆出独立的 javascript-check job 来验证 cli .mjs 文件`

---

## 补充：Section 4.2 批次验证说明

**Line 500**：`tsc --noEmit（仅 server + front + shared）` — engine 现在也有 tsc，应为：`tsc --noEmit（engine + server + front + shared）`。

---

## 总结

| 类别 | 数量 | 位置 |
|------|------|------|
| engine 文件名 `.mjs`→`.ts` | 7 处 | §5.1 (6 处) + §A M2 (1 处) |
| 命令路径 `.mjs`→`.ts` | 1 处 | §5.5 |
| M2 验收引 M3 命令 | 1 处 | §9.2 |
| 描述过时 | 3 处 | §4.2 + §8.1 注释 + §C |

**均为文本替换问题，无架构级缺陷。修正后即可通过。**
