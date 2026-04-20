@echo off
setlocal enabledelayedexpansion

title WAREHOUSE SYSTEM — STOPPING...
color 0c
cls

:: Get current directory
set "BASE_DIR=%~dp0"
cd /d "%BASE_DIR%"

echo.
echo  =============================================================
echo    WAREHOUSE INVENTORY SYSTEM — TERMINATING SERVICES
echo  =============================================================
echo.

:: [1/2] Menghentikan Proses Node.js (Background Services)
echo [1/2] Terminating Background Services...

:: Kill processes by exact window title set in START-SYSTEM.bat
:: We use filter to find windows starting with WAREHOUSE-
taskkill /f /fi "WINDOWTITLE eq WAREHOUSE-BACKEND*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq WAREHOUSE-FRONTEND*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq WAREHOUSE-STUDIO*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq WAREHOUSE-TUNNEL*" >nul 2>&1

echo - Node.js services stopped.

:: [2/2] Menghentikan PostgreSQL Database
echo [2/2] Stopping PostgreSQL Database...

:: Parse .env for PostgreSQL paths
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        set "key=%%a"
        set "val=%%b"
        if not "!val!"=="" (
            set "val=!val:"=!"
            if "!key!"=="PG_BIN_PATH" set "PG_BIN_PATH=!val!"
            if "!key!"=="PG_DATA_PATH" set "PG_DATA_PATH=!val!"
        )
    )
)

:: Fallbacks
if "%PG_BIN_PATH%"=="" set "PG_BIN_PATH=C:\pgsql\bin"
if "%PG_DATA_PATH%"=="" set "PG_DATA_PATH=C:\pgsql\data"

"%PG_BIN_PATH%\pg_ctl.exe" -D "%PG_DATA_PATH%" stop 2>nul
if %errorlevel% equ 0 (
    echo - PostgreSQL stopped successfully.
) else (
    echo - PostgreSQL was not running or failed to stop.
)

echo.
echo =============================================================
echo   ALL SERVICES STOPPED.
echo =============================================================
echo.
pause
