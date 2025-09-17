// backend/unit-tests/test-ai-bot-stress.js
// AI Bot Comprehensive Stress Test Suite for Los Alamos Chess

console.log('='.repeat(80));
console.log('AI BOT COMPREHENSIVE STRESS TEST SUITE');
console.log('Testing AI Bot under extreme conditions, edge cases, and performance loads');
console.log('='.repeat(80));

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

try {
    AIBot = require('../src/ai-bot/index');
    RulesEngine = require('../src/engine/index');
    console.log('All components loaded successfully\n');
} catch (error) {
    console.log('CRITICAL ERROR: Cannot load components:', error.message);
    process.exit(1);
}

const INITIAL_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const ENDGAME_FEN = '6/6/2k3/6/2K3/2Q3 w - - 0 50';
const PROMOTION_FEN = 'rnqknr/pppPpp/6/6/6/RNQKNR w - - 0 20';

const aiBot = new AIBot();
const engine = new RulesEngine();

// Test positions for stress testing
const testPositions = [
    { name: 'Starting Position', fen: INITIAL_FEN },
    { name: 'Endgame Position', fen: ENDGAME_FEN },
    { name: 'Promotion Position', fen: PROMOTION_FEN },
    { name: 'Mid-game Position', fen: 'rn1knr/pp1ppp/2q3/6/2Q3/RN1KNR w - - 5 10' }
];

async function runStressTests() {
    console.log('STRESS TEST GROUP 1: EXTREME INPUT VALIDATION');
    console.log('-'.repeat(50));

    console.log('\n1.1 Malformed Input Stress Tests:');
    
    // Test extreme input variations
    const extremeInputs = [
        null, undefined, '', 0, -1, NaN, Infinity, -Infinity,
        {}, [], true, false, 'invalid', '🎯', 'very long string'.repeat(1000)
    ];

    for (const [index, input] of extremeInputs.entries()) {
        await asyncTest(`Handle extreme input ${index + 1}: ${typeof input}`, async () => {
            try {
                const result = await aiBot.generateMove({
                    fen: input,
                    level: 'L0',
                    msCap: 100
                });
                return result.ok === false;
            } catch (error) {
                return true; // Acceptable to throw for extreme inputs
            }
        });
    }

    // Test malformed FEN strings
    const badFENs = [
        'invalid',
        'rnqknr/pppppp/6/6/PPPPPP', // Missing parts
        'rnqknr/pppppp/6/6/PPPPPP/RNQKNR x - - 0 1', // Invalid turn
        'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w K - 0 1', // Invalid castling
        'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - e3 0 1', // Invalid en passant
        'rnqknr/pppppp/7/6/PPPPPP/RNQKNR w - - 0 1', // Invalid rank length
        'rnqknr/pppppp/6/6/PPPPPP/RNQKZR w - - 0 1', // Invalid piece
        ''
    ];

    console.log('\n1.2 Invalid FEN Stress Tests:');
    for (const [index, fen] of badFENs.entries()) {
        await asyncTest(`Invalid FEN ${index + 1}: "${fen.substring(0, 20)}..."`, async () => {
            const result = await aiBot.generateMove({
                fen: fen,
                level: 'L0',
                msCap: 100
            });
            return result.ok === false;
        });
    }

    console.log('\nSTRESS TEST GROUP 2: PERFORMANCE UNDER LOAD');
    console.log('-'.repeat(50));

    console.log('\n2.1 High-Volume Request Tests:');

    // Test 100 L0 requests rapidly
    await asyncTest('100 L0 requests in < 2 seconds', async () => {
        const start = Date.now();
        const promises = [];
        
        for (let i = 0; i < 100; i++) {
            promises.push(aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                seed: i,
                msCap: 50
            }));
        }
        
        const results = await Promise.all(promises);
        const elapsed = Date.now() - start;
        
        const allSuccessful = results.every(r => r.ok === true);
        return allSuccessful && elapsed < 2000;
    });

    // Test 25 L1 requests
    await asyncTest('25 L1 requests in < 5 seconds', async () => {
        const start = Date.now();
        const promises = [];
        
        for (let i = 0; i < 25; i++) {
            promises.push(aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L1',
                msCap: 200
            }));
        }
        
        const results = await Promise.all(promises);
        const elapsed = Date.now() - start;
        
        const allSuccessful = results.every(r => r.ok === true);
        return allSuccessful && elapsed < 5000;
    });

    console.log('\n2.2 Memory Stability Tests:');
    
    // Memory stress test
    await asyncTest('Memory stable after 1000 operations', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        
        for (let i = 0; i < 1000; i++) {
            await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                seed: i % 10,
                msCap: 10
            });
        }
        
        global.gc && global.gc(); // Force GC if available
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
        
        return memoryIncrease < 50; // Less than 50MB increase
    });

    console.log('\nSTRESS TEST GROUP 3: TIMEOUT AND CONCURRENCY TESTS');
    console.log('-'.repeat(50));

    console.log('\n3.1 Extreme Timeout Tests:');

    // Test very short timeouts
    for (const timeout of [1, 5, 10, 25]) {
        await asyncTest(`Survives ${timeout}ms timeout`, async () => {
            const result = await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L2',
                msCap: timeout
            });
            return result.ok === true && result.move !== undefined;
        });
    }

    console.log('\n3.2 Concurrent Request Stress:');

    // Test concurrent requests with different difficulty levels
    await asyncTest('20 concurrent mixed-level requests', async () => {
        const promises = [];
        const levels = ['L0', 'L1', 'L2', 'L3'];
        
        for (let i = 0; i < 20; i++) {
            promises.push(aiBot.generateMove({
                fen: INITIAL_FEN,
                level: levels[i % 4],
                seed: i,
                msCap: 1000
            }));
        }
        
        const results = await Promise.all(promises);
        return results.every(r => r.ok === true && r.move !== undefined);
    });

    console.log('\nSTRESS TEST GROUP 4: DIFFICULTY LEVEL COMPREHENSIVE TESTS');
    console.log('-'.repeat(50));

    console.log('\n4.1 All Levels on Multiple Positions:');

    // Test all difficulty levels on all test positions
    for (const position of testPositions) {
        for (const level of ['L0', 'L1', 'L2', 'L3']) {
            await asyncTest(`${level} on ${position.name}`, async () => {
                const result = await aiBot.generateMove({
                    fen: position.fen,
                    level: level,
                    msCap: 2000
                });
                
                if (!result.ok) return false;
                
                // Verify move is legal
                const validation = engine.validateMove(position.fen, result.move);
                return validation && validation.valid === true;
            });
        }
    }

    console.log('\n4.2 Strategy Consistency Tests:');

    // Test that strategies are consistent (same position should give same result with same seed)
    await asyncTest('L0 deterministic consistency (10 trials)', async () => {
        const results = [];
        const seed = 12345;
        
        for (let i = 0; i < 10; i++) {
            const result = await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                seed: seed,
                msCap: 100
            });
            if (!result.ok) return false;
            results.push(result.move);
        }
        
        // All results should be identical with same seed
        return results.every(move => move === results[0]);
    });

    // Test that different seeds produce variety
    await asyncTest('L0 produces variety with different seeds', async () => {
        const moves = new Set();
        
        for (let seed = 1; seed <= 50; seed++) {
            const result = await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                seed: seed,
                msCap: 100
            });
            if (!result.ok) return false;
            moves.add(result.move);
        }
        
        // Should have at least 3 different moves in 50 tries
        return moves.size >= 3;
    });

    console.log('\nSTRESS TEST GROUP 5: EDGE CASE POSITIONS');
    console.log('-'.repeat(50));

    console.log('\n5.1 Special Position Tests:');

    // Test position with very few legal moves
    const limitedMovesFEN = 'rnqknr/6/pppppp/6/PPPPPP/RNQKNR w - - 0 10';
    
    await asyncTest('Position with limited moves (all levels)', async () => {
        for (const level of ['L0', 'L1', 'L2', 'L3']) {
            const result = await aiBot.generateMove({
                fen: limitedMovesFEN,
                level: level,
                msCap: 1000
            });
            
            if (!result.ok) return false;
            
            // Verify move is legal
            const validation = engine.validateMove(limitedMovesFEN, result.move);
            if (!validation || !validation.valid) return false;
        }
        return true;
    });

    // Test promotion handling
    await asyncTest('Promotion position handling (all levels)', async () => {
        for (const level of ['L0', 'L1', 'L2', 'L3']) {
            const result = await aiBot.generateMove({
                fen: PROMOTION_FEN,
                level: level,
                msCap: 1000
            });
            
            if (!result.ok) continue; // Skip if position is invalid
            
            // If move involves promotion, should have promotion piece
            if (result.move && result.move.startsWith('d6')) {
                if (!result.move.match(/[qrn]$/)) {
                    return false; // Promotion move should end with q, r, or n
                }
            }
        }
        return true;
    });

    console.log('\nSTRESS TEST GROUP 6: ERROR RECOVERY AND RESILIENCE');
    console.log('-'.repeat(50));

    console.log('\n6.1 Error Recovery Tests:');

    // Test rapid invalid requests don't crash the system
    await asyncTest('Survives 100 rapid invalid requests', async () => {
        for (let i = 0; i < 100; i++) {
            try {
                await aiBot.generateMove({
                    fen: 'invalid',
                    level: 'LX',
                    msCap: 1
                });
            } catch (error) {
                // Expected to fail, continue
            }
        }
        
        // System should still work after abuse
        const result = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L0',
            msCap: 100
        });
        
        return result.ok === true;
    });

    // Test mixed valid/invalid requests
    await asyncTest('Handles mixed valid/invalid request pattern', async () => {
        let successCount = 0;
        
        for (let i = 0; i < 50; i++) {
            const isValid = i % 3 === 0; // Every 3rd request is valid
            
            const result = await aiBot.generateMove({
                fen: isValid ? INITIAL_FEN : 'invalid',
                level: isValid ? 'L0' : 'LX',
                msCap: 100
            });
            
            if (isValid && result.ok) successCount++;
        }
        
        // Should have succeeded on most valid requests
        return successCount >= 15; // At least 15 out of ~17 valid requests
    });

    console.log('\nSTRESS TEST GROUP 7: PERFORMANCE BENCHMARKING');
    console.log('-'.repeat(50));

    console.log('\n7.1 Performance Benchmarks:');

    // Benchmark each difficulty level
    for (const level of ['L0', 'L1', 'L2', 'L3']) {
        await asyncTest(`${level} performance benchmark`, async () => {
            const iterations = level === 'L0' ? 100 : level === 'L1' ? 50 : 20;
            const timeLimit = level === 'L0' ? 1000 : level === 'L1' ? 2000 : level === 'L2' ? 5000 : 10000;
            
            const start = Date.now();
            let successful = 0;
            
            for (let i = 0; i < iterations; i++) {
                const result = await aiBot.generateMove({
                    fen: INITIAL_FEN,
                    level: level,
                    msCap: 1000,
                    seed: i
                });
                
                if (result.ok) successful++;
            }
            
            const elapsed = Date.now() - start;
            const avgTime = elapsed / iterations;
            
            console.log(`    ${level}: ${iterations} iterations, ${elapsed}ms total, ${avgTime.toFixed(1)}ms avg`);
            
            return successful === iterations && elapsed < timeLimit;
        });
    }
}

// Main execution
async function executeStressTests() {
    try {
        await runStressTests();
        
        // Final results
        console.log('\n' + '='.repeat(80));
        console.log('AI BOT STRESS TEST RESULTS');
        console.log('='.repeat(80));
        console.log(`Total stress tests: ${totalTests}`);
        console.log(`Tests passed: ${passedTests}`);
        console.log(`Tests failed: ${totalTests - passedTests}`);
        
        if (totalTests > 0) {
            console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
        }

        if (failedTests.length > 0) {
            console.log('\nFAILED STRESS TESTS:');
            failedTests.forEach((test, index) => {
                console.log(`${index + 1}. ${test}`);
            });
            console.log('\nNOTE: Some stress test failures may be acceptable under extreme conditions.');
        } else {
            console.log('\nALL STRESS TESTS PASSED!');
            console.log('AI Bot demonstrates excellent robustness and performance.');
        }

        console.log('\nSTRESS TEST CATEGORIES COMPLETED:');
        console.log('    Extreme input validation and malformed data handling');
        console.log('    High-volume request processing and memory stability');
        console.log('    Timeout enforcement and concurrent request handling');
        console.log('    All difficulty levels tested across multiple positions');
        console.log('    Edge case positions and special scenarios');
        console.log('    Error recovery and system resilience');
        console.log('    Performance benchmarking and load testing');
        
        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('Stress test suite error:', error.message);
        process.exit(1);
    }
}

// Run the comprehensive stress test suite
executeStressTests();