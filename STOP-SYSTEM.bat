@echo off
echo Stopping WhereHouse services...
C:\pgsql\bin\pg_ctl.exe -D "C:\pgsql\data" stop 2>nul
echo Done.
pause
