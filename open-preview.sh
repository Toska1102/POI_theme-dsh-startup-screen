#!/bin/sh
set -e
cd "$(dirname "$0")"
printf '%s\n' '运行本地 POI 预览。首次运行请先执行 npm install。' '服务启动后打开终端输出的 URL；按 Ctrl+C 退出。'
exec npm run preview
