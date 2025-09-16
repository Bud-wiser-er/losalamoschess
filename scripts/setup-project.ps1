# setup-project.ps1 - Complete project setup for new developers
# Run from project root or scripts folder

# Navigate to project root if running from scripts folder
if (Test-Path "..\package.json") {
    Set-Location ..
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Los Alamos Chess - Project Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Welcome to Los Alamos Chess!" -ForegroundColor Green
Write-Host "This script will set up everything you need to start developing."
Write-Host ""

Write-Host "What this script does:"
Write-Host "   1. Validate your environment"
Write-Host "   2. Install dependencies"
Write-Host "   3. Set up database"
Write-Host "   4. Run tests"
Write-Host "   5. Start the server (optional)"
Write-Host ""

$confirm = Read-Host "Continue with setup? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Setup cancelled by user"
    exit 0
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Step 1: Environment Validation" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Run environment validation
if (Test-Path "scripts\validate-env.ps1") {
    & "scripts\validate-env.ps1"
} elseif (Test-Path "validate-env.ps1") {
    & "validate-env.ps1"
} else {
    Write-Host "ERROR: validate-env.ps1 not found!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Environment validation failed!" -ForegroundColor Red
    Write-Host "INFO: Please fix the issues and run this script again" -ForegroundColor Blue
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Step 2: Installing Dependencies" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

if (Test-Path "node_modules") {
    Write-Host "Dependencies already installed"
    $reinstall = Read-Host "Reinstall dependencies? (y/N)"
    if ($reinstall -eq "y" -or $reinstall -eq "Y") {
        Write-Host "Removing existing dependencies..."
        if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
        if (Test-Path "package-lock.json") { Remove-Item -Force "package-lock.json" }
        
        Write-Host "Installing fresh dependencies..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
} else {
    Write-Host "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "OK: Dependencies installed successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Step 3: Database Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Write-Host "Checking if database exists..."
node database\test-connection.js *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Database needs to be set up..."
    
    # Load environment variables
    $envVars = @{}
    if (Test-Path ".env") {
        Get-Content ".env" | ForEach-Object {
            if ($_ -match "^([^=]+)=(.*)$") {
                $envVars[$matches[1]] = $matches[2]
            }
        }
    }
    
    $dbHost = if ($envVars.DB_HOST) { $envVars.DB_HOST } else { "localhost" }
    $dbPort = if ($envVars.DB_PORT) { $envVars.DB_PORT } else { "5432" }
    $dbName = if ($envVars.DB_NAME) { $envVars.DB_NAME } else { "losalamos_chess" }
    $dbUser = if ($envVars.DB_USER) { $envVars.DB_USER } else { "postgres" }
    
    Write-Host "Creating database..."
    psql -h $dbHost -p $dbPort -U $dbUser -c "CREATE DATABASE $dbName;" postgres *>$null
    
    Write-Host "Setting up schema..."
    node database\setup.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Database setup failed" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "OK: Database connection successful" -ForegroundColor Green
    
    $resetDb = Read-Host "Reset database to clean state? (y/N)"
    if ($resetDb -eq "y" -or $resetDb -eq "Y") {
        Write-Host "Resetting database..."
        # Load environment variables for reset
        $envVars = @{}
        if (Test-Path ".env") {
            Get-Content ".env" | ForEach-Object {
                if ($_ -match "^([^=]+)=(.*)$") {
                    $envVars[$matches[1]] = $matches[2]
                }
            }
        }
        
        $dbHost = if ($envVars.DB_HOST) { $envVars.DB_HOST } else { "localhost" }
        $dbPort = if ($envVars.DB_PORT) { $envVars.DB_PORT } else { "5432" }
        $dbName = if ($envVars.DB_NAME) { $envVars.DB_NAME } else { "losalamos_chess" }
        $dbUser = if ($envVars.DB_USER) { $envVars.DB_USER } else { "postgres" }
        
        psql -h $dbHost -p $dbPort -U $dbUser -c "DROP DATABASE IF EXISTS $dbName;" postgres
        psql -h $dbHost -p $dbPort -U $dbUser -c "CREATE DATABASE $dbName;" postgres
        node database\setup.js
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Database reset failed" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Step 4: Testing Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Write-Host "Testing database connection..."
node database\test-connection.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Database connection test failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Running basic health check..."
if (Test-Path "server.js") {
    Write-Host "INFO: Server file found - setup appears complete" -ForegroundColor Blue
} else {
    Write-Host "WARNING: server.js not found - you may need to check project structure" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Step 5: Optional Data Seeding" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$seedData = Read-Host "Add test data for development? (y/N)"
if ($seedData -eq "y" -or $seedData -eq "Y") {
    Write-Host "Seeding database with test data..."
    node database\seed.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Seeding failed - continuing anyway" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "SUCCESS: Project setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Quick Reference:"
Write-Host "   npm start          - Start the server"
Write-Host "   npm run dev        - Start with auto-reload"
Write-Host "   npm run db:test    - Test database connection"
Write-Host "   npm run db:seed    - Add test data"
Write-Host "   scripts\validate-env.ps1   - Check environment"
Write-Host "   scripts\db-reset.ps1       - Reset database"
Write-Host ""

$startServer = Read-Host "Start the server now? (y/N)"
if ($startServer -eq "y" -or $startServer -eq "Y") {
    Write-Host "Starting server..."
    npm start
}

Write-Host ""
Write-Host "Welcome to the Los Alamos Chess project!" -ForegroundColor Green
Write-Host "INFO: Check README.md for more development information" -ForegroundColor Blue
Write-Host ""
Read-Host "Press Enter to finish"