@echo off
REM validate-env.cmd - Check environment setup
REM Run from project root or scripts folder

REM Navigate to project root if running from scripts folder
if exist "..\package.json" cd ..

echo =========================================
echo Los Alamos Chess - Environment Validator
echo =========================================
echo.

REM Check if Node.js is installed
echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found! Please install Node.js 18+ from https://nodejs.org
    goto :error
) else (
    echo OK: Node.js found: 
    node --version
)

REM Check if npm is installed
echo.
echo [2/6] Checking npm installation...
npm --version >NUL 2>NUL
if %errorlevel% neq 0 (
    echo ERROR: npm not found! Please install npm
    goto :error
) else (
    echo OK: npm found:
    for /f %%i in ('npm --version 2^>NUL') do echo %%i
)

REM Check if PostgreSQL is accessible
echo.
echo [3/6] Checking PostgreSQL installation...
psql --version >NUL 2>NUL
if %errorlevel% neq 0 (
    echo WARNING: psql command not found - PostgreSQL may not be in PATH
    echo INFO: Make sure PostgreSQL is installed and psql is in your PATH
) else (
    echo OK: PostgreSQL found:
    for /f %%i in ('psql --version 2^>NUL') do echo %%i
)

REM Check if .env file exists
echo.
echo [4/6] Checking .env file...
if not exist ".env" (
    echo ERROR: .env file not found!
    echo INFO: Create .env file with database credentials
    echo INFO: Use .env.example as template if available
    goto :error
) else (
    echo OK: .env file found
)

REM Load and check environment variables
echo.
echo [5/6] Checking environment variables...
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    set "%%a=%%b"
)

set missing_vars=

if "%DB_HOST%"=="" (
    echo ERROR: DB_HOST not set in .env
    set missing_vars=1
) else (
    echo OK: DB_HOST: %DB_HOST%
)

if "%DB_PORT%"=="" (
    echo WARNING: DB_PORT not set - will use default 5432
) else (
    echo OK: DB_PORT: %DB_PORT%
)

if "%DB_NAME%"=="" (
    echo ERROR: DB_NAME not set in .env
    set missing_vars=1
) else (
    echo OK: DB_NAME: %DB_NAME%
)

if "%DB_USER%"=="" (
    echo ERROR: DB_USER not set in .env
    set missing_vars=1
) else (
    echo OK: DB_USER: %DB_USER%
)

if "%DB_PASSWORD%"=="" (
    echo ERROR: DB_PASSWORD not set in .env
    set missing_vars=1
) else (
    echo OK: DB_PASSWORD: [HIDDEN]
)

if "%JWT_SECRET%"=="" (
    echo WARNING: JWT_SECRET not set - authentication may not work
) else (
    echo OK: JWT_SECRET: [HIDDEN]
)

if defined missing_vars (
    echo.
    echo ERROR: Missing required environment variables!
    goto :error
)

REM Check if node_modules exists
echo.
echo [6/6] Checking dependencies...
if not exist "node_modules" (
    echo WARNING: node_modules not found
    echo INFO: Run 'npm install' or 'scripts\fresh-install.cmd' to install dependencies
) else (
    echo OK: node_modules found
)

if not exist "package.json" (
    echo ERROR: package.json not found!
    goto :error
) else (
    echo OK: package.json found
)

echo.
echo SUCCESS: Environment validation completed successfully!
echo INFO: Your environment appears to be properly configured
echo.
pause
exit /b 0

:error
echo.
echo ERROR: Environment validation failed!
echo INFO: Please fix the issues above before proceeding
echo.
pause
exit /b 1