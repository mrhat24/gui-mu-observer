@echo off
setlocal
cd /d "%~dp0"
set "TRACKER_NODE=node"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "TRACKER_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%TRACKER_NODE%" web\scripts\serve.mjs --open
if errorlevel 1 pause
