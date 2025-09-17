// database/test-framework.js
// Professional Unit Test Framework for Los Alamos Chess Database
// Based on EPE321 Group Design Document Specifications

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class TestFramework {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            errors: [],
            details: []
        };
        this.pool = null;
    }

    /**
     * Initialize test database connection
     */
    async initialize() {
        require('dotenv').config();
        
        this.pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'losalamos_chess',
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT) || 5432,
            max: 5 // Limit connections for testing
        });

        // Test connection
        try {
            const client = await this.pool.connect();
            client.release();
            console.log('TEST FRAMEWORK: Database connection established');
        } catch (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    /**
     * Register a test case
     */
    addTest(testId, description, testFunction, preconditions = null) {
        this.tests.push({
            id: testId,
            description,
            testFunction,
            preconditions
        });
    }

    /**
     * Execute all registered tests
     */
    async runAllTests() {
        console.log('========================================');
        console.log('LOS ALAMOS CHESS - DATABASE UNIT TESTS');
        console.log('========================================');
        console.log(`Running ${this.tests.length} test cases...`);
        console.log('');

        const startTime = Date.now();

        for (const test of this.tests) {
            await this.runSingleTest(test);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        this.printSummary(duration);
        return this.results;
    }

   /**
     * Run a single test case with improved error handling
     */
    async runSingleTest(test) {
        let client = null;
        
        try {
            console.log(`[${test.id}] ${test.description}`);
            
            // Setup preconditions if specified
            if (test.preconditions) {
                console.log(`  Setting up preconditions...`);
                await test.preconditions();
            }

            client = await this.pool.connect();
            
            // For tests that expect constraint violations, don't use transactions
            const expectsConstraintViolation = test.id === 'DB-02' || test.id === 'DB-08' || 
                                             test.id === 'DB-11' || test.id === 'DB-14';
            
            let result;
            
            if (expectsConstraintViolation) {
                // Run without transaction for constraint-testing tests
                result = await test.testFunction(client);
            } else {
                // Use transaction for other tests
                await client.query('BEGIN');
                try {
                    result = await test.testFunction(client);
                    await client.query('ROLLBACK'); // Always rollback to keep tests isolated
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                }
            }
            
            if (result.success) {
                console.log(`  PASS: ${result.message}`);
                this.results.passed++;
                this.results.details.push({
                    id: test.id,
                    status: 'PASS',
                    message: result.message,
                    expected: result.expected,
                    actual: result.actual
                });
            } else {
                console.log(`  FAIL: ${result.message}`);
                this.results.failed++;
                this.results.errors.push({
                    id: test.id,
                    message: result.message,
                    expected: result.expected,
                    actual: result.actual
                });
                this.results.details.push({
                    id: test.id,
                    status: 'FAIL',
                    message: result.message,
                    expected: result.expected,
                    actual: result.actual
                });
            }
            
        } catch (error) {
            console.log(`  ERROR: ${error.message}`);
            this.results.failed++;
            this.results.errors.push({
                id: test.id,
                message: `Test execution error: ${error.message}`,
                stack: error.stack
            });
            this.results.details.push({
                id: test.id,
                status: 'ERROR',
                message: error.message
            });
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    /**
     * Print test results summary
     */
    printSummary(duration) {
        console.log('');
        console.log('========================================');
        console.log('TEST RESULTS SUMMARY');
        console.log('========================================');
        console.log(`Total Tests: ${this.tests.length}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Success Rate: ${((this.results.passed / this.tests.length) * 100).toFixed(1)}%`);
        console.log(`Duration: ${duration}ms`);
        
        // Coverage assessment
        const coverage = this.calculateCoverage();
        console.log(`Estimated Coverage: ${coverage}%`);
        
        if (this.results.failed > 0) {
            console.log('');
            console.log('FAILED TESTS:');
            console.log('-------------');
            this.results.errors.forEach(error => {
                console.log(`[${error.id}] ${error.message}`);
                if (error.expected && error.actual) {
                    console.log(`  Expected: ${JSON.stringify(error.expected)}`);
                    console.log(`  Actual: ${JSON.stringify(error.actual)}`);
                }
            });
        }
        
        console.log('');
        console.log(this.results.passed === this.tests.length ? 
            'ALL TESTS PASSED - DATABASE READY FOR INTEGRATION' : 
            'SOME TESTS FAILED - REVIEW REQUIRED');
    }

    /**
     * Calculate estimated test coverage
     */
    calculateCoverage() {
        // Based on Group Design Document requirements
        const requiredAreas = [
            'user_creation', 'user_validation', 'user_lookup',
            'game_creation', 'game_state', 'move_validation',
            'audit_logging', 'optimistic_locking', 'constraints',
            'performance', 'data_integrity'
        ];
        
        const testedAreas = new Set();
        this.results.details.forEach(test => {
            if (test.status === 'PASS') {
                if (test.id.includes('DB-01') || test.id.includes('DB-02')) testedAreas.add('user_creation');
                if (test.id.includes('DB-03') || test.id.includes('DB-04')) testedAreas.add('game_creation');
                if (test.id.includes('DB-05')) testedAreas.add('optimistic_locking');
                if (test.id.includes('DB-07')) testedAreas.add('audit_logging');
                // Add more mappings as needed
            }
        });
        
        return Math.round((testedAreas.size / requiredAreas.length) * 100);
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.pool) {
            await this.pool.end();
            console.log('TEST FRAMEWORK: Database connections closed');
        }
    }

    /**
     * Assert helper functions
     */
    static assert = {
        equals: (actual, expected, message = '') => {
            if (actual === expected) {
                return { success: true, message: `Assertion passed: ${message}`, expected, actual };
            } else {
                return { success: false, message: `Assertion failed: ${message}`, expected, actual };
            }
        },
        
        notNull: (value, message = '') => {
            if (value !== null && value !== undefined) {
                return { success: true, message: `Not null assertion passed: ${message}` };
            } else {
                return { success: false, message: `Not null assertion failed: ${message}`, expected: 'non-null', actual: value };
            }
        },
        
        throws: async (asyncFunction, expectedError, message = '') => {
            try {
                await asyncFunction();
                return { success: false, message: `Expected error but none thrown: ${message}`, expected: expectedError, actual: 'no error' };
            } catch (error) {
                if (error.message.includes(expectedError)) {
                    return { success: true, message: `Correctly threw expected error: ${message}` };
                } else {
                    return { success: false, message: `Wrong error thrown: ${message}`, expected: expectedError, actual: error.message };
                }
            }
        },
        
        isTrue: (condition, message = '') => {
            if (condition === true) {
                return { success: true, message: `Condition is true: ${message}` };
            } else {
                return { success: false, message: `Condition is false: ${message}`, expected: true, actual: condition };
            }
        },
        
        arrayLength: (array, expectedLength, message = '') => {
            if (Array.isArray(array) && array.length === expectedLength) {
                return { success: true, message: `Array length correct: ${message}` };
            } else {
                return { success: false, message: `Array length incorrect: ${message}`, expected: expectedLength, actual: array ? array.length : 'not array' };
            }
        }
    };
}

module.exports = TestFramework;