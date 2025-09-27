// database/test-framework.js
// Custom Database Testing Framework for Los Alamos Chess
// Provides transaction-based test isolation and comprehensive assertion library
// Modified to work with tests in /database/tests/ and save reports in /database/test_reports

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Custom Database Testing Framework
 * Provides isolated test execution with transaction rollback and detailed reporting
 */
class TestFramework {
    constructor() {
        this.pool = null;
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            errors: [],
            details: [],
            duration: 0,
            coverage: 0
        };
    }

    /**
     * Initialize the test framework with database connection
     */
    async initialize() {
        // Load environment variables
        require('dotenv').config();
        
        // Create database connection pool
        this.pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'losalamos_chess',
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 5432,
            max: 5, // Maximum connections in pool for testing
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });

        // Test database connection
        try {
            const client = await this.pool.connect();
            console.log('TEST FRAMEWORK: Database connection established');
            client.release();
        } catch (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    /**
     * Register a new test case
     * @param {string} id - Unique test identifier (e.g., 'DB-01')
     * @param {string} description - Human-readable test description
     * @param {function} testFunction - Async function that performs the test
     */
    addTest(id, description, testFunction) {
        this.tests.push({
            id,
            description,
            testFunction
        });
    }

    /**
     * Execute all registered tests with transaction isolation
     * Each test runs in its own transaction that is rolled back after completion
     */
    async runAllTests() {
        console.log('Starting test execution...');
        console.log('========================================');
        
        const startTime = Date.now();
        this.results = {
            passed: 0,
            failed: 0,
            errors: [],
            details: [],
            duration: 0,
            coverage: 0
        };

        for (const test of this.tests) {
            await this.runSingleTest(test);
        }

        const endTime = Date.now();
        this.results.duration = endTime - startTime;
        this.results.coverage = this.calculateCoverage();

        this.printSummary(this.results.duration);
        
        return this.results;
    }

    /**
     * Execute a single test case with proper isolation
     */
    async runSingleTest(test) {
        console.log(`Running ${test.id}: ${test.description}`);
        
        let client = null;
        try {
            client = await this.pool.connect();
            
            let result;
            
            // Run test in transaction for isolation
            if (test.testFunction.length > 0) {
                // Test expects a client parameter
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
     * Print comprehensive test results summary
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
     * Calculate estimated test coverage based on requirements
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
                // Map test IDs to coverage areas
                if (test.id.includes('DB-01') || test.id.includes('DB-02')) testedAreas.add('user_creation');
                if (test.id.includes('DB-03') || test.id.includes('DB-04')) testedAreas.add('game_creation');
                if (test.id.includes('DB-05')) testedAreas.add('optimistic_locking');
                if (test.id.includes('DB-07')) testedAreas.add('audit_logging');
                if (test.id.includes('DB-08')) testedAreas.add('constraints');
                if (test.id.includes('DB-10')) testedAreas.add('performance');
                if (test.id.includes('DB-11') || test.id.includes('DB-12')) testedAreas.add('data_integrity');
                // Add more mappings as needed
            }
        });
        
        return Math.round((testedAreas.size / requiredAreas.length) * 100);
    }

    /**
     * Cleanup database connections and resources
     */
    async cleanup() {
        if (this.pool) {
            await this.pool.end();
            console.log('TEST FRAMEWORK: Database connections closed');
        }
    }

    /**
     * Static assertion helper functions for test validation
     * Provides a comprehensive set of assertion methods for database testing
     */
    static assert = {
        /**
         * Assert that two values are equal
         */
        equals: (actual, expected, message = '') => {
            if (actual === expected) {
                return { success: true, message: `Assertion passed: ${message}`, expected, actual };
            } else {
                return { success: false, message: `Assertion failed: ${message}`, expected, actual };
            }
        },
        
        /**
         * Assert that a value is not null or undefined
         */
        notNull: (value, message = '') => {
            if (value !== null && value !== undefined) {
                return { success: true, message: `Not null assertion passed: ${message}` };
            } else {
                return { success: false, message: `Not null assertion failed: ${message}`, expected: 'non-null', actual: value };
            }
        },
        
        /**
         * Assert that an async function throws an expected error
         */
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
        
        /**
         * Assert that a condition is true
         */
        isTrue: (condition, message = '') => {
            if (condition === true) {
                return { success: true, message: `Condition is true: ${message}` };
            } else {
                return { success: false, message: `Condition is false: ${message}`, expected: true, actual: condition };
            }
        },
        
        /**
         * Assert that an array has the expected length
         */
        arrayLength: (array, expectedLength, message = '') => {
            if (Array.isArray(array) && array.length === expectedLength) {
                return { success: true, message: `Array length correct: ${message}` };
            } else {
                return { success: false, message: `Array length incorrect: ${message}`, expected: expectedLength, actual: array ? array.length : 'not array' };
            }
        },

        /**
         * Assert that a value is within a numeric range
         */
        inRange: (value, min, max, message = '') => {
            if (typeof value === 'number' && value >= min && value <= max) {
                return { success: true, message: `Value in range: ${message}` };
            } else {
                return { success: false, message: `Value out of range: ${message}`, expected: `${min}-${max}`, actual: value };
            }
        },

        /**
         * Assert that a string contains expected substring
         */
        contains: (haystack, needle, message = '') => {
            if (typeof haystack === 'string' && haystack.includes(needle)) {
                return { success: true, message: `String contains expected value: ${message}` };
            } else {
                return { success: false, message: `String does not contain expected value: ${message}`, expected: needle, actual: haystack };
            }
        },

        /**
         * Assert that a value matches a regular expression
         */
        matches: (value, regex, message = '') => {
            if (typeof value === 'string' && regex.test(value)) {
                return { success: true, message: `Value matches pattern: ${message}` };
            } else {
                return { success: false, message: `Value does not match pattern: ${message}`, expected: regex.toString(), actual: value };
            }
        }
    };
}

module.exports = TestFramework;