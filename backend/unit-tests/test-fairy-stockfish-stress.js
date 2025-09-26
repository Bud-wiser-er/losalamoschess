// test-fairy-integration-stress.js
// Full integration test: Fairy-Stockfish + Los Alamos Rules Engine
// Place in: backend/unit-tests/test-fairy-integration-stress.js

const { Engine } = require('node-uci');
const path = require('path');

// Import YOUR rules engine
const RulesEngine = require('../src/engine/index.js');
const rulesEngine = new RulesEngine();

const ENGINE_PATH = path.join(__dirname, '..', 'bin', 'fairy-stockfish.exe');

// Test utilities with detailed error reporting
async function asyncTest(name, fn) {
  try {
    const result = await fn();
    if (result.passed === false) {
      console.log(`  ✗ ${name}`);
      if (result.expected !== undefined && result.actual !== undefined) {
        console.log(`      Expected: ${JSON.stringify(result.expected)}`);
        console.log(`      Actual:   ${JSON.stringify(result.actual)}`);
      }
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
      return false;
    }
    console.log(`  ✓ ${name}`);
    return true;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`      Exception: ${error.message}`);
    return false;
  }
}

// Test positions (all valid 6x6 Los Alamos FENs)
const TEST_POSITIONS = {
  initial: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
  midgame: 'r1qknr/pppp1p/3np1/4P1/2P3/R1QKNR w - - 0 5',  // Fixed: 6 ranks
  nearPromotion: 'r1qknr/P4p/6/6/6/RNQKNR w - - 0 40'
};

console.log('='.repeat(80));
console.log('FAIRY-STOCKFISH + RULES ENGINE INTEGRATION STRESS TEST');
console.log('='.repeat(80));
console.log(`Engine Path: ${ENGINE_PATH}`);
console.log(`Rules Engine: backend/src/engine/index.js`);
console.log('='.repeat(80));

let totalTests = 0;
let passedTests = 0;

async function runIntegrationTests() {
  let engine;

  // Initialize
  console.log('\nINITIALIZATION');
  console.log('-'.repeat(80));
  
  totalTests++;
  if (await asyncTest('Initialize Fairy-Stockfish', async () => {
    engine = new Engine(ENGINE_PATH);
    await engine.init();
    await engine.setoption('UCI_Variant', 'losalamos');
    await engine.isready();
    return { passed: true };
  })) passedTests++;

  totalTests++;
  if (await asyncTest('Verify rules engine available', async () => {
    if (!rulesEngine.validateMove || !rulesEngine.applyMove) {
      return {
        passed: false,
        error: 'Rules engine missing validateMove or applyMove functions',
        expected: 'Functions: validateMove, applyMove',
        actual: `Functions: ${Object.keys(rulesEngine).join(', ')}`
      };
    }
    return { passed: true };
  })) passedTests++;

  // GROUP 1: Move Legality Validation
  console.log('\nGROUP 1: Fairy-Stockfish Moves vs Rules Engine Validation');
  console.log('-'.repeat(80));

  for (let i = 0; i < 20; i++) {
    totalTests++;
    if (await asyncTest(`Move ${i + 1}: Engine suggests legal move`, async () => {
      await engine.position(TEST_POSITIONS.initial);
      const result = await engine.go({ depth: 5 });
      const move = result.bestmove;

      // Validate with YOUR rules engine (simple fen, uci parameters)
      const validation = rulesEngine.validateMove(TEST_POSITIONS.initial, move);

      if (!validation.valid) {
        return {
          passed: false,
          error: 'Fairy-Stockfish suggested illegal move',
          expected: 'valid=true',
          actual: `valid=false, error=${validation.error}`,
          move: move
        };
      }

      return { passed: true };
    })) passedTests++;
  }

  // GROUP 2: Move Application Integration
  console.log('\nGROUP 2: Move Application with Rules Engine');
  console.log('-'.repeat(80));

  totalTests++;
  if (await asyncTest('Full move sequence with validation', async () => {
    let currentFen = TEST_POSITIONS.initial;
    
    for (let moveNum = 0; moveNum < 10; moveNum++) {
      // Get move from Fairy-Stockfish
      await engine.position(currentFen);
      const result = await engine.go({ depth: 5 });
      const move = result.bestmove;

      // Validate with rules engine
      const validation = rulesEngine.validateMove(currentFen, move);

      if (!validation.valid) {
        return {
          passed: false,
          error: `Illegal move at move ${moveNum + 1}`,
          expected: 'All moves valid',
          actual: `Move ${move} invalid: ${validation.error}`,
          position: currentFen
        };
      }

      // Apply move with rules engine
      const applied = rulesEngine.applyMove(currentFen, move);

      if (!applied.fen) {
        return {
          passed: false,
          error: `Failed to apply move ${move}`,
          expected: 'fen returned',
          actual: JSON.stringify(applied)
        };
      }

      currentFen = applied.fen;
    }

    console.log(`      Played 10 moves successfully`);
    return { passed: true };
  })) passedTests++;

  // GROUP 3: ELO Levels with Rules Validation
  console.log('\nGROUP 3: ELO Levels - All Moves Legal');
  console.log('-'.repeat(80));

  const elos = [1000, 1500, 2000, 2500, 3000];
  for (const elo of elos) {
    totalTests++;
    if (await asyncTest(`ELO ${elo} produces legal moves`, async () => {
      await engine.setoption('UCI_LimitStrength', 'true');
      await engine.setoption('UCI_Elo', String(elo));
      await engine.isready();

      // Test 5 moves at this ELO
      for (let i = 0; i < 5; i++) {
        await engine.position(TEST_POSITIONS.initial);
        const result = await engine.go({ depth: 3 });
        const move = result.bestmove;

        const validation = rulesEngine.validateMove(TEST_POSITIONS.initial, move);

        if (!validation.valid) {
          return {
            passed: false,
            error: `ELO ${elo} produced illegal move`,
            expected: 'valid=true',
            actual: `Move ${move} invalid: ${validation.error}`,
            elo: elo
          };
        }
      }

      return { passed: true };
    })) passedTests++;
  }

  // GROUP 4: Special Positions
  console.log('\nGROUP 4: Special Positions & Edge Cases');
  console.log('-'.repeat(80));

  totalTests++;
  if (await asyncTest('Midgame position - move validation', async () => {
    await engine.position(TEST_POSITIONS.midgame);
    const result = await engine.go({ depth: 8 });
    const move = result.bestmove;

    const validation = rulesEngine.validateMove(TEST_POSITIONS.midgame, move);

    if (!validation.valid) {
      return {
        passed: false,
        expected: 'Legal move in midgame',
        actual: `Illegal move ${move}: ${validation.error}`,
        fen: TEST_POSITIONS.midgame
      };
    }

    return { passed: true };
  })) passedTests++;

  totalTests++;
  if (await asyncTest('Near promotion position', async () => {
    await engine.position(TEST_POSITIONS.nearPromotion);
    const result = await engine.go({ depth: 8 });
    const move = result.bestmove;

    const validation = rulesEngine.validateMove(TEST_POSITIONS.nearPromotion, move);

    if (!validation.valid) {
      return {
        passed: false,
        expected: 'Legal move (possibly promotion)',
        actual: `Illegal move ${move}: ${validation.error}`,
        fen: TEST_POSITIONS.nearPromotion
      };
    }

    // Check if promotion was handled correctly
    if (move.length === 5) {
      const promotionPiece = move[4];
      if (!['q', 'r', 'n'].includes(promotionPiece)) {
        return {
          passed: false,
          expected: 'Promotion to q, r, or n',
          actual: `Promotion to ${promotionPiece}`,
          move: move
        };
      }
    }

    return { passed: true };
  })) passedTests++;

  // GROUP 5: Error Handling
  console.log('\nGROUP 5: Error Handling & Edge Cases');
  console.log('-'.repeat(80));

  totalTests++;
  if (await asyncTest('Rules engine catches invalid UCI format', async () => {
    const invalidMove = 'x9z2'; // Invalid UCI
    
    const validation = rulesEngine.validateMove(TEST_POSITIONS.initial, invalidMove);

    if (validation.valid) {
      return {
        passed: false,
        expected: 'valid=false for invalid UCI',
        actual: 'valid=true',
        move: invalidMove
      };
    }

    return { passed: true };
  })) passedTests++;

  totalTests++;
  if (await asyncTest('Rules engine catches out of bounds', async () => {
    const outOfBounds = 'a1h8'; // h8 doesn't exist in 6x6
    
    const validation = rulesEngine.validateMove(TEST_POSITIONS.initial, outOfBounds);

    if (validation.valid) {
      return {
        passed: false,
        expected: 'valid=false for out of bounds',
        actual: 'valid=true',
        move: outOfBounds
      };
    }

    return { passed: true };
  })) passedTests++;

  // GROUP 6: Endurance with Validation
  console.log('\nGROUP 6: Endurance - 30 Complete Games');
  console.log('-'.repeat(80));

  totalTests++;
  if (await asyncTest('Play 30 complete games validating every move', async () => {
    let gamesPlayed = 0;
    let totalMoves = 0;

    for (let game = 0; game < 30; game++) {
      let currentFen = TEST_POSITIONS.initial;
      let moves = 0;

      // Play up to 30 moves per game
      for (let moveNum = 0; moveNum < 30; moveNum++) {
        await engine.position(currentFen);
        const result = await engine.go({ depth: 3 });
        const move = result.bestmove;

        const validation = rulesEngine.validateMove(currentFen, move);

        if (!validation.valid) {
          return {
            passed: false,
            error: `Game ${game + 1}, Move ${moveNum + 1} invalid`,
            expected: 'All moves valid',
            actual: `Move ${move} invalid: ${validation.error}`,
            gamesCompleted: gamesPlayed,
            movesPlayed: totalMoves
          };
        }

        const applied = rulesEngine.applyMove(currentFen, move);

        currentFen = applied.fen;
        moves++;
        totalMoves++;

        // Check for game over
        if (applied.status === 'CHECKMATE' || applied.status === 'STALEMATE') {
          break;
        }
      }

      gamesPlayed++;
    }

    console.log(`      ${gamesPlayed} games, ${totalMoves} moves validated`);
    return { passed: true };
  })) passedTests++;

  // Cleanup
  await engine.quit();

  // Results
  console.log('\n' + '='.repeat(80));
  console.log('INTEGRATION TEST RESULTS');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

  if (passedTests === totalTests) {
    console.log('\nLETS GOOOOO: INTEGRATION TEST PASSED');
    console.log('   Fairy-Stockfish + Rules Engine working perfectly together!');
    console.log('   All moves validated against Los Alamos rules.');
    console.log('   Ready for L4 implementation.');
  } else {
    console.log('\n INTEGRATION TEST FAILED');
    console.log('   Review failures above - may need adjustments.');
  }
  console.log('='.repeat(80));

  return passedTests === totalTests;
}

runIntegrationTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('\n FATAL ERROR:', error);
    process.exit(1);
  });