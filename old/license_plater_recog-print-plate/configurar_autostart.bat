@echo off
cd /d %~dp0

echo ========================================
echo Configurar Auto-Start com PM2
echo ========================================
echo.

REM Verifica se PM2 esta instalado
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] PM2 nao encontrado!
    echo Instale primeiro: npm install -g pm2
    pause
    exit /b 1
)

REM Verifica se o monitor esta rodando
echo [1/3] Verificando se o monitor esta rodando...
pm2 list | findstr /I "sec-monitor" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] Monitor nao esta rodando!
    echo.
    echo Execute primeiro: iniciar.bat
    pause
    exit /b 1
)

echo [OK] Monitor esta rodando
echo.

REM Salva a configuracao
echo [2/3] Salvando configuracao...
pm2 save

if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao salvar configuracao
    pause
    exit /b 1
)

echo [OK] Configuracao salva
echo.

REM Obtem comando de startup
echo [3/3] Configurando startup do Windows...
echo.
echo O PM2 vai mostrar um comando para executar.
echo.
echo ========================================
echo IMPORTANTE - COPIE O COMANDO ABAIXO:
echo ========================================
echo.

pm2 startup

echo.
echo ========================================
echo PRÓXIMOS PASSOS:
echo ========================================
echo.
echo 1. COPIE o comando mostrado acima (comeca com "pm2 startup")
echo.
echo 2. Abra um CMD como Administrador:
echo    - Pressione Win + X
echo    - Selecione "Terminal (Admin)" ou "Prompt de Comando (Admin)"
echo.
echo 3. NO CMD ADMIN, cole e execute o comando copiado
echo.
echo 4. Aguarde a confirmacao
echo.
echo 5. Pronto! O monitor iniciara automaticamente quando o Windows reiniciar
echo.
echo ========================================
echo.
echo NOTA: Sem executar o comando como Admin, o auto-start NAO funcionara!
echo.
pause




