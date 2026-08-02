---
name: check
description: Check work for adherence with architecture, run quality checks (TypeScript + Rust), and suggest a commit message. Use after completing work on a feature or bug fix in PlayniteTauri.
---

# Check（完成工作后的质量检查）

在 PlayniteTauri 中完成某个功能或修复后运行，确保代码质量与架构一致。

## 执行步骤

### 1. 检查架构一致性
对照 `AGENTS.md` 与 `docs/` 设计文档，检查本次改动是否符合既有模式：
- 前端：状态管理遵循 `Zustand`（games/settings/library store），UI 组件在 `src/components/`
- 国际化：所有 UI 文本通过 `useI18n().t()` 翻译，新增文案需同步三个语言文件（`src/i18n/locales/{en,zh-CN,zh-TW}.ts`）
- 主题：颜色用 CSS 变量（`--accent`、`--bg-*` 等），不硬编码
- 后端：数据访问走 `db.rs`，命令在 `commands/`，新字段需在 `models.rs` + `types/models.ts` 同步
- 多名称 / 拼音搜索：搜索相关改动检查 `src/utils/search.ts`

### 2. 清理开发残留
- 移除多余的 `console.log` 或调试注释
- 清理无用的 import
- 移除"尝试过但没用的代码"

### 3. 运行质量检查
```bash
# 前端 TypeScript 类型检查
npm run build

# 后端编译检查
cd src-tauri && cargo check
```

修复所有错误。

### 4. 生成构建（绿色 exe）
```bash
.\build.ps1          # 或使用自动构建
```

### 5. 建议提交信息
参考本次改动，给出简洁的 conventional commit 建议，例如：
`feat: 新增登录界面` / `fix: 修复任务栏重复图标` / `docs: 更新设计文档`。

## 重要
- 检查后若修改了数据模型或新增功能，**必须同步更新 `docs/` 设计文档**（见 `docs/CONTRIBUTING.md` 约定）
- 不要在用户未要求时提交（commit/push）
