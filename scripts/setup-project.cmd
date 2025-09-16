@echo off
REM setup-project.cmd - Complete project setup for new developers
REM Run from project root or scripts folder

REM Navigate to project root if running from scripts folder
if exist "..\package.json" cd ..

echo =========================================
echo Los Alamos Chess - Project Setup
echo =========================================
echo.

echo Welcome to Los Alamos Chess!
echo This script will set up everything you need to start developing.
echo.

echo What this script does:
echo    1. Validate your environment
echo    2. Install dependencies 
echo    3. Set up database
echo    4. Run tests
echo    5. Start the server (optional)
echo.

set /p confirm=Continue with setup? (y/N): 
if /i "%confirm%" neq "y" (
    echo Setup cancelled by user
    exit /b 0
)

echo.
echo =========================================
echo Step 1: Environment Validation
echo =========================================

if exist "scripts\validate-env.cmd" (
    call scripts\validate-env.cmd
) else (
    call validate-env.cmd
)

if %errorlevel% neq 0 (
    echo ERROR: Environment validation failed!
    echo INFO: Please fix the issues and run this script again
    goto :error
)

echo.
echo =========================================  
echo Step 2: Installing Dependencies
echo =========================================

if exist "node_modules" (
    echo Dependencies already installed
    set /p reinstall=Reinstall dependencies? (y/N): 
    if /i "%reinstall%"=="y" (
        if exist "scripts\fresh-install.cmd" (
            call scripts\fresh-install.cmd
        ) else (
            call fresh-install.cmd
        )
        if %errorlevel% neq 0 goto :error
    )
) else (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        goto :error
    )
    echo OK: Dependencies installed successfully
)

echo.
echo =========================================
echo Step 3: Database Setup  
echo =========================================

echo Checking if database exists...
node database\test-connection.js >nul 2>&1
if %errorlevel% neq 0 (
    echo Database needs to be set up...
    
    REM Load environment variables
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        set "%%a=%%b"
    )
    
    if "%DB_HOST%"=="" set "DB_HOST=localhost"
    if "%DB_PORT%"=="" set "DB_PORT=5432"
    if "%DB_NAME%"=="" set "DB_NAME=losalamos_chess" 
    if "%DB_USER%"=="" set "DB_USER=postgres"
    
    echo Creating database...
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;" postgres 2>nul
    
    echo Setting up schema...
    node database\setup.js
    if %errorlevel% neq 0 (
        echo ERROR: Database setup failed
        goto :error
    )
) else (
    echo OK: Database connection successful
    
    set /p reset_db=Reset database to clean state? (y/N): 
    if /i "%reset_db%"=="y" (
        if exist "scripts\db-reset.cmd" (
            call scripts\db-reset.cmd
        ) else (
            call db-reset.cmd
        )
        if %errorlevel% neq 0 goto :error
    )
)

echo.
echo =========================================
echo Step 4: Testing Setup
echo =========================================

echo Testing database connection...
node database\test-connection.js
if %errorlevel% neq 0 (
    echo ERROR: Database connection test failed
    goto :error
)

echo Running basic health check...
if exist "server.js" (
    echo INFO: Server file found - setup appears complete
) else (
    echo WARNING: server.js not found - you may need to check project structure  
)

echo.
echo =========================================
echo Step 5: Optional Data Seeding
echo =========================================

set /p seed_data=Add test data for development? (y/N): 
if /i "%seed_data%"=="y" (
    echo Seeding database with test data...
    node database\seed.js
    if %errorlevel% neq 0 (
        echo WARNING: Seeding failed - continuing anyway
    )
)

echo.
echo SUCCESS: Project setup completed successfully!
echo.
echo Quick Reference:
echo    npm start          - Start the server
echo    npm run dev        - Start with auto-reload
echo    npm run db:test    - Test database connection
echo    npm run db:seed    - Add test data
echo    scripts\validate-env.cmd   - Check environment
echo    scripts\db-reset.cmd       - Reset database
echo.

set /p start_server=Start the server now? (y/N): 
if /i "%start_server%"=="y" (
    echo Starting server...
    npm start
)

echo.
echo Welcome to the Los Alamos Chess project!
echo INFO: Check README.md for more development information
echo.
pause
exit /b 0

:error
echo.
echo ERROR: Project setup failed!
echo.
echo Troubleshooting:
echo    - Run scripts\validate-env.cmd to check your environment
echo    - Check that PostgreSQL is running
echo    - Verify your .env file is configured correctly
echo    - Try running individual scripts: scripts\fresh-install.cmd, scripts\db-reset.cmd
echo.
pause
exit /b 1echo ⚠️ server.js not found - you may need to check project structure  
)

echo.
echo =========================================
echo Step 5: Optional Data Seeding
echo =========================================

set /p seed_data=Add test data for development? (y/N): 
if /i "%seed_data%"=="y" (
    echo 🌱 Seeding database with test data...
    node database\seed.js
    if %errorlevel% neq 0 (
        echo ⚠️ Seeding failed - continuing anyway
    )
)

echo.
echo ✅ Project setup completed successfully!
echo.
echo 📚 Quick Reference:
echo    npm start          - Start the server
echo    npm run dev        - Start with auto-reload
echo    npm run db:test    - Test database connection
echo    npm run db:seed    - Add test data
echo    validate-env.cmd   - Check environment
echo    db-reset.cmd       - Reset database
echo.

set /p start_server=Start the server now? (y/N): 
if /i "%start_server%"=="y" (
    echo 🚀 Starting server...
    npm start
)

echo.
echo 🎉 Welcome to the Los Alamos Chess project!
echo 💡 Check README.md for more development information
echo.
pause
exit /b 0

:error
echo.
echo ❌ Project setup failed!
echo.
echo 🔧 Troubleshooting:
echo    - Run validate-env.cmd to check your environment
echo    - Check that PostgreSQL is running
echo    - Verify your .env file is configured correctly
echo    - Try running individual scripts: fresh-install.cmd, db-reset.cmd
echo.
pause
exit /b 1