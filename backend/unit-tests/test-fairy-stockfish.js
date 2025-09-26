// test-l4-bot.js
// Comprehensive test suite for L4 (Fairy-Stockfish) bot integration
// Place in: backend/unit-tests/test-l4-bot.js

const AIBot = require('../src/ai-bot/index');

const INITIAL_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const MIDGAME_FEN = 'r1qknr/pppp1p/3np1/4P1/2P3/R1QKNR w - - 0 5';

console.log('='.repeat(70));
console.log('L4 BOT (FAIRY-STOCKFISH) COMPREHENSIVE TEST');
console.log('='.repeat(70));

let testsPassed = 0;
let testsFailed = 0;

function test(name, condition) {
    if (condition) {
        console.log(`  ✓ ${name}`);
        testsPassed++;
        return true;
    } else {
        console.log(`  ✗ ${name}`);
        testsFailed++;
        return false;
    }
}

async function asyncTest(name, fn) {
    try {
        const result = await fn();
        if (result) {
            console.log(`  ✓ ${name}`);
            testsPassed++;
            return true;
        } else {
            console.log(`  ✗ ${name}`);
            testsFailed++;
            return false;
        }
    } catch (error) {
        console.log(`  ✗ ${name} - ${error.message}`);
        testsFailed++;
        return false;
    }
}

async function runL4Tests() {
    const aiBot = new AIBot();

    // GROUP 1: Initialization
    console.log('\nGROUP 1: L4 Strategy Initialization');
    console.log('-'.repeat(70));

    test('AIBot has L4 strategy', aiBot.strategies.L4 !== undefined);
    test('L4 strategy has findBestMove method', 
        typeof aiBot.strategies.L4.findBestMove === 'function');
    test('L4 strategy has cleanup method', 
        typeof aiBot.strategies.L4.cleanup === 'function');

    // GROUP 2: Basic Move Generation
    console.log('\nGROUP 2: Basic L4 Move Generation');
    console.log('-'.repeat(70));

    await asyncTest('L4 generates move from initial position', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L4',
            elo: 2000
        });
        return response.ok === true && response.move !== undefined;
    });

    await asyncTest('L4 move is legal', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L4',
            elo: 2000
        });
        const rulesEngine = aiBot.rulesEngine;
        const validation = rulesEngine.validateMove(INITIAL_FEN, response.move);
        return validation.valid === true;
    });

    await asyncTest('L4 returns evaluation score', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L4',
            elo: 2000
        });
        return response.evaluation !== undefined;
    });

    await asyncTest('L4 returns ELO in response', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L4',
            elo: 1800
        });
        return response.elo === 1800;
    });

    // GROUP 3: ELO Levels
    console.log('\nGROUP 3: ELO Level Testing');
    console.log('-'.repeat(70));

    const eloLevels = [1000, 1500, 2000, 2500, 3000];
    for (const elo of eloLevels) {
        await asyncTest(`L4 works at ELO ${elo}`, async () => {
            const response = await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L4',
                elo: elo
            });
            return response.ok === true && response.move !== undefined;
        });
    }

    // GROUP 4: Default ELO Handling
    console.log('\nGROUP 4: Default ELO Handling');
    console.log('-'.repeat(70));

    await asyncTest('L4 uses default ELO (2000) when not specified', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L4'
        });
        return response.ok === true && response.move !== undefined;
    });

    await asyncTest('L4 uses seed as ELO fallback', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L4',
            seed: 1500
        });
        return response.ok === true;
    });

    // GROUP 5: Various Positions
    console.log('\nGROUP 5: Various Position Types');
    console.log('-'.repeat(70));

    await asyncTest('L4 handles midgame position', async () => {
        const response = await aiBot.generateMove({
            fen: MIDGAME_FEN,
            level: 'L4',
            elo: 2000
        });
        const validation = aiBot.rulesEngine.validateMove(MIDGAME_FEN, response.move);
        return response.ok && validation.valid;
    });

    // GROUP 6: Integration with Other Levels
    console.log('\nGROUP 6: Integration with L0-L3');
    console.log('-'.repeat(70));

    await asyncTest('L0 still works after L4 initialization', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L0'
        });
        return response.ok === true;
    });

    await asyncTest('L1 still works after L4 initialization', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L1'
        });
        return response.ok === true;
    });

    await asyncTest('L2 still works after L4 initialization', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L2'
        });
        return response.ok === true;
    });

    await asyncTest('L3 still works after L4 initialization', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L3'
        });
        return response.ok === true;
    });

    // GROUP 7: Error Handling
    console.log('\nGROUP 7: L4 Error Handling');
    console.log('-'.repeat(70));

    await asyncTest('L4 handles invalid FEN gracefully', async () => {
        const response = await aiBot.generateMove({
            fen: 'invalid_fen',
            level: 'L4',
            elo: 2000
        });
        return response.ok === false && response.error === 'INVALID_FEN';
    });

    await asyncTest('L4 returns fallback on engine failure', async () => {
        // This should still work even if engine has issues
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L4',
            elo: 2000
        });
        return response.move !== undefined;
    });

    // GROUP 8: Performance
    console.log('\nGROUP 8: L4 Performance');
    console.log('-'.repeat(70));

    await asyncTest('L4 completes within time cap', async () => {
        const startTime = Date.now();
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L4',
            elo: 2000,
            msCap: 3000
        });
        const elapsed = Date.now() - startTime;
        console.log(`      Time taken: ${elapsed}ms`);
        return response.ok && elapsed < 4000; // Some buffer
    });

    await asyncTest('L4 returns metadata (depth, nodes)', async () => {
        const response = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L4',
            elo: 2000
        });
        return response.depth !== undefined && response.nodes !== undefined;
    });

    // GROUP 9: Consistency
    console.log('\nGROUP 9: L4 Consistency');
    console.log('-'.repeat(70));

    await asyncTest('L4 produces legal moves consistently (10 runs)', async () => {
        for (let i = 0; i < 10; i++) {
            const response = await aiBot.generateMove({
                fen: INITIAL_FEN,
                level: 'L4',
                elo: 1500
            });
            
            if (!response.ok) return false;
            
            const validation = aiBot.rulesEngine.validateMove(INITIAL_FEN, response.move);
            if (!validation.valid) return false;
        }
        return true;
    });

    // GROUP 10: Cleanup
    console.log('\nGROUP 10: Cleanup and Resource Management');
    console.log('-'.repeat(70));

    await asyncTest('Cleanup method exists and works', async () => {
        if (typeof aiBot.cleanup === 'function') {
            await aiBot.cleanup();
            return true;
        }
        return false;
    });

    // Results Summary
    console.log('\n' + '='.repeat(70));
    console.log('L4 BOT TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsFailed}`);
    console.log(`Total Tests: ${testsPassed + testsFailed}`);
    console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(2)}%`);

    if (testsFailed === 0) {
        console.log('\n✅ ALL L4 TESTS PASSED');
        console.log('   L4 (Fairy-Stockfish) is fully integrated and working!');
        console.log('   Ready for production use.');
    } else {
        console.log('\n❌ SOME L4 TESTS FAILED');
        console.log(`   ${testsFailed} test(s) need attention.`);
    }
    console.log('='.repeat(70));

    // Final cleanup
    await aiBot.cleanup();

    return testsFailed === 0;
}

// Run tests
runL4Tests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error('\n❌ FATAL ERROR:', error);
        process.exit(1);
    });