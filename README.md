# POI / THE MACHINE · DeepSeek Harness

适用于 macOS DeepSeek Harness 的 POI 启动动画插件，版本 2.0.1。包含四个固定镜头、十阶段叙事、两次确认、六段人声和界面音效。

## 安装

在 DeepSeek Harness 的「插件」页面选择通过 Git 链接添加插件，填入：

```text
https://github.com/Toska1102/POI_theme-dsh-startup-screen
```

安装后启用 `poi-theme-dsh-startup-screen`，重新打开 DeepSeek Harness。在设置中的「POI 启动动画」调整身份、播放频率、速度和音量。

仓库根目录即完整插件，所有运行代码、图片、字体和音频均已包含。安装无需构建，无运行依赖。安装了原版启动插件时，请先停用原版，再启用本插件。

身份和权限信息用于启动叙事。动画结束后显示 DSH。配置保存在 `~/.dsh/dsh-startup.json`。允许跳过时，可点击 SKIP 或按 Esc；在设置内预览时，Esc 也会关闭底层设置窗口。

## 项目来源与许可

本项目核心基于 [6shenhonghong9/dsh-startup-screen](https://github.com/6shenhonghong9/dsh-startup-screen) 二次开发。原作者为沈宏宏。沿用其 DSH 插件接入方式、设置功能和六段人声素材，保留原作者版权声明与 [MIT 许可证](LICENSE)。本次二次开发调整了 POI 场景、HUD、动画、声音生命周期和 macOS 桌面加载逻辑。

视觉灵感来自《Person of Interest》（POI / 疑犯追踪）中的 The Machine；四张背景为生成图片。字体 Michroma、VT323、Share Tech Mono 来自 [Google Fonts](https://github.com/google/fonts)，各字体 OFL 许可证保留在 `lib/assets`。

六段人声沿用上游素材。上游说明前五段录音来自第三方视频，欢迎录音为自制素材。代码 MIT 许可不覆盖第三方音视频素材；相关素材授权范围须单独确认。POI 相关名称和视觉风格不代表官方关联或授权。
