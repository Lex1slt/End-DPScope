@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

if not exist "vendor\endaxis\node_modules\vite-node" (
    echo 首次使用请先双击「安装环境.bat」完成环境安装
    echo.
    pause
    exit /b
)

python -c "import webview" >nul 2>&1
if errorlevel 1 (
    echo 正在安装桌面窗口组件（pywebview，仅首次）...
    pip install pywebview --quiet
)

start "" pythonw -m dps_end.desktop
