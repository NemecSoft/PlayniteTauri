---
name: change-package-manager
description: Switch PlayniteTauri's package manager between npm, bun and pnpm. Updates package.json scripts, tauri.conf.json, docs and build scripts. Use when changing package managers.
---

# Change Package Manager（切换包管理器）

将 PlayniteTauri 的包管理器在 `npm`、`bun`、`pnpm` 之间切换。当前默认使用 **npm**。

## 命令映射参考

| 场景 | npm | bun | pnpm |
| --- | --- | --- | --- |
| 安装依赖 | `npm install` | `bun install` | `pnpm install` |
| 运行脚本 | `npm run X` | `bun run X` | `pnpm run X` |
| 添加依赖 | `npm install pkg` | `bun add pkg` | `pnpm add pkg` |
| 执行二进制 | `npx` | `bunx` | `pnpm dlx` |
| 锁文件 | `package-lock.json` | `bun.lock` | `pnpm-lock.yaml` |

## 步骤

### 1. 更新 package.json
- 替换 `scripts` 中所有 `npm run X` → 目标 PM 的 `X` 命令
- 更新 `scripts/auto-build.mjs` 中调用包管理器的逻辑

### 2. 更新 tauri.conf.json
- `beforeDevCommand` / `beforeBuildCommand` 中的命令前缀

### 3. 更新构建脚本
- `build.ps1` 中调用 npm 的部分

### 4. 更新文档
- 搜索项目内所有 `npm run` / `npm install` 引用（`README.md`、`docs/`），改为目标 PM

### 5. 锁文件
- 删除旧锁文件，运行目标 PM 的 install 生成新锁文件

## 重要
- 默认推荐 **npm**（当前使用中）
- 若目标 PM 已是当前使用中的，告知用户并停止
- 不要盲目替换 `node_modules/` 引用（所有 PM 共用该目录）
