# 安装与运行

## 源码预览

```sh
npm install
npm run preview
```

访问终端输出的回环地址。预览需要本地 HTTP 服务。直接打开 `preview/index.html` 无法提供配置、字体和音频路由。

## 打包

```sh
npm test
npm pack
```

生成的 `.tgz` 包包含插件代码、固定素材、字体许可和文档。开发依赖用于源码预览及测试。

## 安装到 DSH

使用 DSH 插件管理器安装本地包。若环境提供 DSH CLI，可在桌面端完全退出后执行：

```sh
dsh plugin --profile desktop add ./dsh-startup-screen-2.0.0.tgz
```

部分 DSH 版本限制 CLI 操作 desktop profile；按桌面端支持的插件安装流程处理。安装后重新打开应用，在设置中检查「POI 启动动画」。

配置保存在 `~/.dsh/dsh-startup.json`。配置字段只保留身份、播放和声音设置。预览服务使用独立临时目录。

应用内存在运行中任务时，不重启或替换其插件。先完成源码预览和测试，再安排安装验收。
