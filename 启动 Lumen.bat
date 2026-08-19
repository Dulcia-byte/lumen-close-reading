@echo off
chcp 65001 >nul
title Lumen Launcher
cd /d "C:\Users\34253\Documents\Codex\2026-08-16\spreadsheets-plugin-spreadsheets-openai-primary-runtime"
set "PATH=C:\Users\34253\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
echo 正在启动 Lumen，请稍候...
powershell -NoProfile -Command "$lock='.vinext/dev/lock.json'; if(Test-Path $lock){$serverId=(Get-Content $lock -Raw|ConvertFrom-Json).pid; if(-not(Get-Process -Id $serverId -ErrorAction SilentlyContinue)){Remove-Item $lock -Force}}"
start "Lumen Server" /min cmd /k "set WRANGLER_LOG_PATH=.wrangler/wrangler.log&& node_modules\.bin\vinext.CMD dev"
timeout /t 4 /nobreak >nul
start "" "http://localhost:3000/"
echo Lumen 已启动。可以关闭这个窗口。
pause
