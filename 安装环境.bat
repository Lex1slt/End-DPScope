@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title End-DPScope 开发环境安装
echo ==============================================
echo   End-DPScope 开发环境安装（仅需运行一次）
echo ==============================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到 Python，请先安装 Python 3.10+ 并勾选 Add to PATH
    pause
    exit /b 1
)
echo [1/3] Python ......... OK

pip install -r requirements.txt --quiet 2>nul
echo [2/3] Python 依赖 .... OK

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到 Node.js，请先安装 Node.js 20+：https://nodejs.org/
    pause
    exit /b 1
)
echo [3/3] Node.js ........ OK

if exist "vendor\endaxis\node_modules\vite-node" (
    echo [OK]   计算核心依赖 ... 已安装
) else (
    echo        正在安装计算核心依赖（约 45MB，请勿关闭）...
    if exist "vendor\endaxis\dpsend-runtime.package.json" (
        copy /y "vendor\endaxis\package.json" "vendor\endaxis\package.upstream.json" >nul 2>&1
        copy /y "vendor\endaxis\dpsend-runtime.package.json" "vendor\endaxis\package.json" >nul 2>&1
        echo        （已切换为最小依赖清单，跳过后台界面用的 echarts / element-plus 等约 299MB）
    )
    pushd vendor\endaxis
    call npm install --no-audit --no-fund
    popd
    echo [OK]   计算核心依赖 ... 已安装
)

echo.
echo 安装完成。开发模式启动：双击 End-DPScope.bat
pause
