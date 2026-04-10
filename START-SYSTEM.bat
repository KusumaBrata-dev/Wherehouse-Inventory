@echo off
echo ====================================
echo  WhereHouse Inventory System
echo ====================================
echo.

REM Start PostgreSQL if not running
echo [1/3] Starting PostgreSQL...
C:\pgsql\bin\pg_ctl.exe -D "C:\pgsql\data" -l "C:\pgsql\pg.log" start 2>nul
timeout /t 2 /nobreak >nul

REM Start Backend in new window
echo [2/3] Starting Backend API (port 3001)...
start "WhereHouse Backend" cmd /k "cd /d "D:\Coding\Wherehouse Inventory\backend" && npm run dev"
timeout /t 3 /nobreak >nul

REM Start Frontend in new window
echo [3/3] Starting Frontend (port 5173)...
start "WhereHouse Frontend" cmd /k "cd /d "D:\Coding\Wherehouse Inventory\frontend" && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ====================================
echo  System Started!
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:3001
echo ====================================
echo.
echo Press any key to open browser...
pause >nul
start http://localhost:5173
