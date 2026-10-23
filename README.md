# Podium 本地复刻

以 [podium.global](https://podium.global/) 原站为主要参考，在 Next.js 16 / React 19 中重新实现。用户提供的录屏作为补充参考。

## 已实现

- 首页 WebGL 视频拼贴、原始 GLSL 形变、鼠标扰动与滚动过渡。
- 作品网格与 List 切换、悬停视频、光晕、卡片放大和页面转场。
- About 线框交互、带惯性拖动的幕后轮播、服务展示、页尾石块模型及拖动旋转。
- 联系面板、邮箱复制反馈、手机菜单与响应式排版。
- 10 个项目详情页，包含原站文案、媒体布局、视频控制、图片放大和下一项目跳转。

## 运行

使用 Node.js 26.12.1 / npm 11.20：

```sh
nvm use
npm ci
npm run dev
```

默认打开 [本地预览](http://127.0.0.1:3000/)。如果 3000 已被占用，开发服务会自动使用 3001；仍被占用则继续尝试后续端口，以终端显示的地址为准。直接使用 `npm run dev`，不要追加 `--port 3000` 或设置 `PORT`，否则 Next.js 会将其视为必须使用的固定端口。

生产版本使用 `npm run build` 后执行 `npm start`。部署时可设置 `NEXT_PUBLIC_SITE_URL` 为正式地址，供分享元数据使用。

```sh
npm run lint
npm run typecheck
npm run build
```

## 文件位置

- `src/components/home-experience.tsx`：首页与作品交互。
- `src/components/podium-scene.tsx`、`worldwide-scene.tsx`：WebGL、线框、模型与动画。
- `src/components/studio-shell.tsx`：导航、联系面板与全站转场。
- `src/components/project-detail.tsx`、`project-video.tsx`：项目页和播放器。
- `src/data/`：原站公开内容与媒体映射。
- `public/media/`、`public/models/`、`public/textures/`：本地媒体和模型。
- `.clone-ui/`：原站采集、录屏参考帧、视觉对照和验收记录。

## 验收与资源来源

已在 1440、768、375 宽度核对，执行代码检查、类型检查及生产构建。已验证作品切换、联系面板、视频播放/暂停/静音/进度、图片放大、项目导航与返回首页。

页面使用原站公开媒体、SVG、GLB、KTX2 和视觉样式，交互以 React / Three.js / GSAP / Lenis 重建。未执行下载的原站 JavaScript，也未接入原站分析追踪。

字体仍从原站加载，完整影片仍由原站 Mux 地址提供，需要联网；海报、预览片段及模型已保存在本地。原站资源和设计的权利归原权利人，本项目用于本地参考；公开发布需具备相应授权。

动态画面会受视频时间、鼠标位置和设备性能影响；已实现并核对主要交互，不将所有设备、所有时刻的逐像素一致视为已经验证。
