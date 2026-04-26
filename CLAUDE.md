# LuxiBlog — Claude 工作约定


## 项目说明

这是我的个人博客代码库，主要用于发布文章、展示个人页面和内容归档。

## 重要原则

1. 不要随意改变页面视觉风格。
2. 不要删除文章内容、图片资源、配置文件。
3. 不要大范围重构，除非我明确要求。
4. 所有修改都应保持现有功能不变。
5. 优先做低风险清理，例如：
   - 删除未使用的 import
   - 删除无用变量
   - 清理重复代码
   - 改善命名
   - 简化组件结构

## 修改限制

1. 每次最多修改 5 个文件。
2. 修改前必须先说明计划。
3. 修改后必须总结改动。
4. 不要自动提交 git，除非我明确要求。

## 常用命令

- 安装依赖：pnpm install
- 本地开发：pnpm dev
- 构建检查：pnpm build
- 代码检查：pnpm lint

## 偏好

代码要简洁、清晰、可维护。
不要为了“高级”而引入复杂抽象。
博客项目以稳定、美观、易维护为第一优先级。

## 项目简介

Hugo 静态博客，主题基于 `typo` + 大量定制。
- 博客地址：https://luxi.blog/
- 仓库部署：GitHub Pages，`master` 分支自动发布
- 本地预览：`hugo server` 或 MCP `Claude_Preview` 实例

## 目录约定

- `layouts/_default/`：页面模板（home、list、single、baseof…）
- `layouts/partials/`：公用片段（header、footer、site-avatar…）
- `assets/css/custom.css`：**唯一**的自定义样式文件，不要拆分
- `assets/css/colors/cactus.css`：调色板，背景/文本色源头
- `assets/img/`：站点插画与头像
- `content/post/`：所有文章（含周刊、letters）
- `themes/typo/`：**不要动**，只能从这里读参考样式，所有覆盖写在 `assets/css/custom.css`

## 全站布局硬规则（不许改）

### 宽度收束

所有页面统一画布宽度：
- `:root { --main-width: 50rem; }` — 全站 body 最大宽度
- `--reading-width: 42rem` — 仅用于单篇文章内部 (`.single-shell.is-post-page`) 保证阅读体验
- **禁止**通过 `body.is-home`、`body.is-writing` 等类覆盖 body `max-width`
- 新页面如需更窄的内容区，在**内部**用 `max-width` 约束，不要改 body

### 主色

- `--accent: light-dark(#d44375, #2bbc8a)` — 浅色粉 / 深色绿
- 所有强调色（标题 highlight、图标、badge、按钮、激活态）都用 `var(--accent)`
- 禁止引入新的强调色

### 背景

- 浅色：`--background-light: #ffffff`（纯白）
- 深色：`--background-dark: #1d1f21`
- 卡片内部可以用柔和的 `light-dark(#fce7ef, #1e2a25)` 变体

## 工作流程

### 改完必须验

- 样式 / 模板改动后跑 `hugo --quiet` 确认无构建错误
- 视觉类改动，用 `mcp__Claude_Preview__preview_*` 工具截图确认

### 提交规范

- 格式：`<type>(<scope>): <中文描述>`（参考 git log 里现有风格）
  - type：`feat` / `fix` / `style` / `refactor` / `docs`
  - scope：`home` / `writing` / `footer` / `hero` / …
- 每次 commit 带 `Co-Authored-By: Claude <model> <noreply@anthropic.com>` 尾签
- 只在用户明确要求时 `git push`

### 红线

- 不要自动 `git push`、`git reset --hard`、`git rebase`
- 不要修改 `.env`、`hugo.toml` 里的 `baseURL` / `theme` / token
- 不要改 `themes/typo/`，所有覆盖只写在 `assets/css/custom.css`
- 不要删除 `content/post/` 下的文章
