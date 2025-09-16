@echo off
REM fresh-install.cmd - Clean dependency installation
REM Run from project root or scripts folder

REM Navigate to project root if running from scripts folder
if exist "..\package.json" cd ..

echo =========================================
echo Los Alamos Chess - Fresh Install
echo =========================================
echo.

echo Starting fresh dependency installation...
echo WARNING: This will delete node_modules and package-lock.json
echo.

set /p confirm=Continue? (y/N): 
if /i "%confirm%" neq "y" (
    echo Cancelled by user
    exit /b 0
)

echo.
echo [1/5] Cleaning existing dependencies...

if exist "node_modules" (
    echo Removing node_modules...
    rmdir /s /q "node_modules" 2>nul
    if exist "node_modules" (
        echo ERROR: Failed to remove node_modules - try closing your IDE/editor
        pause
        exit /b 1
    ) else (
        echo OK: node_modules removed
    )
) else (
    echo OK: node_modules already clean
)

if exist "package-lock.json" (
    echo Removing package-lock.json...
    del "package-lock.json" 2>nul
    echo OK: package-lock.json removed
) else (
    echo OK: package-lock.json already clean
)

echo.
echo [2/5] Clearing npm cache...
npm cache clean --force
if %errorlevel% neq 0 (
    echo ERROR: Failed to clear npm cache
    goto :error
)
echo OK: npm cache cleared

echo.
echo [3/5] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    echo INFO: Check your internet connection and try again
    goto :error
)
echo OK: Dependencies installed successfully

echo.
echo [4/5] Running security audit...
npm audit --audit-level=moderate
if %errorlevel% neq 0 (
    echo WARNING: Security vulnerabilities found
    echo INFO: Run 'npm audit fix' to attempt automatic fixes
) else (
    echo OK: No security vulnerabilities found
)

echo.
echo [5/5] Verifying installation...
if not exist "node_modules" (
    echo ERROR: node_modules directory missing after install
    goto :error
)

if not exist "package-lock.json" (
    echo ERROR: package-lock.json missing after install
    goto :error
)

echo OK: Installation verified successfully

echo.
echo SUCCESS: Fresh install completed successfully!
echo INFO: You can now run 'npm start' or other npm scripts
echo.
pause
exit /b 0

:error
echo.
echo ERROR: Fresh install failed!
echo INFO: Please check the errors above and try again
echo.
pause
exit /b 1