# Rosemary MaidCafe (Desktop)

将 `rosemary-maidcafe-nextjs` 迁移为 Tauri 桌面端版本（Next.js + React + Tauri 2）。

## 环境要求

- Node.js 20+
- Rust toolchain（含 Cargo）
- Windows 构建工具链（用于打包）

## 安装依赖

```bash
npm install
```

## 女仆图片资源

- 路径：`src-next/assets/maid-image/`
- 这些图片通过静态导入清单接入 `next/image`，用于图片管线优化与懒加载。
- 清单由脚本自动生成，不需要手动维护路径：

```bash
npm run gen:maid-manifest
```

## 应用图标资源

- 当前图标源：`src-next/assets/maid-image/c625.jpg`
- 生成图标命令（覆盖 `src-tauri/icons/*`）：

```bash
python scripts/generate-tauri-icons.py
```

## 开发运行（桌面窗口）

```bash
npm run dev
```

执行后会先启动 Next 开发服务（默认 `http://localhost:3000`），再启动 Tauri 桌面应用。

## 构建前端静态资源

```bash
npm run next:build
```

静态导出目录：`dist/`

## 打包桌面安装包

```bash
npm run build:desktop
```

Windows 产物目录：

- `src-tauri/target/release/bundle/msi/`
- `src-tauri/target/release/bundle/nsis/`

## 当前桌面应用元信息

- Product Name: `Rosemary MaidCafe`
- Binary Name: `rosemary-maidcafe`
- Identifier: `com.rosemary.maidcafe`
- Window Title: `迷迭香咖啡厅`
