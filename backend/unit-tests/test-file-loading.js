// unit-tests/test-file-loading.js
// SIMPLE TEST , Just check if files load or not

console.log('Simple File Loading Test\n');

console.log('1. BoardValidator...');
try {
    require('../src/engine/board-validator.js');
    console.log('   OK');
} catch (error) {
    console.log('   ERROR:', error.message);
}

console.log('2. Constants...');
try {
    require('../src/engine/constants.js');
    console.log('   OK');
} catch (error) {
    console.log('   ERROR:', error.message);
}

console.log('3. PieceMovement...');
try {
    require('../src/engine/piece-movement.js');
    console.log('   OK');
} catch (error) {
    console.log('   ERROR:', error.message);
}

console.log('4. GameStateChecker...');
try {
    require('../src/engine/game-state-checker.js');
    console.log('   OK');
} catch (error) {
    console.log('   ERROR:', error.message);
}

console.log('5. RulesEngine (main)...');
try {
    require('../src/engine/index.js');
    console.log('   OK');
} catch (error) {
    console.log('   ERROR:', error.message);
}

console.log('\nDone!');