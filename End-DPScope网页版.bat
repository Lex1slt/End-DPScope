@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title End-DPScope Web
python -m dps_end.server
pause
