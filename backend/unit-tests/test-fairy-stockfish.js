// test-fairy-stockfish.js
// Test file for Fairy-Stockfish integration with Los Alamos Chess
// Place this in: backend/src/unit-tests/test-fairy-stockfish.js

const { Engine } = require('node-uci');
const path = require('path');

const LOS_ALAMOS_INITIAL_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

// Path to the engine binary
const ENGINE_PATH = path.join(__dirname, '..', 'bin', 'fairy-stockfish.exe');

console.log('='.repeat(70));
console.log('FAIRY-STOCKFISH LOS ALAMOS INTEGRATION TEST');
console.log('='.repeat(70));
console.log(`Engine Path: ${ENGINE_PATH}`);
console.log('='.repeat(70));

async function testFairyStockfish() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Engine Initialization
  console.log('\nTest 1: Engine Initialization');
  let engine;
  try {
    engine = new Engine(ENGINE_PATH);
    await engine.init();
    console.log('✓ Engine initialized successfully');
    testsPassed++;
  } catch (error) {
    console.error('✗ Failed to initialize engine:', error.message);
    testsFailed++;
    return { passed: testsPassed, failed: testsFailed };
  }

  // Test 2: Set Los Alamos Variant
  console.log('\nTest 2: Setting Los Alamos Variant');
  try {
    await engine.setoption('UCI_Variant', 'losalamos');
    await engine.isready();
    console.log('✓ Los Alamos variant set successfully');
    testsPassed++;
  } catch (error) {
    console.error('✗ Failed to set variant:', error.message);
    testsFailed++;
  }

  // Test 3: Initial Position
  console.log('\nTest 3: Setting Initial Position');
  try {
    await engine.position(LOS_ALAMOS_INITIAL_FEN);
    console.log('✓ Initial position set:', LOS_ALAMOS_INITIAL_FEN);
    testsPassed++;
  } catch (error) {
    console.error('✗ Failed to set position:', error.message);
    testsFailed++;
  }

  // Test 4: Get Best Move
  console.log('\nTest 4: Getting Best Move (depth 10)');
  try {
    const result = await engine.go({ depth: 10 });
    console.log('✓ Best move found:', result.bestmove);
    
    if (result.info && result.info.length > 0) {
      const lastInfo = result.info[result.info.length - 1];
      console.log('  - Evaluation:', lastInfo.score?.value || 'N/A', 'centipawns');
      console.log('  - Depth:', lastInfo.depth || 'N/A');
      console.log('  - Nodes:', lastInfo.nodes?.toLocaleString() || 'N/A');
      console.log('  - Time:', lastInfo.time || 'N/A', 'ms');
    }
    testsPassed++;
  } catch (error) {
    console.error('✗ Failed to get best move:', error.message);
    testsFailed++;
  }

  // Test 5: Move Sequence
  console.log('\nTest 5: Testing Move Sequence');
  try {
    const testMoves = ['a2a3', 'a5a4', 'b2b3'];
    for (const move of testMoves) {
      await engine.position(LOS_ALAMOS_INITIAL_FEN, testMoves.slice(0, testMoves.indexOf(move) + 1));
      const result = await engine.go({ depth: 5 });
      console.log(`  ✓ After ${move}, engine suggests: ${result.bestmove}`);
    }
    testsPassed++;
  } catch (error) {
    console.error('✗ Failed move sequence test:', error.message);
    testsFailed++;
  }

  // Test 6: ELO Limitation
  console.log('\nTest 6: Testing ELO Strength Limitation');
  try {
    await engine.setoption('UCI_LimitStrength', 'true');
    await engine.setoption('UCI_Elo', '1500');
    await engine.isready();
    await engine.position(LOS_ALAMOS_INITIAL_FEN);
    const result = await engine.go({ movetime: 1000 });
    console.log('✓ Move at ELO 1500:', result.bestmove);
    testsPassed++;
  } catch (error) {
    console.error('✗ Failed ELO test:', error.message);
    testsFailed++;
  }

  // Test 7: Time-based Search
  console.log('\nTest 7: Testing Time-based Search (2 seconds)');
  try {
    await engine.position(LOS_ALAMOS_INITIAL_FEN);
    const startTime = Date.now();
    const result = await engine.go({ movetime: 2000 });
    const elapsed = Date.now() - startTime;
    console.log(`✓ Move found in ${elapsed}ms:`, result.bestmove);
    testsPassed++;
  } catch (error) {
    console.error('✗ Failed time-based search:', error.message);
    testsFailed++;
  }

  // Cleanup
  console.log('\nCleanup: Closing Engine');
  try {
    await engine.quit();
    console.log('✓ Engine closed successfully');
    testsPassed++;
  } catch (error) {
    console.error('✗ Failed to close engine:', error.message);
    testsFailed++;
  }

  // Results Summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n✅ ALL TESTS PASSED - Fairy-Stockfish is ready for integration!');
  } else {
    console.log('\n❌ SOME TESTS FAILED - Please check the errors above');
  }
  console.log('='.repeat(70));

  return { passed: testsPassed, failed: testsFailed };
}

// Run the test
testFairyStockfish()
  .then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });