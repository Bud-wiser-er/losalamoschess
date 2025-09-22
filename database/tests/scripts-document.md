# Los Alamos Chess Project - Scripts Documentation

## Overview

This document provides a comprehensive reference for all automation scripts included in the Los Alamos Chess project. These scripts facilitate project setup, database management, and daily development workflows for team members with varying levels of software development experience.

## Script Categories

### PowerShell Scripts (`/scripts/*.ps1`)
PowerShell scripts provide enhanced error handling, robust environment validation, and cross-platform compatibility. These are recommended for Windows 10/11 development environments.

### Batch Scripts (`/scripts/*.cmd`) 
Command Prompt batch scripts offer traditional Windows compatibility and work in environments where PowerShell execution policies may be restricted.

### Database Scripts (`/database/*.js`)
Node.js scripts that directly interface with the PostgreSQL database for schema management and data operations.

## Current Script Inventory

### Essential Scripts

#### `quick-setup.ps1` ⭐ **PRIMARY DAILY USE**
**Function:** Streamlined setup for routine development sessions  
**Operations:**
- Environment prerequisite validation (Node.js, .env configuration)
- Conditional dependency installation
- Database connectivity verification with automatic schema setup
- Optional development server initialization

**Recommendation:** Use as the standard daily startup script.

---

#### `setup-project.ps1` **COMPREHENSIVE SETUP**
**Function:** Complete project initialization for new team members  
**Operations:**
- Full environment validation via `validate-env.ps1`
- Comprehensive dependency management with reinstallation options
- Database creation, schema deployment, and connection testing
- Optional test data seeding
- Health check verification

**Recommendation:** Essential for initial project setup and onboarding.

---

#### `validate-env.ps1` **DIAGNOSTIC TOOL**
**Function:** Comprehensive environment validation and troubleshooting  
**Operations:**
- Software version verification (Node.js, npm, PostgreSQL)
- Configuration file validation (.env completeness)
- Database connectivity diagnostics
- Dependency status assessment

**Recommendation:** Critical for troubleshooting setup issues.

---

#### `db-reset.cmd` ⚠️ **DESTRUCTIVE RESET**
**Function:** Complete database reconstruction  
**Operations:**
- Database deletion and recreation
- Schema redeployment
- Connection verification

**Warning:** Destroys all existing data. Use only for development reset scenarios.

### Utility Scripts

#### `dev-start.cmd` **DEVELOPMENT LAUNCHER**
**Function:** Development server startup with pre-flight checks  
**Operations:**
- Basic environment verification
- Database connectivity testing
- Conditional database repair
- Development server initialization

---

#### `fresh-install.cmd` **DEPENDENCY RESET**
**Function:** Clean npm dependency reinstallation  
**Operations:**
- Complete removal of existing node_modules and package-lock.json
- Fresh dependency installation

**Use Case:** Resolving npm package conflicts or corruption.

---

### Database Management Scripts

#### `database/setup.js` **SCHEMA DEPLOYMENT**
**Function:** Database schema creation and table initialization  
**Technical Implementation:** Executes SQL commands from schema.sql file

#### `database/test-connection.js` **CONNECTION DIAGNOSTICS**
**Function:** Database connectivity verification with detailed status reporting  
**Output:** Connection parameters, PostgreSQL version, table inventory, troubleshooting guidance

#### `database/seed.js` **TEST DATA INSERTION**
**Function:** Development database population with sample data  
**Content:** Test users, sample games, example moves

## Script Redundancy Analysis

### Redundant Scripts
The following Command Prompt equivalents exist for PowerShell scripts:

- **`setup-project.cmd`** - Duplicates `setup-project.ps1` functionality
- **`validate-env.cmd`** - Duplicates `validate-env.ps1` functionality

**Recommendation:** Maintain both versions to support different development environment preferences and execution policy restrictions.

### Missing Scripts (Recommendations)

#### `db-backup.ps1` **SUGGESTED ADDITION**
**Purpose:** Create database backups before destructive operations
```powershell
# Proposed functionality
pg_dump -h $dbHost -p $dbPort -U $dbUser $dbName > backups/backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql
```

#### `health-check.ps1` **SUGGESTED ADDITION**
**Purpose:** Comprehensive system health verification
```powershell
# Proposed functionality
- All environment checks
- API endpoint testing
- Database performance verification
- Dependency vulnerability scanning
```

#### `project-clean.cmd` **SUGGESTED ADDITION**
**Purpose:** Complete project cleanup for redistribution
```cmd
# Proposed functionality
- Remove node_modules, logs, temporary files
- Reset database to clean state
- Clear development artifacts
```

## Workflow Recommendations

### New Developer Onboarding
```powershell
scripts\setup-project.ps1
```

### Daily Development Routine
```powershell
scripts\quick-setup.ps1
```

### Troubleshooting Workflow
```powershell
scripts\validate-env.ps1          # Diagnose issues
scripts\fresh-install.cmd         # Fix dependency problems
scripts\db-reset.cmd              # Reset database if corrupted
```

### Production Deployment Preparation
```powershell
npm run test:complete             # Comprehensive testing
scripts\health-check.ps1          # Proposed addition
npm run build                     # If applicable
```

## Technical Requirements

### Prerequisites
- Node.js 18.0.0+
- PostgreSQL 15.0+
- Windows PowerShell 5.1+ or PowerShell Core 7.0+
- Valid `.env` configuration file

### Environment Configuration
Scripts expect the following environment variables in `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=los_alamos_chess
DB_USER=postgres
DB_PASSWORD=<secure_password>
JWT_SECRET=<secure_secret>
PORT=3000
NODE_ENV=development
```

## Security Considerations

- Database reset scripts require PostgreSQL superuser privileges
- Scripts may prompt for database passwords in secure input mode
- Environment files containing credentials should not be committed to version control
- PowerShell execution policy must allow script execution for `.ps1` files

## Maintenance Notes

- Scripts are designed for development environments and require modification for production use
- Database backup procedures should be implemented before using destructive reset operations
- Regular validation of script functionality is recommended as project dependencies evolve
- Error handling includes user-friendly guidance for common failure scenarios

---

**Document Version:** 1.0  
**Last Updated:** September 2025  
**Maintainer:** EPE321 Development Team