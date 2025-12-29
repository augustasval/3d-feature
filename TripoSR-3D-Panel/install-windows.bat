@echo off
echo ==========================================
echo   TripoSR 3D Panel Installer
echo ==========================================
echo.

set PANEL_NAME=TripoSR-3D-Panel
set DEST_DIR=%APPDATA%\Adobe\CEP\extensions\%PANEL_NAME%

echo [1/3] Enabling CEP debug mode...
reg add HKCU\Software\Adobe\CSXS.9 /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add HKCU\Software\Adobe\CSXS.10 /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add HKCU\Software\Adobe\CSXS.11 /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
reg add HKCU\Software\Adobe\CSXS.12 /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
echo       Done

echo [2/3] Installing panel files...
if not exist "%APPDATA%\Adobe\CEP\extensions" mkdir "%APPDATA%\Adobe\CEP\extensions"

if exist "%DEST_DIR%" (
    echo       Removing previous installation...
    rmdir /s /q "%DEST_DIR%"
)

xcopy /E /I /Y "%~dp0" "%DEST_DIR%" >nul
echo       Panel installed to: %DEST_DIR%

echo.
echo ==========================================
echo   Installation Complete!
echo ==========================================
echo.
echo Next steps:
echo   1. Restart After Effects
echo   2. Go to Window ^> Extensions ^> TripoSR 3D
echo   3. Enter your RunPod API key and endpoint ID
echo.
pause
