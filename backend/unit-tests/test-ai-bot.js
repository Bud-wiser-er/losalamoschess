// backend/unit-tests/test-ai-bot.js
// AI Bot Unit Tests for Los Alamos Chess - Node.js Version

console.log('='.repeat(60));
console.log('AI BOT COMPREHENSIVE TEST SUITE');
console.log('='.repeat(60));

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function test(description, testFunction, shouldPass = true) {
    totalTests++;
    try {
        const result = testFunction();
        if ((result && shouldPass) || (!result && !shouldPass)) {
            console.log(`  PASS: ${description}`);
            passedTests++;
            return true;
        } else {
            console.log(`  FAIL: ${description} - Expected ${shouldPass}, got ${result}`);
            failedTests.push(description);
            return false;
        }
    } catch (error) {
        if (shouldPass) {
            console.log(`  ERROR: ${description} - ${error.message}`);
            failedTests.push(`${description} (ERROR: ${error.message})`);
            return false;
        } else {
            console.log(`  PASS: ${description} - Expected error occurred`);
            passedTests++;
            return true;
        }
    }
}

// Async test helper
async function asyncTest(description, testFunction, shouldPass = true) {
    totalTests++;
    try {
        const result = await testFunction();
        if ((result && shouldPass) || (!result && !shouldPass)) {
            console.log(`  PASS: ${description}`);
            passedTests++;
            return true;
        } else {
            console.log(`  FAIL: ${description} - Expected ${shouldPass}, got ${result}`);
            failedTests.push(description);
            return false;
        }
    } catch (error) {
        if (shouldPass) {
            console.log(`  ERROR: ${description} - ${error.message}`);
            failedTests.push(`${description} (ERROR: ${error.message})`);
            return false;
        } else {
            console.log(`  PASS: ${description} - Expected error occurred`);
            passedTests++;
            return true;
        }
    }
}

// Load components
let AIBot, RulesEngine;

console.log('Loading components...');
try {
    AIBot = require('../src/ai-bot/index');
    console.log('AI Bot loaded successfully');
} catch (error) {
    console.log('WARNING: AI Bot not found:', error.message);
    console.log('This is expected if AI Bot is not implemented yet.');
    AIBot = null;
}

try {
    RulesEngine = require('../src/engine/index');
    console.log('Rules Engine loaded successfully');
} catch (error) {
    console.log('ERROR: Rules Engine not found:', error.message);
    console.log('Rules Engine is required for AI Bot tests.');
    process.exit(1);
}

const INITIAL_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

// Initialize components
const engine = new RulesEngine();
let aiBot = null;

if (AIBot) {
    try {
        aiBot = new AIBot();
    } catch (error) {
        console.log('ERROR: Could not create AI Bot instance:', error.message);
    }
}

console.log('\nAI BOT TEST GROUP 1: BASIC FUNCTIONALITY');
console.log('-'.repeat(40));

// Test 1.1: Basic AI Bot functionality
console.log('\n1.1 Basic AI Bot Tests:');

if (AIBot && aiBot) {
    test('AI Bot initialization', () => {
        return aiBot !== null;
    });

    test('AI Bot has strategies property', () => {
        return aiBot.strategies !== undefined;
    });

    if (aiBot.strategies) {
        test('All difficulty levels exist', () => {
            return aiBot.strategies.L0 && aiBot.strategies.L1 && 
                   aiBot.strategies.L2 && aiBot.strategies.L3;
        });
    }

} else {
    console.log('AI Bot not implemented yet - skipping AI Bot specific tests');
    console.log('Testing Rules Engine integration readiness...');
    
    test('Rules Engine available for AI Bot', () => {
        return engine !== null && typeof engine.validateMove === 'function';
    });

    test('Legal moves generation works', () => {
        const moves = engine.getLegalMoves(INITIAL_FEN);
        return Array.isArray(moves) && moves.length > 0;
    });

    console.log('Rules Engine is ready for AI Bot integration');
}

// Main async test runner
async function runAllAsyncTests() {
    if (!AIBot || !aiBot || !aiBot.generateMove) {
        console.log('\nSkipping async tests - AI Bot not fully implemented');
        return;
    }

    // Test 1.2: L0 Random Strategy Tests
    console.log('\n1.2 L0 Random Strategy Tests:');

    await asyncTest('L0 returns legal move', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L0',
            msCap: 1000
        });
        return response.ok === true && response.move !== undefined;
    });

    await asyncTest('L0 deterministic with seed', async () => {
        try {
            const r1 = await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                seed: 42,
                msCap: 1000
            });
            const r2 = await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                seed: 42,
                msCap: 1000
            });
            return r1.ok && r2.ok && r1.move === r2.move;
        } catch (error) {
            return false;
        }
    });

    // Test 1.3: Error Handling Tests
    console.log('\n1.3 Error Handling Tests:');

    await asyncTest('Invalid level rejected', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L99',
            msCap: 1000
        });
        return response.ok === false && response.error === 'INVALID_LEVEL';
    });

    await asyncTest('Missing parameters rejected', async () => {
        const response = await aiBot.generateMove({});
        return response.ok === false && response.error === 'INVALID_REQUEST';
    });

    // Test 1.4: Integration with Rules Engine
    console.log('\n1.4 Integration with Rules Engine:');

    await asyncTest('AI Bot moves are legal', async () => {
        try {
            const response = await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                msCap: 1000
            });
            
            if (!response.ok) return false;
            
            const validation = engine.validateMove(INITIAL_FEN, response.move);
            return validation && validation.valid === true;
        } catch (error) {
            return false;
        }
    });

    // Test 1.5: Strategy Tests
    console.log('\n1.5 Strategy Tests:');

    // Test L1 strategy
    await asyncTest('L1 strategy works', async () => {
        try {
            const l1Response = await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L1',
                msCap: 2000
            });
            
            if (l1Response.ok) {
                console.log(`    L1 details: depth=${l1Response.depth}, nodes=${l1Response.nodes}`);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    });

    // Test 1.6: Timeout Handling
    console.log('\n1.6 Timeout Handling Tests:');

    await asyncTest('Timeout respected', async () => {
        const start = Date.now();
        const timeoutResponse = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L0',
            msCap: 50
        });
        const elapsed = Date.now() - start;
        
        return timeoutResponse.ok && elapsed < 100;
    });
}

// Main execution function
async function runAllTests() {
    try {
        // Run async tests and wait for completion
        await runAllAsyncTests();
        
        // Print final results after ALL tests complete
        console.log('\n' + '='.repeat(60));
        console.log('AI BOT TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`Total tests: ${totalTests}`);
        console.log(`Tests passed: ${passedTests}`);
        console.log(`Tests failed: ${totalTests - passedTests}`);
        
        if (totalTests > 0) {
            console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
        }

        if (failedTests.length > 0) {
            console.log('\nFAILED TESTS:');
            failedTests.forEach((test, index) => {
                console.log(`${index + 1}. ${test}`);
            });
        } else {
            console.log('\nALL TESTS PASSED!');
        }

        if (!AIBot) {
            console.log('\nNOTE: AI Bot component not implemented yet.');
            console.log('Create the AI Bot component to enable full testing.');
        }

    } catch (error) {
        console.error('Test suite error:', error.message);
        process.exit(1);
    }
}

// Start the test suite
runAllTests();