#!/usr/bin/env node
// database/run-tests.js
// Main Test Runner for Los Alamos Chess Database Unit Tests
// Professional test suite following Group Design Document specifications
// Modified to save reports in /database/test_reports and work with tests in /database/tests/

const fs = require('fs');
const path = require('path');
const TestFramework = require('./test-framework');

// Try to import test registrations from the correct location
let registerCoreTests, registerAdvancedTests;

// Check if tests are in the tests/ subdirectory first, then fallback to current directory
try {
    const coreTestsPath = path.resolve(__dirname, 'tests', 'db-core-tests.js');
    const advancedTestsPath = path.resolve(__dirname, 'tests', 'db-advanced-tests.js');
    
    if (fs.existsSync(coreTestsPath)) {
        ({ registerCoreTests } = require('./tests/db-core-tests'));
        console.log('Loaded core tests from /database/tests/');
    } else {
        ({ registerCoreTests } = require('./db-core-tests'));
        console.log('Loaded core tests from /database/');
    }
    
    if (fs.existsSync(advancedTestsPath)) {
        ({ registerAdvancedTests } = require('./tests/db-advanced-tests'));
        console.log('Loaded advanced tests from /database/tests/');
    } else {
        ({ registerAdvancedTests } = require('./db-advanced-tests'));
        console.log('Loaded advanced tests from /database/');
    }
} catch (error) {
    console.error('ERROR: Could not load test files:', error.message);
    console.error('Make sure the test files exist in either /database/ or /database/tests/');
    process.exit(1);
}

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

/**
 * Print application banner
 */
function printBanner() {
    console.log(colors.cyan + colors.bright);
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    LOS ALAMOS CHESS                           ║');
    console.log('║                DATABASE UNIT TEST SUITE                       ║');
    console.log('║                                                               ║');
    console.log('║  EPE321 Software Engineering - Group 14                       ║');
    console.log('║  Database & Persistence Testing (Arno Meyer)                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);
}

/**
 * Display environment information
 */
function printEnvironmentInfo() {
    console.log(colors.blue + 'ENVIRONMENT INFORMATION:' + colors.reset);
    console.log(`Node.js Version: ${process.version}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Database: ${process.env.DB_NAME || 'losalamos_chess'}`);
    console.log(`Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
    console.log(`User: ${process.env.DB_USER || 'postgres'}`);
    console.log('');
}

/**
 * Check system prerequisites before running tests
 */
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

/**
 * Main database test execution function
 * Sets up test framework, registers tests, and runs all test suites
 */
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

/**
 * Generate comprehensive test report and save to test_reports directory
 * Only keeps the latest report (overwrites previous one)
 */
async function generateTestReport(results) {
    // Ensure test_reports directory exists
    const reportsDir = path.join(__dirname, 'test_reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
        console.log(`Created test_reports directory: ${reportsDir}`);
    }

    // Generate report filename - always the same to overwrite previous
    const reportPath = path.join(reportsDir, 'latest-test-report.md');
    
    // Generate detailed markdown report
    const reportContent = generateMarkdownReport(results);
    
    try {
        // Write report to file (overwrites previous)
        fs.writeFileSync(reportPath, reportContent, 'utf8');
        console.log('');
        console.log(colors.green + '📊 TEST REPORT GENERATED:' + colors.reset);
        console.log(`📄 Report saved: ${path.relative(process.cwd(), reportPath)}`);
        console.log(`📈 Coverage: ${results.coverage || 'N/A'}%`);
        console.log(`⏱️  Duration: ${results.duration || 'N/A'}ms`);
        
        // Also save a JSON version for potential API consumption
        const jsonReportPath = path.join(reportsDir, 'latest-test-results.json');
        fs.writeFileSync(jsonReportPath, JSON.stringify(results, null, 2), 'utf8');
        console.log(`📋 JSON report: ${path.relative(process.cwd(), jsonReportPath)}`);
        
    } catch (error) {
        console.error(colors.red + 'ERROR: Failed to write test report:' + colors.reset, error.message);
        console.error('Report content will be displayed in console instead.');
        console.log('\n' + reportContent);
    }
}

/**
 * Generate markdown formatted test report
 */
function generateMarkdownReport(results) {
    const timestamp = new Date().toISOString();
    const datePart = timestamp.split('T')[0];
    const timePart = timestamp.split('T')[1].split('.')[0];
    
    let report = `# Los Alamos Chess Database Test Report\n\n`;
    report += `**Generated:** ${datePart} at ${timePart} UTC\n`;
    report += `**Test Suite:** Database Unit Tests\n`;
    report += `**Maintainer:** Arno Meyer (Database & Persistence)\n\n`;
    
    // Summary Section
    report += `## Test Summary\n\n`;
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| **Total Tests** | ${results.passed + results.failed} |\n`;
    report += `| **Passed** | ${results.passed} |\n`;
    report += `| **Failed** | ${results.failed} |\n`;
    report += `| **Success Rate** | ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}% |\n`;
    report += `| **Duration** | ${results.duration || 'N/A'}ms |\n`;
    report += `| **Coverage** | ${results.coverage || 'N/A'}% |\n\n`;
    
    // Overall Status
    const status = results.failed === 0 ? '✅ PASS' : '❌ FAIL';
    const statusColor = results.failed === 0 ? 'green' : 'red';
    report += `### Overall Status: ${status}\n\n`;
    
    if (results.failed === 0) {
        report += `🎉 **All tests passed!** The database layer is ready for integration.\n\n`;
    } else {
        report += `⚠️ **${results.failed} test(s) failed.** Review required before integration.\n\n`;
    }
    
    // Test Details Section
    report += `## Test Details\n\n`;
    
    if (results.details && results.details.length > 0) {
        results.details.forEach(test => {
            const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⚠️';
            report += `### ${statusIcon} ${test.id}\n`;
            report += `**Status:** ${test.status}\n`;
            report += `**Message:** ${test.message}\n`;
            
            if (test.expected && test.actual) {
                report += `**Expected:** \`${JSON.stringify(test.expected)}\`\n`;
                report += `**Actual:** \`${JSON.stringify(test.actual)}\`\n`;
            }
            report += `\n`;
        });
    }
    
    // Failed Tests Section (if any)
    if (results.failed > 0 && results.errors) {
        report += `## ❌ Failed Tests\n\n`;
        results.errors.forEach(error => {
            report += `### ${error.id}\n`;
            report += `**Error:** ${error.message}\n`;
            if (error.expected && error.actual) {
                report += `**Expected:** \`${JSON.stringify(error.expected)}\`\n`;
                report += `**Actual:** \`${JSON.stringify(error.actual)}\`\n`;
            }
            if (error.stack) {
                report += `**Stack Trace:**\n\`\`\`\n${error.stack}\n\`\`\`\n`;
            }
            report += `\n`;
        });
    }
    
    // Recommendations Section
    report += `## 📋 Recommendations\n\n`;
    if (results.failed === 0) {
        report += `- ✅ Database layer is functioning correctly\n`;
        report += `- ✅ Ready for integration with other components\n`;
        report += `- ✅ All constraints and validations are working\n`;
        report += `- 🔄 Continue with integration testing\n`;
    } else {
        report += `- ❌ Fix failing tests before integration\n`;
        report += `- 🔍 Review error messages and stack traces\n`;
        report += `- 🛠️ Check database schema and connections\n`;
        report += `- 🔄 Re-run tests after fixes\n`;
    }
    
    report += `\n---\n`;
    report += `*Generated by Los Alamos Chess Database Test Suite*\n`;
    report += `*EPE321 Software Engineering - Group 14*\n`;
    
    return report;
}

/**
 * Main execution function
 */
async function main() {
    printBanner();
    printEnvironmentInfo();
    checkPrerequisites();
    
    console.log(colors.bright + 'STARTING DATABASE TESTS...' + colors.reset);
    console.log('');
    
    const startTime = Date.now();
    const exitCode = await runDatabaseTests();
    const endTime = Date.now();
    
    console.log('');
    console.log(colors.bright + `TESTS COMPLETED IN ${endTime - startTime}ms` + colors.reset);
    
    if (exitCode === 0) {
        console.log(colors.green + '🎉 ALL TESTS PASSED! Database ready for integration.' + colors.reset);
    } else {
        console.log(colors.red + '❌ SOME TESTS FAILED! Review required.' + colors.reset);
    }
    
    process.exit(exitCode);
}

// Execute if run directly (not imported as module)
if (require.main === module) {
    main().catch(error => {
        console.error(colors.red + 'UNEXPECTED ERROR:' + colors.reset, error);
        process.exit(1);
    });
}

module.exports = {
    runDatabaseTests,
    generateTestReport,
    checkPrerequisites
};