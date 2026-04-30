@echo off
cd /d %~dp0

echo ========================================
echo Iniciando SEC Monitor com PM2
echo ========================================
echo.

REM Verifica se PM2 esta instalado
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] PM2 nao encontrado!
    echo.
    echo Instale primeiro:
    echo   npm install -g pm2
    pause
    exit /b 1
)

REM Para processo existente
pm2 stop sec-monitor >nul 2>&1
pm2 delete sec-monitor >nul 2>&1

REM Cria diretorio de logs
if not exist "logs" mkdir logs

REM Inicia o monitor
echo Iniciando sec_monitor.py...
pm2 start ecosystem.config.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [OK] SEC Monitor iniciado!
    echo ========================================
    echo.
    pm2 status
    echo.
    echo Proximo passo:
    echo   Execute: configurar_autostart.bat
    echo.
) else (
    echo.
    echo [ERRO] Falha ao iniciar
    echo.
    echo Tente corrigir:
    echo   pm2 kill
    echo   pm2 ping
    echo.
)

pause




