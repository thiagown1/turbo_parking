@echo off
echo ========================================
echo Parando SEC Monitor
echo ========================================
echo.

pm2 stop sec-monitor
pm2 delete sec-monitor

echo.
echo [OK] SEC Monitor parado
echo.
pm2 status
echo.
pause




