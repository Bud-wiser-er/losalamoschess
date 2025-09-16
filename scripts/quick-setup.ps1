# quick-setup.ps1 - Simple setup script for immediate use
# Run from project root or scripts folder

# Navigate to project root if running from scripts folder
if (Test-Path "..\package.json") {
    Set-Location ..
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Los Alamos Chess - Quick Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check basic requirements
Write-Host "Checking basic requirements..."

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "OK: Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found" -ForegroundColor Red
    exit 1
}

# Check .env file
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env file missing" -ForegroundColor Red
    Write-Host "INFO: Create a .env file with your database credentials" -ForegroundColor Blue
    exit 1
} else {
    Write-Host "OK: .env file found" -ForegroundColor Green
}

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "OK: Dependencies already installed" -ForegroundColor Green
}

# Test database connection
Write-Host ""
Write-Host "Testing database connection..."
node database\test-connection.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Database connection failed - trying to set up database..." -ForegroundColor Yellow
    
    # Try to set up database
    if (Test-Path "database\setup.js") {
        node database\setup.js
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK: Database setup completed" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Database setup failed" -ForegroundColor Red
            Write-Host "INFO: You may need to create the database manually" -ForegroundColor Blue
            exit 1
        }
    } else {
        Write-Host "ERROR: database\setup.js not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "OK: Database connection successful" -ForegroundColor Green
}

Write-Host ""
Write-Host "SUCCESS: Quick setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run:"
Write-Host "  npm start    - Start the server"
Write-Host "  npm run dev  - Start with auto-reload"
Write-Host ""

$choice = Read-Host "Start development server now? (y/N)"
if ($choice -eq "y" -or $choice -eq "Y") {
    npm run dev
}