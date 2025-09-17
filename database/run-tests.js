#!/usr/bin/env node
// database/run-tests.js
// Main Test Runner for Los Alamos Chess Database Unit Tests
// Professional test suite following Group Design Document specifications

const fs = require('fs');
const path = require('path');
const TestFramework = require('./test-framework');
const { registerCoreTests } = require('./tests/db-core-tests');
const { registerAdvancedTests } = require('./tests/db-advanced-tests');

// ANSI color codes for better output formatting
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function printBanner() {
    console.log(colors.cyan + colors.bright);
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    LOS ALAMOS CHESS                          ║');
    console.log('║                DATABASE UNIT TEST SUITE                       ║');
    console.log('║                                                               ║');
    console.log('║  EPE321 Software Engineering - Group 14                      ║');
    console.log('║  Database & Persistence Testing (Arno Meyer)                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);
}

function printEnvironmentInfo() {
    console.log(colors.blue + 'ENVIRONMENT INFORMATION:' + colors.reset);
    console.log(`Node.js Version: ${process.version}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Database: ${process.env.DB_NAME || 'losalamos_chess'}`);
    console.log(`Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
    console.log(`User: ${process.env.DB_USER || 'postgres'}`);
    console.log('');
}

function checkPrerequisites() {
    console.log(colors.yellow + 'CHECKING PREREQUISITES:' + colors.reset);
    
    const requirements = [
        { name: '.env file', check: () => fs.existsSync('.env') },
        { name: 'bcrypt package', check: () => {
            try { require('bcrypt'); return true; } catch { return false; }
        }},
        { name: 'pg package', check: () => {
            try { require('pg'); return true; } catch { return false; }
        }},
        { name: 'Database schema', check: () => fs.existsSync('./database/schema.sql') }
    ];

    let allPassed = true;
    for (const req of requirements) {
        const passed = req.check();
        console.log(`${passed ? '✓' : '✗'} ${req.name}: ${passed ? colors.green + 'OK' + colors.reset : colors.red + 'MISSING' + colors.reset}`);
        if (!passed) allPassed = false;
    }

    if (!allPassed) {
        console.log(colors.red + '\nERROR: Prerequisites not met. Please ensure:' + colors.reset);
        console.log('1. .env file exists with database credentials');
        console.log('2. npm install has been run (bcrypt, pg packages)');
        console.log('3. Database schema is set up (run: node database/setup.js)');
        console.log('4. PostgreSQL is running');
        process.exit(1);
    }
    
    console.log(colors.green + 'All prerequisites met!' + colors.reset);
    console.log('');
}

async function runDatabaseTests() {
    const framework = new TestFramework();
    
    try {
        // Initialize framework
        console.log(colors.yellow + 'Initializing test framework...' + colors.reset);
        await framework.initialize();
        
        // Register all test suites
        console.log('Registering test suites...');
        registerCoreTests(framework);
        registerAdvancedTests(framework);
        
        console.log(`Registered ${framework.tests.length} test cases`);
        console.log('');

        // Run tests
        const results = await framework.runAllTests();
        
        // Generate detailed report
        await generateTestReport(results);
        
        // Return exit code based on results
        return results.failed === 0 ? 0 : 1;
        
    } catch (error) {
        console.error(colors.red + 'FATAL ERROR:' + colors.reset, error.message);
        console.error('Stack trace:', error.stack);
        return 1;
    } finally {
        await framework.cleanup();
    }
}

async function generateTestReport(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `test-report-${timestamp}.md`);
    
    let report = '# Los Alamos Chess - Database Unit Test Report\n\n';
    report += `**Generated:** ${new Date().toLocaleString()}\n`;
    report += `**Total Tests:** ${results.passed + results.failed}\n`;
    report += `**Passed:** ${results.passed}\n`;
    report += `**Failed:** ${results.failed}\n`;
    report += `**Success Rate:** ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%\n\n`;
    
    // Requirements compliance check
    report += '## Requirements Compliance\n\n';
    report += 'Based on EPE321 Group Design Document Table 3:\n\n';
    
    const requirementMapping = {
        'DB-01': 'User Creation with Password Hashing',
        'DB-02': 'Duplicate Email Prevention',
        'DB-03': 'Game Creation with Initial State',
        'DB-04': 'Move Addition with Version Control',
        'DB-05': 'Optimistic Locking (Version Conflicts)',
        'DB-06': 'Game History with Ordering',
        'DB-07': 'Audit Logging on Mutations'
    };
    
    Object.entries(requirementMapping).forEach(([testId, description]) => {
        const testResult = results.details.find(detail => detail.id === testId);
        const status = testResult ? (testResult.status === 'PASS' ? '✅' : '❌') : '⚠️';
        report += `- ${status} **${testId}:** ${description}\n`;
    });
    
    report += '\n## Test Details\n\n';
    results.details.forEach(detail => {
        report += `### ${detail.id} - ${detail.status}\n`;
        report += `**Message:** ${detail.message}\n`;
        if (detail.expected && detail.actual) {
            report += `**Expected:** ${JSON.stringify(detail.expected)}\n`;
            report += `**Actual:** ${JSON.stringify(detail.actual)}\n`;
        }
        report += '\n';
    });
    
    if (results.failed > 0) {
        report += '## Failed Tests Analysis\n\n';
        results.errors.forEach(error => {
            report += `### ${error.id}\n`;
            report += `**Error:** ${error.message}\n`;
            if (error.stack) {
                report += '```\n' + error.stack + '\n```\n';
            }
            report += '\n';
        });
    }
    
    report += '## Recommendations\n\n';
    if (results.failed === 0) {
        report += '- ✅ All tests passed - Database is ready for team integration\n';
        report += '- ✅ Ready for Byron\'s Rules Engine integration\n';
        report += '- ✅ Ready for Elizabeth\'s Security layer\n';
        report += '- ✅ Ready for Ethan\'s WebSocket integration\n';
    } else {
        report += '- ❌ Some tests failed - Review and fix issues before integration\n';
        report += '- 🔧 Check database schema and constraints\n';
        report += '- 🔧 Verify PostgreSQL configuration\n';
        report += '- 🔧 Review error messages above for specific issues\n';
    }
    
    try {
        fs.writeFileSync(reportPath, report);
        console.log(colors.cyan + `\nDETAILED REPORT GENERATED: ${reportPath}` + colors.reset);
    } catch (error) {
        console.log(colors.yellow + `Warning: Could not generate detailed report: ${error.message}` + colors.reset);
    }
}

function printUsageInfo() {
    console.log(colors.blue + 'USAGE INFORMATION:' + colors.reset);
    console.log('Run from project root:');
    console.log('  node database/run-tests.js');
    console.log('');
    console.log('Or use npm script (add to package.json):');
    console.log('  "scripts": { "test:db": "node database/run-tests.js" }');
    console.log('  npm run test:db');
    console.log('');
    console.log(colors.blue + 'WINDOWS COMMANDS:' + colors.reset);
    console.log('Command Prompt:');
    console.log('  cd C:\\YourProject');
    console.log('  node database\\run-tests.js');
    console.log('');
    console.log('PowerShell:');
    console.log('  cd C:\\YourProject');
    console.log('  node database/run-tests.js');
    console.log('');
}

// Main execution
async function main() {
    printBanner();
    printEnvironmentInfo();
    checkPrerequisites();
    printUsageInfo();
    
    console.log(colors.bright + 'Starting database unit tests...' + colors.reset);
    console.log('');
    
    const exitCode = await runDatabaseTests();
    
    console.log('');
    if (exitCode === 0) {
        console.log(colors.green + colors.bright + 'SUCCESS: All database tests completed successfully!' + colors.reset);
        console.log('Database is ready for team integration.');
    } else {
        console.log(colors.red + colors.bright + 'FAILURE: Some database tests failed.' + colors.reset);
        console.log('Please review the errors above and fix issues before proceeding.');
    }
    
    process.exit(exitCode);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error(colors.red + 'Unhandled promise rejection:' + colors.reset, reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(colors.red + 'Uncaught exception:' + colors.reset, error);
    process.exit(1);
});

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { main, runDatabaseTests };