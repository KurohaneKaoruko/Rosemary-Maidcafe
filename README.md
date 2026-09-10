# 🌿 Rosemary MaidCafe

一款基于 Next.js + React + Tauri 2 的模拟经营女仆咖啡厅游戏。

> **本仓库是从 `Rosemary-Maidcafe-NextJS`（Web 版）与 `Rosemary-Maidcafe-Tauri`（Tauri 桌面版）合并而来的 monorepo**。两份代码历史上分别维护，已漂移；本仓库以 Tauri 版本为基底，统一为单一份代码 + 双目标部署（Vercel 网页 + Tauri 桌面）。

## 🏗️ 仓库结构（pnpm workspaces）

```
.
├── apps/
│   ├── web/                    # Next.js 应用（部署到 Vercel）
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router
│   │   │   ├── components/     # UI 组件（cafe/game/modals/panels/ui）
│   │   │   ├── data/           # 静态数据（女仆/事件/菜单/任务…）
│   │   │   ├── hooks/          # React hooks
│   │   │   ├── systems/        # 游戏系统逻辑
│   │   │   ├── types/          # TS 类型
│   │   │   ├── utils/          # 工具函数
│   │   │   └── __tests__/      # 集成测试
│   │   ├── assets/maid-image/  # 144 张女仆图片（31 MB）
│   │   ├── public/             # Next.js 静态资源
│   │   ├── next.config.mjs     # 双目标配置（Vercel SSR / Tauri 静态导出）
│   │   ├── vitest.config.ts    # 单元/集成测试
│   │   └── vercel.json         # Vercel 部署配置
│   │
│   └── desktop/                # Tauri 桌面壳
│       ├── src-tauri/          # Rust + Tauri 配置
│       │   ├── src/{main.rs, secure_save.rs, staffing_sim.rs}
│       │   ├── Cargo.toml / Cargo.lock
│       │   ├── tauri.conf.json # 关键路径已指向 apps/web/dist
│       │   ├── capabilities/   # 权限声明
│       │   └── icons/          # 应用图标
│       └── scripts/            # 构建辅助（maid manifest、release、icons）
│
├── package.json                # workspaces 根（pnpm scripts 聚合）
├── pnpm-workspace.yaml
└── progress.md                 # 项目历史
```

## ✨ 特性

- 🎀 **女仆养成** — 雇佣性格各异的女仆，培养技能、分配岗位
- ☕ **顾客服务** — 普通顾客 / VIP / 评论家，解锁好评奖励
- 🎯 **任务系统** — 每日任务与成长任务双线
- 📋 **菜单经营** — 30+ 饮品甜点、自定义定价
- 🏠 **设施升级** — 扩张店面、装饰、解锁新区域
- 🎲 **随机事件** — AI 叙事事件 + 内置事件 fallback
- 🏆 **成就系统** — 20+ 成就、丰厚奖励
- 🎵 **音频系统** — WebAudio 内置 BGM / 音效
- 💾 **本地存档** — localStorage（含校验），支持导入导出
- 🌐 **i18n** — 多语言切换
- 🖥️ **桌面端** — Tauri 2 打包，Rust 后端（含 secure_save 加密、staffing 模拟、staffing_sim 性能密集计算）

## 📋 环境要求

| 用途 | 要求 |
| --- | --- |
| 仅 Web 开发 | Node.js 20+、pnpm 9+ |
| 桌面打包 | 上面的 + Rust toolchain（cargo 1.57+）、平台构建工具（Windows: MSVC，macOS: Xcode CLT，Linux: webkit2gtk-4.1 等） |

## 🚀 开发

### 安装依赖

```bash
pnpm install
```

### 仅 Web（Vercel 风格 SSR 开发）

```bash
pnpm web:dev          # http://localhost:3527
pnpm web:lint
pnpm web:test
pnpm web:build        # Vercel 兼容的 SSR/SSG 构建
```

### 仅桌面（Tauri 窗口）

```bash
pnpm desktop:dev      # 启动 Rust + Tauri 壳，自动拉起 web 子包 dev server
pnpm desktop:build    # 构建安装包（产物在 apps/desktop/src-tauri/target/release/bundle/）
```

桌面 `tauri build` 会自动跑 `pnpm --filter @rosemary/web build` 并设置 `TAURI_BUILD=true`，使 Next.js 走 `output: "export"` + `distDir: "./dist"`，产物落在 `apps/web/dist/`，再被 Tauri 包装进桌面应用。

### 跨子包组合命令

| 目标 | 命令 |
| --- | --- |
| 跑 web 测试 | `pnpm web:test` |
| 跑 web lint | `pnpm web:lint` |
| 桌面打包 | `pnpm desktop:build` |
| 桌面打包 dry-run | `pnpm desktop:build` 后跑 `pnpm release:dry-run` |
| 升级版本号（统一更新根 package.json / tauri.conf.json / Cargo.toml） | `pnpm release -- 0.2.0` 或 `pnpm release -- patch` |

## 🌐 部署到 Vercel

1. 在 Vercel 控制台导入 `KurohaneKaoruko/Rosemary-Maidcafe` 仓库
2. Root Directory 设为 `apps/web`
3. Vercel 会读 `apps/web/vercel.json`，自动用 `pnpm install --frozen-lockfile` 安装、`pnpm --filter @rosemary/web build` 构建
4. **Vercel 跑构建时 `TAURI_BUILD` 未设置**，所以走标准 Next.js SSR 构建——与桌面构建互不干扰

## 🖥️ 桌面打包产物位置

构建后产物位置（依据平台不同而不同）：

- Windows: `apps/desktop/src-tauri/target/release/bundle/{msi,nsis}/`
- macOS:   `apps/desktop/src-tauri/target/release/bundle/{dmg,macos}/`
- Linux:   `apps/desktop/src-tauri/target/release/bundle/{deb,appimage,rpm}/`

## 🔄 从旧仓库迁移过来的变更

- 旧仓库 `Rosemary-Maidcafe-NextJS` 的 Web 应用 与 `Rosemary-Maidcafe-Tauri` 的桌面版已经合并
- **代码以 Tauri 版为基底**（commit `refactor/monorepo-web-desktop` 之前的历史），后续更新都进本仓库
- Tauri 仓库旧的 `src-next/` 已经全部迁到 `apps/web/src/`
- 包管理器从 npm 切换到 **pnpm + workspaces**
- 引入 vitest 配置（来自原 Web 仓库），i18n、guide 系统的源码（在原 Web 仓库中独有）一并迁入

## 📜 历史

详见 `progress.md`。

## 当前桌面应用元信息

- Product Name: `Rosemary MaidCafe`
- Binary Name: `rosemary-maidcafe`
- Identifier: `com.rosemary.maidcafe`
- Window Title: `迷迭香咖啡厅`
