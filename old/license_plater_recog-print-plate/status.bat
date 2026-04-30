@echo off
echo ========================================
echo Status do SEC Monitor
echo ========================================
echo.

pm2 status

echo.
echo ========================================
echo Logs (ultimas 20 linhas):
echo ========================================
pm2 logs sec-monitor --lines 20 --nostream

echo.
pause




