@echo off
chcp 65001 >nul
REM Chay vong quay tren Windows: nhap dup file nay. Can Node.js >= 20 (https://nodejs.org)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Tai ban LTS tai https://nodejs.org roi chay lai.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Cai dat lan dau, can Internet...
  call npm install || (pause & exit /b 1)
)

if not exist .dev.vars (
  set /p PASS=Dat mat khau admin: 
  call echo ADMIN_PASSWORD=%%PASS%%> .dev.vars
  echo Da luu mat khau vao file .dev.vars
)

start "" cmd /c "timeout /t 5 >nul & start http://localhost:8080/dashboard"
echo Dashboard: http://localhost:8080/dashboard   (dong cua so nay de tat)
call npm start
pause
