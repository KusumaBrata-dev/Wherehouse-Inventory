@echo off
setlocal enabledelayedexpansion

:: =====================================================================
:: WAREHOUSE INVENTORY — INTEGRATED STARTUP SCRIPT
:: =====================================================================
:: Menjalankan seluruh ekosistem: DB Sync, Backend, Frontend, & Studio.
:: =====================================================================

title WAREHOUSE SYSTEM — INITIALIZING...
color 0b
cls

:: Get current directory
set "BASE_DIR=%~dp0"
cd /d "%BASE_DIR%"

echo.
echo  =============================================================
echo    WAREHOUSE INVENTORY SYSTEM — STARTUP SEQUENCE
echo  =============================================================
echo.

:: [1/4] Mencari file .env dan Konfigurasi
echo [1/4] Loading Environment Configuration...
if not exist ".env" (
    echo [ERROR] Root .env file not found!
    pause
    exit /b
)

:: Parse .env for PostgreSQL paths
:: We use basic loop to find variables. Note: this doesn't handle spaces around = perfectly but works for standard .env
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    set "key=%%a"
    set "val=%%b"
    if not "!val!"=="" (
        set "val=!val:"=!"
        if "!key!"=="PG_BIN_PATH" set "PG_BIN_PATH=!val!"
        if "!key!"=="PG_DATA_PATH" set "PG_DATA_PATH=!val!"
    )
)

:: Fallbacks if not in .env
if "%PG_BIN_PATH%"=="" set "PG_BIN_PATH=C:\pgsql\bin"
if "%PG_DATA_PATH%"=="" set "PG_DATA_PATH=C:\pgsql\data"

echo - PG BIN: %PG_BIN_PATH%
echo - PG DATA: %PG_DATA_PATH%
echo OK.
echo.

:: [2/4] Menjalankan PostgreSQL Database
echo [2/4] Starting PostgreSQL Database...

:: Check if postgres is already running
"%PG_BIN_PATH%\pg_ctl.exe" -D "%PG_DATA_PATH%" status >nul 2>&1
if %errorlevel% neq 0 (
    echo - Stale PID detection...
    if exist "%PG_DATA_PATH%\postmaster.pid" (
        echo [WARNING] Stale postmaster.pid found. Cleaning up...
        del /f /q "%PG_DATA_PATH%\postmaster.pid"
    )
    echo - Launching PostgreSQL...
    "%PG_BIN_PATH%\pg_ctl.exe" -D "%PG_DATA_PATH%" start 2>nul
    
    :: Wait for DB to be ready (up to 10 seconds)
    echo - Waiting for database to initialize...
    ping -n 6 127.0.0.1 >nul
) else (
    echo - PostgreSQL is already running.
)
echo OK.
echo.

:: [3/4] Sinkronisasi Schema Database
echo [3/4] Synchronizing Database Schema (Prisma)...

echo - Generating Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERROR] Prisma Generate failed!
    pause
    exit /b
)

echo - Checking Schema Sync...
call npx prisma db push

:: Automate Seeding if database is new or missing the standard layout
echo - Populating Default Data...
cd /d "%BASE_DIR%backend"
node src/seeds/check-seed.js >nul 2>&1
if !errorlevel! equ 0 (
    echo - Establishing Standard Warehouse Layout - restore-hierarchy
    node src/seeds/restore-hierarchy.js
) else (
    echo - Standard layout already exists. Skipping seed.
)
echo OK.
echo.

:: [4/4] Menjalankan Services
echo [4/4] Launching WAREHOUSE Services...

echo - Starting Backend API (port 3001)...
start "WAREHOUSE-BACKEND" /d "%BASE_DIR%backend" cmd /c "npm run dev"
ping -n 3 127.0.0.1 >nul

echo - Starting Frontend (port 5173)...
start "WAREHOUSE-FRONTEND" /d "%BASE_DIR%frontend" cmd /c "npm run dev"
ping -n 3 127.0.0.1 >nul

echo - Starting Prisma Studio (port 49152)...
start "WAREHOUSE-STUDIO" /d "%BASE_DIR%" cmd /c "npx prisma studio --port 49152 --browser none"

echo - Starting Localtunnel (port 3001)...
start "WAREHOUSE-TUNNEL" /d "%BASE_DIR%backend" cmd /c "npx lt --port 3001 --subdomain warehouse-api-192"

echo.
echo =============================================================
echo   SYSTEM LAUNCHED SUCCESSFULLY!
echo =============================================================
echo   Frontend  : http://127.0.0.1:5173
echo   Backend   : http://127.0.0.1:3001
echo   Database  : http://127.0.0.1:49152 (Studio)
echo =============================================================
echo.
echo Anda dapat menutup jendela ini. Layanan tetap berjalan di background.
echo Gunakan STOP-SYSTEM.bat untuk mematikan seluruh layanan secara bersih.
echo.
pause
