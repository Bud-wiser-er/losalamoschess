@echo off
REM db-status.cmd - Quick database status check
REM Run from project root or scripts folder

REM Navigate to project root if running from scripts folder
if exist "..\package.json" cd ..

echo =========================================
echo Los Alamos Chess - Database Status
echo =========================================
echo.

if not exist ".env" (
    echo ERROR: .env file not found
    exit /b 1
)

echo Checking database status...
node database\test-connection.js
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Database connection failed
    echo INFO: Try running scripts\db-reset.cmd to fix database issues
) else (
    echo.
    echo OK: Database is healthy and accessible
)

echo.
pause