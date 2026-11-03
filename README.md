# POI / THE MACHINE · DeepSeek Harness

基于 npm workspaces 的 monorepo，包含 2.0.1 启动插件、完整自动测试和 2560×1440 设计稿。目标平台为 macOS DeepSeek Harness。

## 项目来源与致谢


本项目是基于 [6shenhonghong9/dsh-startup-screen](https://github.com/6shenhonghong9/dsh-startup-screen) 的二次开发版本。原作者为沈宏宏。上游项目提供了 DeepSeek Harness 启动插件的基础实现、插件接入方式、设置功能和六段人声素材。本仓库保留上游 MIT 许可证及原作者版权声明。

本次二次开发将启动体验改造为《Person of Interest》（POI / 疑犯追踪）中 The Machine 的视觉风格，采用四个固定静帧镜头、十阶段叙事、两次人工确认，并调整场景布局、HUD、动画、声音生命周期与 macOS 桌面加载逻辑。

其他参考与素材来源：

- **视觉灵感**：《Person of Interest》中的 The Machine、监控画面与身份识别界面；页面布局依据本项目的 `poi.pen` 设计稿。
- **字体**：[Google Fonts](https://github.com/google/fonts) 提供 Michroma、VT323 和 Share Tech Mono，随包保留各字体的 OFL 许可证。
- **人声**：沿用上游 `dsh-startup-screen` 的六段录音，具体来源与使用限制见 [音频说明](AUDIO-FIELDS.md)。

代码许可、字体许可与第三方音视频素材的权利范围分别适用。POI 相关名称与视觉灵感不代表官方关联或授权。

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `packages/dsh-startup-screen/` | 可独立打包的 DSH 插件，包含运行代码、素材、预览工具和测试 |
| `packages/dsh-startup-screen/docs/screenshots/` | POI 界面截图 |
| `design/poi.pen` | Pen 设计稿 |
| `design/poi-assets/` | 设计稿引用的静帧素材 |

根目录仅用于开发编排，设置为 `private`。安装到 DSH 的产物为 `dsh-startup-screen` 包。

## 开发与验证

需要 Node.js >=20。以下命令在仓库根目录执行。

```sh
npm ci
npm run browser:install
npm test
npm run preview
```

预览地址为 `http://127.0.0.1:4173`。`/?desktop=1` 用于检查桌面自举路径。预览配置写入独立临时目录。

```sh
npm run pack:plugin
```

打包产物为根目录下的 `dsh-startup-screen-2.0.1.tgz`。通过 DSH 插件管理器安装该文件。

## 行为与验证范围

插件使用四个固定镜头、十阶段叙事、两次确认、六段人声与合成短音效。身份与权限信息用于启动叙事。动画结束后移交 DSH。

2.0.1 使用 `/dsh-startup/asset` 注册资源前缀。预览和 Host 测试采用 DSH 的完整路径边界匹配规则。自动测试覆盖配置、资源路由、生命周期、两次确认、声音完成与停止，以及 1×/2×窗口布局。

实际 macOS DSH 已验证 2.0.1 资源加载、Retina 画面、两次确认和动画移交。人声实际听感和外接屏跨屏表现仍需人工确认。已知 Esc 跳过会同时关闭底层设置窗口。

详见 [插件说明](packages/dsh-startup-screen/README.md)、[安装](packages/dsh-startup-screen/INSTALL.md)、[macOS 接入](packages/dsh-startup-screen/DESKTOP.md)和[声音说明](packages/dsh-startup-screen/AUDIO-FIELDS.md)。
