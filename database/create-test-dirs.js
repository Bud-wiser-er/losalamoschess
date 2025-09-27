// database/create-test-dirs.js
// Creates the necessary directory structure for database tests

const fs = require('fs');
const path = require('path');

function createTestStructure() {
    console.log('Creating database test directory structure...\n');
    
    try {
        // Define directories relative to current working directory
        const baseDir = process.cwd();
        const directories = [
            path.join(baseDir, 'database', 'tests'),
            path.join(baseDir, 'database', 'reports'),
            path.join(baseDir, 'database', 'logs')
        ];

        // Create directories
        directories.forEach(dir => {
            try {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`Created directory: ${path.relative(baseDir, dir)}`);
                } else {
                    console.log(`- Directory already exists: ${path.relative(baseDir, dir)}`);
                }
            } catch (error) {
                console.error(`Failed to create directory ${dir}: ${error.message}`);
            }
        });
        
        console.log('');
        
        // Create placeholder files
        const files = [
            {
                path: path.join(baseDir, 'database', 'tests', '.gitkeep'),
                content: '# Test files directory\n# This file ensures the tests directory is tracked by git\n'
            },
            {
                path: path.join(baseDir, 'database', 'reports', '.gitkeep'),
                content: '# Test reports directory\n# Generated test reports will be saved here\n'
            },
            {
                path: path.join(baseDir, 'database', 'logs', '.gitkeep'),
                content: '# Test logs directory\n# Test execution logs will be saved here\n'
            }
        ];

        files.forEach(file => {
            try {
                if (!fs.existsSync(file.path)) {
                    fs.writeFileSync(file.path, file.content, 'utf8');
                    console.log(`Created file: ${path.relative(baseDir, file.path)}`);
                } else {
                    console.log(`- File already exists: ${path.relative(baseDir, file.path)}`);
                }
            } catch (error) {
                console.error(`✗ Failed to create file ${file.path}: ${error.message}`);
            }
        });
        
        console.log('\nDatabase test structure created successfully');
        console.log('\nYour directory structure:');
        console.log('database/');
        console.log('├── tests/');
        console.log('├── reports/');
        console.log('├── logs/');
        console.log('├── test-framework.js');
        console.log('├── run-tests.js');
        console.log('└── create-test-dirs.js');
        console.log('\nNext steps:');
        console.log('1. Run: node database/run-tests.js');
        console.log('2. Check generated reports in database/reports/');
        console.log('3. Review test results and fix any issues');
        
    } catch (error) {
        console.error('ERROR: Failed to create test structure:', error.message);
        console.error('Make sure you are running this from your project root directory.');
        process.exit(1);
    }
}

// Check if running from correct directory
function checkWorkingDirectory() {
    const currentDir = process.cwd();
    const packageJsonPath = path.join(currentDir, 'package.json');
    const databaseDir = path.join(currentDir, 'database');
    
    if (!fs.existsSync(packageJsonPath)) {
        console.warn('WARNING: package.json not found in current directory.');
        console.warn('Make sure you are running this from your project root directory.');
    }
    
    if (!fs.existsSync(databaseDir)) {
        console.error('ERROR: database directory not found.');
        console.error('Please ensure you are in your project root directory.');
        console.error(`Current directory: ${currentDir}`);
        process.exit(1);
    }
    
    console.log(`Working in: ${currentDir}`);
    console.log('');
}

if (require.main === module) {
    console.log('Database Test Structure Setup');
    console.log('============================');
    checkWorkingDirectory();
    createTestStructure();
}

module.exports = { createTestStructure };