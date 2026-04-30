# LuxiBlog — Codex 工作约定

## 0. 核心规则（最高优先级）

- 每次代码改动完成后必须写日志（详见 §1）  
- 未经允许不要修改代码  
- 不要自动执行 git push / reset / rebase  
- 不要删除文章、图片、配置文件  
- 不要改变页面视觉风格  

---

## 1. 日志规范（强制）

### 日志文件

- 绝对路径：`/Users/zhangluxi/Documents/Vibe coding/zlxamx.github.io/logs/YYYY-MM-DD.md`
- 无论当前工作目录是主仓库还是 worktree，都写入此路径
- 不存在必须创建
- 只能写入当天文件

### 日志格式
[HH:mm] 动作 + 对象

### 示例
[15:30] 修改 login.ts 鉴权逻辑
[15:32] 删除 utils/old-helper.ts
[15:40] 新增 API /api/user/profile

### 规则

- 每次操作必须写一条日志  
- 必须具体（禁止“优化了一些代码”）  
- 多文件修改必须拆分多条  
- 操作失败也必须记录  
- 每完成一个操作 → 立即写日志 → 再继续下一个  

---

## 2. 修改策略

### 原则

- 保持现有功能不变  
- 优先低风险优化：
  - 删除未使用 import
  - 删除无用变量
  - 清理重复代码
  - 改善命名
  - 简化结构  

### 限制

- 每次最多修改 5 个文件  
- 修改前必须说明计划  
- 修改后必须总结改动  
- 不自动提交 git（除非我要求）  

---

## 3. 项目结构约定

- `layouts/_default/`：页面模板  
- `layouts/partials/`：公用组件  
- `assets/css/custom.css`：博客通用自定义样式  
- `assets/css/colors/cactus.css`：配色源  
- `assets/css/dialectics.css`：辩证问答页 (`/dialectics/`) 专用样式，独立 token 系统，**不受 §3 §4 通用规则约束**  
- `assets/img/`：图片资源  
- `content/post/`：文章（禁止删除）  
- `themes/typo/`：只读，不修改  

---

## 4. 样式硬规则（禁止破坏）

### 宽度

- `--main-width: 50rem`（全站）
- `--reading-width: 42rem`（文章）
- ❌ 禁止修改 body max-width
- ✅ 需要变窄 → 在内部容器控制

### 颜色

- 主色：`--accent: light-dark(#d44375, #2bbc8a)`
- 所有强调必须用 `var(--accent)`
- ❌ 禁止新增强调色
- 例外：辩证问答页 (`/dialectics/`) 使用独立强调色 `#c8694a`（Claude 橙）/ 暗色复用 `#2bbc8a`

### 背景

- 浅色：#ffffff  
- 深色：#1d1f21  

---

## 5. 工作流程

### 修改后必须做

- 运行：`hugo --quiet`
- 确认无构建错误
- 视觉改动必须预览检查

---

## 6. 提交规范（仅在我要求时）

- 格式：`type(scope): 描述`
  - type：feat / fix / style / refactor / docs
- 添加：Co-Authored-By: Codex <model> noreply@anthropic.com

---

## 6.5. Push 规范（已获授权，可自动执行）

- 每次 push 前必须先执行 `git pull --rebase origin master`
- 确保 fast-forward，避免与用户本地提交产生分叉
- push 完成后写日志记录

---

## 7. 红线（禁止操作）

- 不要 git reset / rebase（push 前的 pull --rebase 除外）  
- 不要改 `.env` / `hugo.toml` 核心配置  
- 不要改 `themes/typo/`  
- 不要删除 `content/post/`  

