# 图片长边缩放工具

> 由 **洋洋制作** 精心打造 · Image Resizer 2048

一个纯前端的图片批量处理工具，将图片长边统一缩放为 2048 像素，保持宽高比，全程本地处理不上传云端。基于 MozJPEG + Lanczos3 + 线性光空间的 WASM 全链路专业画质管线。

## 功能特性

- 🖼️ **批量处理**：支持拖入单张图片或整个文件夹，批量处理所有 JPG/PNG/WebP 格式图片
- 📐 **智能缩放**：长边自动调整为 2048px，短边按比例等比缩放，不拉伸不变形；长边已 ≤2048px 的图片自动跳过、不放大
- ✨ **专业画质**：
  - 优先使用 jSquash WASM 引擎（MozJPEG + Lanczos3 + 线性光空间 + alpha 预乘）
  - 回退 Canvas 线性光 + 多步降采样 + 阈值 USM 锐化
  - 完全绕过 Canvas 8bit gamma 空间限制，暗部不发灰、渐变无色带
- 🎨 **双画质模式**：标准模式（保持原格式，MozJPEG Q=95 + progressive）+ 极致保真模式（WebP Lossless 无损输出，像素级零编码损失，比 PNG 小约 26%）
- 📊 **实时对比**：显示每张图处理前后的尺寸、文件大小与体积变化
- 💾 **灵活下载**：支持单张下载和全部打包下载（ZIP）
- 🛡️ **隐私安全**：纯前端本地处理，图片不上传服务器

## 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 8
- **样式**: Tailwind CSS 4
- **图像处理**:
  - jSquash WASM 引擎（MozJPEG / PNG / WebP 编解码 + Lanczos3 缩放）
  - Canvas API（回退管线）
- **UI 组件**: shadcn/ui + Framer Motion
- **图标**: Lucide React
- **打包下载**: JSZip

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（访问 http://localhost:5173）
npm run dev

# 生产构建（输出到 dist/）
npm run build

# 本地预览构建结果
npm run preview
```

## 项目结构

```
image-resizer-2048/
├── public/                      # 静态资源
│   └── favicon.svg
├── src/
│   ├── components/              # 共享组件
│   │   ├── ui/                  # shadcn/ui 组件库
│   │   │   ├── button.tsx
│   │   │   ├── badge.tsx
│   │   │   └── image.tsx
│   │   └── Layout.tsx
│   ├── data/
│   │   └── image.ts             # 类型定义和常量
│   ├── lib/                     # 工具函数和核心算法
│   │   ├── imageProcessor.ts    # 图像处理主逻辑（双管线）
│   │   ├── jsquashEngine.ts     # jSquash WASM 引擎封装
│   │   ├── logger.ts            # 日志工具
│   │   └── utils.ts             # 通用工具（cn 等）
│   ├── pages/
│   │   ├── ImageResizerPage/
│   │   │   ├── ImageResizerPage.tsx
│   │   │   └── sections/        # 页面内各区块
│   │   └── NotFoundPage/
│   ├── app.tsx                  # 应用入口组件
│   ├── main.tsx                 # React 入口
│   ├── index.css                # 全局样式
│   └── tailwind-theme.css       # Tailwind 主题配置
├── .github/workflows/deploy.yml # GitHub Actions 部署配置
├── index.html
├── vite.config.ts
├── postcss.config.js
├── tsconfig.json
└── package.json
```

## 核心算法说明

### 双画质管线

**管线 A（优先）：jSquash WASM 引擎**
- 解码：MozJPEG / rust-png / libwebp 专业级解码器
- 缩放：Lanczos3 三瓣核 + 线性光空间处理 + alpha 预乘（透明图无黑边）
- 编码：MozJPEG Q=95 progressive JPEG，PNG 无损，WebP 高质量
- 完全绕过 Canvas 的 8bit gamma 空间限制

**管线 B（回退）：Canvas 线性光 + 多步降采样**
- sRGB → 线性光 → 多步降采样 → sRGB（gamma 完全正确）
- 每步 ≤50%，多步逼近 Lanczos 级质量
- 带阈值 USM 锐化（Adobe 推荐参数），保护平滑区域不放大噪点

### 画质模式

- **标准画质**：JPEG Q=95 / WebP Q=95，保持原格式
- **无损画质**：输出 WebP Lossless，缩放结果像素级零损失，不锐化
- **小图保护**：长边已 ≤ 2048px 的图片直接跳过，不放大

## 部署到 GitHub Pages

### 方法一：GitHub Actions 自动部署（推荐）

仓库中已包含 `.github/workflows/deploy.yml`，只需：

1. 推送代码到 `main` 分支
2. 进入仓库 Settings → Pages
3. 在 "Build and deployment" 中选择 "GitHub Actions" 作为来源
4. 等待 Actions 执行完成后即可访问

### 方法二：手动部署

```bash
# 构建
npm run build

# 安装 gh-pages 工具
npm install -g gh-pages

# 部署
gh-pages -d dist
```

### 注意事项

- `vite.config.ts` 中已配置 `base: './'`，支持任意子路径部署
- WASM 文件通过 Vite 自动处理，构建时会输出到 `dist/assets/` 目录

## 浏览器兼容性

支持所有现代浏览器：Chrome / Edge（推荐）、Firefox、Safari 及其他 Chromium 内核浏览器。
最低要求：支持 `createImageBitmap`、`WebAssembly`、`Canvas` 的现代浏览器。

## License

本项目采用 **PolyForm Noncommercial License 1.0.0**（非商业源码许可）：可查看、可分析、可用于个人研究学习；禁止商用与商用 AI 训练。详见 [LICENSE](./LICENSE)。
