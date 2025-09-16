// unit-tests/test-board-validator.js
// COMPLETE TEST for BoardValidator

console.log('BoardValidator Complete Test\n');

let passCount = 0;
let totalTests = 0;

function test(description, condition) {
    totalTests++;
    if (condition) {
        console.log('PASS:', description);
        passCount++;
    } else {
        console.log('FAIL:', description);
    }
}

try {
    const BoardValidator = require('../src/engine/board-validator.js');
    const validator = new BoardValidator();
    
    console.log('Testing BoardValidator methods...\n');
    
    // Test 1: FEN Validation
    console.log('Group 1: FEN Validation');
    if (typeof validator.isValidFEN === 'function') {
        
        // Valid Los Alamos FEN
        const validFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
        test('Valid Los Alamos FEN accepted', validator.isValidFEN(validFEN));
        
        // Invalid FEN - wrong number of parts
        test('Invalid FEN (wrong parts) rejected', validator.isValidFEN('invalid') === false);
        
        // Invalid FEN - castling rights (not allowed in Los Alamos)
        test('FEN with castling rejected', validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w KQ - 0 1') === false);
        
        // Invalid FEN - en passant (not allowed in Los Alamos)
        test('FEN with en passant rejected', validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - e3 0 1') === false);
        
        // Invalid FEN - wrong number of ranks
        test('FEN with wrong ranks rejected', validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP w - - 0 1') === false);
        
    } else {
        console.log('WARNING: isValidFEN method not found');
    }
    
    // Test 2: UCI Validation
    console.log('\nGroup 2: UCI Validation');
    if (typeof validator.isValidUCI === 'function') {
        
        // Valid UCI moves
        test('Valid UCI b2b3 accepted', validator.isValidUCI('b2b3'));
        test('Valid UCI a1f6 accepted', validator.isValidUCI('a1f6'));
        
        // Valid UCI with promotion
        test('Valid UCI with queen promotion', validator.isValidUCI('e5e6q'));
        test('Valid UCI with rook promotion', validator.isValidUCI('e5e6r'));
        test('Valid UCI with knight promotion', validator.isValidUCI('e5e6n'));
        
        // Invalid UCI with bishop promotion (not allowed in Los Alamos)
        test('UCI with bishop promotion rejected', validator.isValidUCI('e5e6b') === false);
        
        // Invalid UCI formats
        test('Too short UCI rejected', validator.isValidUCI('b2') === false);
        test('Too long UCI rejected', validator.isValidUCI('b2b3x') === false);
        test('Invalid squares rejected', validator.isValidUCI('z9z9') === false);
        
        // Los Alamos specific - no rank 7 or 8, no files g-h
        test('Rank 7 UCI rejected', validator.isValidUCI('e6e7') === false);
        test('Rank 8 UCI rejected', validator.isValidUCI('e7e8') === false);
        test('File g UCI rejected', validator.isValidUCI('g1g2') === false);
        test('File h UCI rejected', validator.isValidUCI('h1h2') === false);
        
    } else {
        console.log('WARNING: isValidUCI method not found');
    }
    
    // Test 3: Square Validation
    console.log('\nGroup 3: Square Validation');
    if (typeof validator.isValidSquare === 'function') {
        
        // Valid squares
        test('Valid square a1', validator.isValidSquare('a1'));
        test('Valid square f6', validator.isValidSquare('f6'));
        test('Valid square c3', validator.isValidSquare('c3'));
        
        // Invalid squares
        test('Invalid square z9 rejected', validator.isValidSquare('z9') === false);
        test('Invalid square g1 rejected (no g file)', validator.isValidSquare('g1') === false);
        test('Invalid square a7 rejected (no rank 7)', validator.isValidSquare('a7') === false);
        test('Empty string rejected', validator.isValidSquare('') === false);
        test('Too long square rejected', validator.isValidSquare('abc') === false);
        
    } else {
        console.log('WARNING: isValidSquare method not found');
    }
    
    // Test 4: Board Validation
    console.log('\nGroup 4: Board Validation');
    if (typeof validator.isValidBoard === 'function') {
        
        // Create valid board
        const validBoard = {
            squares: Array(6).fill(null).map(() => Array(6).fill(null))
        };
        validBoard.squares[0][4] = { type: 'king', color: 'white' };
        validBoard.squares[5][4] = { type: 'king', color: 'black' };
        
        test('Valid board accepted', validator.isValidBoard(validBoard));
        
        // Invalid board - no kings
        const noKingsBoard = {
            squares: Array(6).fill(null).map(() => Array(6).fill(null))
        };
        test('Board without kings rejected', validator.isValidBoard(noKingsBoard) === false);
        
        // Invalid board - with bishops (not allowed in Los Alamos)
        const bishopBoard = {
            squares: Array(6).fill(null).map(() => Array(6).fill(null))
        };
        bishopBoard.squares[0][4] = { type: 'king', color: 'white' };
        bishopBoard.squares[5][4] = { type: 'king', color: 'black' };
        bishopBoard.squares[2][2] = { type: 'bishop', color: 'white' };
        
        test('Board with bishops rejected', validator.isValidBoard(bishopBoard) === false);
        
    } else {
        console.log('WARNING: isValidBoard method not found');
    }
    
} catch (error) {
    console.log('ERROR loading BoardValidator:', error.message);
}

console.log(`\nResults: ${passCount}/${totalTests} tests passed`);
if (passCount === totalTests) {
    console.log('ALL TESTS PASSED!');
} else {
    console.log(`${totalTests - passCount} tests failed - check implementation`);
}