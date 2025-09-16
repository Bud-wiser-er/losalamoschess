@echo off
REM dev-start.cmd - Start development server with checks
REM Run from project root or scripts folder

REM Navigate to project root if running from scripts folder
if exist "..\package.json" cd ..

echo =========================================
echo Los Alamos Chess - Development Server
echo =========================================
echo.

echo Pre-flight checks...

REM Quick environment check
if not exist ".env" (
    echo ERROR: .env file missing - run scripts\validate-env.cmd
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo ERROR: Dependencies missing - run scripts\fresh-install.cmd
    pause
    exit /b 1
)

echo Testing database connection...
node database\test-connection.js >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Database connection failed
    echo INFO: Run scripts\db-status.cmd for more details
    set /p fix_db=Try to fix database now? (y/N): 
    if /i "%fix_db%"=="y" (
        if exist "scripts\db-reset.cmd" (
            call scripts\db-reset.cmd
        ) else (
            call db-reset.cmd
        )
        if %errorlevel% neq 0 exit /b 1
    ) else (
        exit /b 1
    )
)

echo OK: All checks passed!
echo.
echo Starting development server...
echo INFO: Press Ctrl+C to stop the server
echo.

npm run dev