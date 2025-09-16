# validate-env.ps1 - Check environment setup
# Run from project root or scripts folder

# Navigate to project root if running from scripts folder
if (Test-Path "..\package.json") {
    Set-Location ..
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Los Alamos Chess - Environment Validator" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "[1/6] Checking Node.js installation..."
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "OK: Node.js found: $nodeVersion" -ForegroundColor Green
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Host "ERROR: Node.js not found! Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is installed
Write-Host ""
Write-Host "[2/6] Checking npm installation..."
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Host "OK: npm found: $npmVersion" -ForegroundColor Green
    } else {
        throw "npm not found"
    }
} catch {
    Write-Host "ERROR: npm not found! Please install npm" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if PostgreSQL is accessible
Write-Host ""
Write-Host "[3/6] Checking PostgreSQL installation..."
try {
    $psqlVersion = psql --version 2>$null
    if ($psqlVersion) {
        Write-Host "OK: PostgreSQL found: $psqlVersion" -ForegroundColor Green
    } else {
        throw "psql not found"
    }
} catch {
    Write-Host "WARNING: psql command not found - PostgreSQL may not be in PATH" -ForegroundColor Yellow
    Write-Host "INFO: Make sure PostgreSQL is installed and psql is in your PATH" -ForegroundColor Blue
}

# Check if .env file exists
Write-Host ""
Write-Host "[4/6] Checking .env file..."
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "INFO: Create .env file with database credentials" -ForegroundColor Blue
    Write-Host "INFO: Use .env.example as template if available" -ForegroundColor Blue
    Read-Host "Press Enter to exit"
    exit 1
} else {
    Write-Host "OK: .env file found" -ForegroundColor Green
}

# Load and check environment variables
Write-Host ""
Write-Host "[5/6] Checking environment variables..."

# Read .env file
$envVars = @{}
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            $envVars[$matches[1]] = $matches[2]
        }
    }
}

$missingVars = $false

# Check required variables
if (-not $envVars.DB_HOST) {
    Write-Host "ERROR: DB_HOST not set in .env" -ForegroundColor Red
    $missingVars = $true
} else {
    Write-Host "OK: DB_HOST: $($envVars.DB_HOST)" -ForegroundColor Green
}

if (-not $envVars.DB_PORT) {
    Write-Host "WARNING: DB_PORT not set - will use default 5432" -ForegroundColor Yellow
} else {
    Write-Host "OK: DB_PORT: $($envVars.DB_PORT)" -ForegroundColor Green
}

if (-not $envVars.DB_NAME) {
    Write-Host "ERROR: DB_NAME not set in .env" -ForegroundColor Red
    $missingVars = $true
} else {
    Write-Host "OK: DB_NAME: $($envVars.DB_NAME)" -ForegroundColor Green
}

if (-not $envVars.DB_USER) {
    Write-Host "ERROR: DB_USER not set in .env" -ForegroundColor Red
    $missingVars = $true
} else {
    Write-Host "OK: DB_USER: $($envVars.DB_USER)" -ForegroundColor Green
}

if (-not $envVars.DB_PASSWORD) {
    Write-Host "ERROR: DB_PASSWORD not set in .env" -ForegroundColor Red
    $missingVars = $true
} else {
    Write-Host "OK: DB_PASSWORD: [HIDDEN]" -ForegroundColor Green
}

if (-not $envVars.JWT_SECRET) {
    Write-Host "WARNING: JWT_SECRET not set - authentication may not work" -ForegroundColor Yellow
} else {
    Write-Host "OK: JWT_SECRET: [HIDDEN]" -ForegroundColor Green
}

if ($missingVars) {
    Write-Host ""
    Write-Host "ERROR: Missing required environment variables!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if node_modules exists
Write-Host ""
Write-Host "[6/6] Checking dependencies..."
if (-not (Test-Path "node_modules")) {
    Write-Host "WARNING: node_modules not found" -ForegroundColor Yellow
    Write-Host "INFO: Run 'npm install' or 'scripts\fresh-install.ps1' to install dependencies" -ForegroundColor Blue
} else {
    Write-Host "OK: node_modules found" -ForegroundColor Green
}

if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
} else {
    Write-Host "OK: package.json found" -ForegroundColor Green
}

Write-Host ""
Write-Host "SUCCESS: Environment validation completed successfully!" -ForegroundColor Green
Write-Host "INFO: Your environment appears to be properly configured" -ForegroundColor Blue
Write-Host ""
Read-Host "Press Enter to continue"