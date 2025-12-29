@echo off
echo ==========================================
echo   TripoSR 3D Panel Uninstaller
echo ==========================================
echo.

set PANEL_NAME=TripoSR-3D-Panel
set DEST_DIR=%APPDATA%\Adobe\CEP\extensions\%PANEL_NAME%

if exist "%DEST_DIR%" (
    echo Removing panel from: %DEST_DIR%
    rmdir /s /q "%DEST_DIR%"
    echo Panel removed successfully.
) else (
    echo Panel not found at: %DEST_DIR%
)

echo.
echo Uninstall complete. Restart After Effects.
echo.
pause
