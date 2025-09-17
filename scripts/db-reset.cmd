@echo off
REM db-reset.cmd - Complete database reset
REM Run from project root or scripts folder

REM Navigate to project root if running from scripts folder
if exist "..\package.json" cd ..

echo =========================================
echo Los Alamos Chess - Database Reset
echo =========================================
echo.

REM Load environment variables from .env
if not exist ".env" (
    echo ERROR: .env file not found!
    echo INFO: Create .env file with database credentials first
    echo INFO: Run scripts\validate-env.cmd to check your setup
    pause
    exit /b 1
)

echo Loading environment variables...
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    set "%%a=%%b"
)

REM Set defaults if not provided
if "%DB_HOST%"=="" set "DB_HOST=localhost"
if "%DB_PORT%"=="" set "DB_PORT=5432"  
if "%DB_NAME%"=="" set "DB_NAME=losalamos_chess"
if "%DB_USER%"=="" set "DB_USER=postgres"

echo OK: Configuration loaded:
echo    Host: %DB_HOST%:%DB_PORT%
echo    Database: %DB_NAME%
echo    User: %DB_USER%
echo.

echo WARNING: This will completely reset your database!
echo WARNING: ALL DATA WILL BE LOST!
echo.
set /p confirm=Are you sure? Type 'RESET' to continue: 
if /i "%confirm%" neq "RESET" (
    echo Cancelled by user
    exit /b 0
)

echo.
echo Starting database reset...

echo.
echo [1/5] Testing PostgreSQL connection...
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: psql command not found!
    echo INFO: Make sure PostgreSQL is installed and in your PATH
    goto :error
)
echo OK: PostgreSQL found

echo.
echo [2/5] Dropping existing database...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "DROP DATABASE IF EXISTS %DB_NAME%;" postgres
if %errorlevel% neq 0 (
    echo ERROR: Failed to drop database
    echo INFO: Check your database credentials in .env file
    echo INFO: Make sure PostgreSQL is running
    goto :error
)
echo OK: Database dropped successfully

echo.
echo [3/5] Creating new database...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;" postgres
if %errorlevel% neq 0 (
    echo ERROR: Failed to create database
    goto :error
)
echo OK: Database created successfully

echo.
echo [4/5] Setting up database schema...
node database\setup.js
if %errorlevel% neq 0 (
    echo ERROR: Schema setup failed
    goto :error
)
echo OK: Schema setup completed

echo.
echo [5/5] Testing database connection...
node database\test-connection.js
if %errorlevel% neq 0 (
    echo ERROR: Connection test failed
    goto :error
)
echo OK: Connection test passed

echo.
echo SUCCESS: Database reset completed successfully!
echo.
echo INFO: Next steps:
echo    - Run 'npm run db:seed' to add test data (optional)
echo    - Run 'npm start' to start the server
echo.
pause
exit /b 0

:error
echo.
echo ERROR: Database reset failed!
echo.
echo Troubleshooting:
echo    1. Make sure PostgreSQL is running
echo    2. Check your .env file credentials  
echo    3. Verify the database user has CREATE privileges
echo    4. Run 'scripts\validate-env.cmd' to check your setup
echo.
pause
exit /b 1