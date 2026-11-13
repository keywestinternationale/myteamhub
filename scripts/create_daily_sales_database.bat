@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%create_daily_sales_database.ps1"
if errorlevel 1 (
  echo Database setup failed.
  endlocal
  exit /b 1
)
echo Database setup completed.
endlocal
