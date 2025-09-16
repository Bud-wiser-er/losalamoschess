# Los Alamos Chess - Automation Scripts Guide

This document explains all the automation scripts available in the `/scripts` folder and how to use them effectively.

##  File Structure

```
/scripts/
├── PowerShell Scripts (.ps1) - RECOMMENDED for Windows PowerShell
│   ├── quick-setup.ps1           # Simple one-step setup
│   ├── validate-env.ps1          # Environment validation  
│   └── setup-project.ps1         # Full project setup
│
├── Batch Scripts (.cmd) - For Command Prompt users
│   ├── validate-env.cmd          # Environment validation
│   ├── fresh-install.cmd         # Clean dependency install
│   ├── db-reset.cmd              # Database reset
│   ├── setup-project.cmd         # Complete project setup
│   ├── db-status.cmd             # Quick database check
│   └── dev-start.cmd             # Start development server
│
└── Database Scripts (JavaScript)
    ├── /database/setup.js        # Create database schema
    └── /database/seed.js         # Add test data
```

##  Which Scripts Should You Use?

### **If you're using PowerShell (Windows 10/11 default):**
- Use `.ps1` files (PowerShell scripts)
- More reliable and better error handling
- Native Windows integration

### **If you're using Command Prompt (cmd):**
- Use `.cmd` files (Batch scripts)
- Traditional Windows batch files
- Works in older Windows environments

##  Quick Start Guide

### **New to the Project? Start Here:**

**1. First-time setup (PowerShell):**
```powershell
# Navigate to project folder
cd C:\YourProject\scripts

# Run quick setup
.\quick-setup.ps1
```

**2. First-time setup (Command Prompt):**
```cmd
cd C:\YourProject\scripts
setup-project.cmd
```

### **Daily Development:**

**PowerShell:**
```powershell
# Just start coding
.\quick-setup.ps1

# Or use npm directly
npm run dev
```

**Command Prompt:**
```cmd
dev-start.cmd
```

##  Detailed Script Reference

### **PowerShell Scripts (.ps1)**

#### `quick-setup.ps1`  **RECOMMENDED FOR DAILY USE**
**Purpose:** Simple, fast setup for daily development
**When to use:** Every time you start working
**What it does:**
- Checks Node.js and .env file
- Installs dependencies if missing
- Tests database connection
- Sets up database if needed
- Optionally starts development server

**Usage:**
```powershell
.\quick-setup.ps1
```

#### `validate-env.ps1`
**Purpose:** Comprehensive environment validation
**When to use:** When troubleshooting setup issues
**What it checks:**
- Node.js and npm versions
- PostgreSQL installation
- .env file and all variables
- Dependencies status

**Usage:**
```powershell
.\validate-env.ps1
```

#### `setup-project.ps1`
**Purpose:** Complete project setup for new team members
**When to use:** First time setting up the project
**What it does:**
- Full environment validation
- Dependency installation
- Database creation and schema setup
- Optional data seeding
- Server startup

**Usage:**
```powershell
.\setup-project.ps1
```

### **Batch Scripts (.cmd)**

#### `validate-env.cmd`
**Purpose:** Check all environment requirements
**Usage:**
```cmd
validate-env.cmd
```

#### `fresh-install.cmd`
**Purpose:** Clean reinstall of all dependencies
**When to use:** When npm packages are corrupted
**Usage:**
```cmd
fresh-install.cmd
```

#### `db-reset.cmd`
**Purpose:** Completely reset database to clean state
**When to use:** When database is corrupted or you need fresh start
** WARNING:** Deletes ALL data
**Usage:**
```cmd
db-reset.cmd
```

#### `setup-project.cmd`
**Purpose:** Complete project setup (batch version)
**Usage:**
```cmd
setup-project.cmd
```

#### `db-status.cmd`
**Purpose:** Quick database health check
**Usage:**
```cmd
db-status.cmd
```

#### `dev-start.cmd`
**Purpose:** Start development server with pre-flight checks
**Usage:**
```cmd
dev-start.cmd
```

### **Database Scripts (JavaScript)**

#### `database/setup.js`
**Purpose:** Create all database tables and indexes
**Usage:**
```powershell
node database\setup.js
# or
npm run db:setup
```

#### `database/seed.js`
**Purpose:** Add test users and sample game data
**Usage:**
```powershell
node database\seed.js
# or  
npm run db:seed
```

##  Common Scenarios

### **Scenario 1: I'm new to the project**
```powershell
# PowerShell (recommended)
cd C:\YourProject\scripts
.\setup-project.ps1

# Command Prompt
cd C:\YourProject\scripts
setup-project.cmd
```

### **Scenario 2: Daily development startup**
```powershell
# PowerShell - quick and simple
cd C:\YourProject\scripts
.\quick-setup.ps1

# Command Prompt
cd C:\YourProject\scripts
dev-start.cmd
```

### **Scenario 3: Something is broken**
```powershell
# Check what's wrong
cd C:\YourProject\scripts
.\validate-env.ps1

# Reset dependencies if needed
fresh-install.cmd    # (from Command Prompt)

# Reset database if needed  
db-reset.cmd         # (from Command Prompt)
```

### **Scenario 4: Database issues**
```powershell
# Quick database check
cd C:\YourProject\scripts
db-status.cmd        # (from Command Prompt)

# Full database reset
db-reset.cmd         # (from Command Prompt)

# Or manually
cd C:\YourProject
node database\setup.js
```

### **Scenario 5: Clean install for new team member**
```powershell
# Complete clean setup
cd C:\YourProject\scripts
.\setup-project.ps1  # (PowerShell)
# or
setup-project.cmd    # (Command Prompt)
```

##  NPM Scripts Available

These work from the project root:

```json
{
  "start": "node server.js",
  "dev": "nodemon server.js", 
  "db:setup": "node database/setup.js",
  "db:test": "node database/test-connection.js",
  "db:seed": "node database/seed.js",
  "test": "jest",
  "lint": "eslint ."
}
```

**Usage:**
```powershell
npm start       # Start server
npm run dev     # Start with auto-reload
npm run db:test # Test database
npm run db:seed # Add test data
```

##  Troubleshooting

### **PowerShell Execution Policy Error**
```powershell
# Fix: Allow scripts for current user
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with bypass
PowerShell -ExecutionPolicy Bypass -File .\quick-setup.ps1
```

### **Database Connection Failed**
1. Check PostgreSQL is running
2. Verify .env file credentials
3. Run `validate-env.ps1` to check configuration
4. Try `db-reset.cmd` for clean database

### **Dependencies Issues**
```cmd
# Clean reinstall
cd C:\YourProject\scripts
fresh-install.cmd
```

### **Script Won't Run in PowerShell**
- Use Command Prompt instead
- Or fix execution policy (see above)

##  Best Practices

### **For Daily Development:**
1. Use `quick-setup.ps1` for fast startup
2. Use `npm run dev` once everything is working

### **For New Team Members:**
1. Create `.env` file with database credentials
2. Run `setup-project.ps1` for complete setup
3. Everything should work after this

### **For Troubleshooting:**
1. Always run `validate-env.ps1` first
2. Check the specific error messages
3. Use individual scripts to fix specific issues

### **For Database Work:**
- Use `db-status.cmd` for quick checks
- Use `db-reset.cmd` when you need fresh data
- Use `npm run db:seed` to add test data

##  Security Notes

- `.env` files are never committed to Git (contains passwords)
- PowerShell scripts require execution policy change
- Database reset scripts delete ALL data - use carefully

##  Getting Help

If you're still having issues:

1. Run `validate-env.ps1` and check the output
2. Verify your `.env` file has all required variables
3. Check that PostgreSQL is running
4. Try the manual setup commands in the troubleshooting section

##  Quick Reference Card

**Most Common Commands:**

```powershell
# Daily startup (PowerShell)
.\scripts\quick-setup.ps1

# Daily startup (Command Prompt) 
.\scripts\dev-start.cmd

# Check environment
.\scripts\validate-env.ps1

# Reset database
.\scripts\db-reset.cmd

# Start server manually
npm run dev
```

---

**Save this file as `AUTOMATION-GUIDE.md` in your project root for easy reference!**