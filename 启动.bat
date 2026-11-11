@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem 优先用本机 node；没有的话试内置运行时
where node >nul 2>nul
if %errorlevel%==0 (
  set NODE=node
) else (
  set NODE=C:\Users\Lenovo\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe
)

if not exist node_modules (
  echo   还没装依赖。先在本目录执行：
  echo     pnpm install
  echo   然后再双击这个文件。
  pause
  exit /b
)

echo.
echo   分子特调 · 测试版
echo   浏览器打开： http://127.0.0.1:5178
echo   关闭这个窗口即停止服务。
echo.
"%NODE%" node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5178
pause