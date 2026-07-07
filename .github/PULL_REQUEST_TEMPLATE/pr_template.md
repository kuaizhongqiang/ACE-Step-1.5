---
name: Pull Request
about: 提交代码变更
---

## 概要

<!-- 简要描述这个 PR 做了什么、为什么。 -->

Closes #(issue)

## 关联 Milestone

<!-- 这个 PR 属于哪个 Milestone？如 M2: 功能就绪 -->

## 变更类型

- [ ] **feat** — 新功能
- [ ] **fix** — Bug 修复
- [ ] **chore** — 维护 / 依赖更新
- [ ] **docs** — 文档
- [ ] **refactor** — 重构（无功能变化）
- [ ] **perf** — 性能优化
- [ ] **ci** — CI/CD
- [ ] **test** — 测试

## 影响范围

<!-- 说明影响了哪些包。 -->

- [ ] `@acestep/shared`
- [ ] `@acestep/engine`
- [ ] `@acestep/server`
- [ ] `@acestep/front`
- [ ] `@acestep/cli`
- [ ] `acestep/` (Python)
- [ ] `docs/`

## 测试说明

- [ ] Python unittest 通过
- [ ] TypeScript 类型检查通过（`npm run typecheck`）
- [ ] 前端构建通过（`npm run build`）
- [ ] 端到端验证通过

## 跨平台影响

<!-- 是否影响多平台路径？ -->
- [ ] CUDA (Windows/Linux)
- [ ] MPS (macOS Apple Silicon)
- [ ] MLX (macOS Apple Silicon)
- [ ] CPU
- [ ] 不涉及

## 版本 Bump

<!-- 这个 PR 应该 bump 哪个级别？不打 label 时默认 patch。 -->
- [ ] `patch`（Bug fix）
- [ ] `minor`（New feature）
- [ ] `major`（Breaking change）
