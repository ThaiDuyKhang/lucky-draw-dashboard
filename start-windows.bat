@echo off
REM Nhap dup file nay de chay vong quay tren Windows (khong can cai gi them).
REM Trinh duyet se tu mo http://localhost:8080/ . Dong cua so den de tat.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
