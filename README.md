# POI / THE MACHINE · DeepSeek Harness

适用于 macOS DeepSeek Harness 的启动动画插件，版本 2.1.0。冷白终端、16 路摄像头时间线、关键帧放大和双实体锁定组成十阶段连续演出。

## 安装

在 DeepSeek Harness 的插件页面通过 Git 链接添加：

```text
https://github.com/Toska1102/POI_theme-dsh-startup-screen
```

启用 `poi-theme-dsh-startup-screen`。若同时安装了原版启动插件，请先停用原版。按 DSH 的提示应用更改；需要重启时，请先结束运行中的任务。

仓库根目录即完整插件，包含全部运行代码、图片、字体和可选人声。安装无需构建，无额外运行依赖。

## 播放与设置

默认演出约 9 秒。第 03 帧只需点击一次 `GRANT ACCESS`，也可按 Enter 或空格；之后自动播放至终幕并显示 DSH。人工等待另计。终幕默认文案为 `what are your commands？`，可在设置中修改。

默认每次完全退出并重新启动 DSH 时播放一次。刷新窗口、切换会话和打开设置不会重复播放。还可选择每天首次、仅手动预览或关闭。

在设置中的「POI 启动动画」调整：

- 常用设置：身份、播放频率、6–15 秒总时长、终幕文案、人声及短音效开关、各自音量、允许跳过。
- 高级设置：各阶段时长、镜头运动、扫描与锁定速度、效果强度和减少动态效果策略。

调整总时长会按比例缩放各阶段；调整阶段时长会更新总时长。每组支持恢复默认，保存后可立即预览。默认跟随 macOS 的减少动态效果设置，并保留相同播放时长。

短音效默认开启，人声默认关闭。开启人声后，六段录音保持原速，对应阶段会等待播放结束，实际时长可能超过 9 秒。允许跳过时，SKIP 或 Esc 会立即结束演出并停止声音。

图片或录音失败时省略对应素材。自动启动超过 1 秒仍无法显示时直接放行；设置页的主动预览有独立的加载窗口。身份和权限信息用于启动叙事。

配置保存在 `$DSH_HOME/dsh-startup.json`，默认路径为 `~/.dsh/dsh-startup.json`。已有配置中的受支持设置会保留。

## 项目来源与许可

本项目核心基于 [6shenhonghong9/dsh-startup-screen](https://github.com/6shenhonghong9/dsh-startup-screen) 二次开发。原作者为沈宏宏。沿用其 DSH 插件接入方式、设置功能和六段人声素材，保留原作者版权声明与 [MIT 许可证](LICENSE)。本次二次开发调整了场景、HUD、动画、声音生命周期和 macOS 桌面加载逻辑。

视觉灵感来自《Person of Interest》（POI / 疑犯追踪）中的 The Machine，并参考 [rosehahah/the-machine](https://github.com/rosehahah/the-machine) 的 MPOV 视觉规范。本轮未复制该参考项目的代码。四张背景为生成图片。Share Tech Mono 来自 [Google Fonts](https://github.com/google/fonts)，其 OFL 许可证保留在 `lib/assets/sharetechmono-OFL.txt`。

六段人声沿用上游素材。上游说明前五段录音来自第三方视频，欢迎录音为自制素材。代码 MIT 许可不覆盖第三方音视频素材；相关素材授权范围须单独确认。POI 相关名称和视觉风格不代表官方关联或授权。
