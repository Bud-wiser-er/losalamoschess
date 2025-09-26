// unit-tests/test-piece-movement-comprehensive.js
// COMPREHENSIVE PIECE MOVEMENT TESTS - Catches bugs like forward-capture issue

console.log('='.repeat(80));
console.log('PIECE MOVEMENT TEST SUITE EXTENDED FROM PREVIOUS VERSION FOR MORE TESTING');
console.log('='.repeat(80));
console.log();

let passCount = 0;
let totalTests = 0;
let failedTests = [];

function test(description, condition, shouldBe = true) {
    totalTests++;
    const passed = condition === shouldBe;
    if (passed) {
        console.log('YEAH BABY: PASS:', description);
        passCount++;
    } else {
        console.log(' FAIL:', description);
        console.log(`  Expected: ${shouldBe}, Got: ${condition}`);
        failedTests.push(description);
    }
}

// Create clean board helper
function createCleanBoard() {
    const board = {
        squares: Array(6).fill(null).map(() => Array(6).fill(null)),
        turn: 'white',
        
        getPieceAt: function(square) {
            if (!square || square.length !== 2) return null;
            const file = square.charCodeAt(0) - 97;
            const rank = parseInt(square[1]) - 1;
            if (rank < 0 || rank > 5 || file < 0 || file > 5) return null;
            return this.squares[rank][file];
        },
        
        setPieceAt: function(square, piece) {
            if (!square || square.length !== 2) return;
            const file = square.charCodeAt(0) - 97;
            const rank = parseInt(square[1]) - 1;
            if (rank >= 0 && rank <= 5 && file >= 0 && file <= 5) {
                this.squares[rank][file] = piece;
            }
        }
    };
    return board;
}

try {
    const PieceMovement = require('../src/engine/piece-movement.js');
    const movement = new PieceMovement();
    
    // ========================================================================
    // PAWN COMPREHENSIVE TESTS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('PAWN MOVEMENT TESTS');
    console.log('='.repeat(80));
    
    console.log('\n--- White Pawn Forward Movement ---');
    
    // White pawn forward to empty square (VALID)
    test('White pawn: b2→b3 (forward to empty)', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'b2', to: 'b3' },
            createCleanBoard()
        ), true);
    
    // White pawn forward to occupied square (INVALID - BUG FIX!)
    const boardWithBlockingPiece = createCleanBoard();
    boardWithBlockingPiece.setPieceAt('b3', { type: 'pawn', color: 'black' });
    test('White pawn: b2→b3 (forward blocked by enemy) - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'b2', to: 'b3' },
            boardWithBlockingPiece
        ), false);
    
    const boardWithOwnPiece = createCleanBoard();
    boardWithOwnPiece.setPieceAt('b3', { type: 'pawn', color: 'white' });
    test('White pawn: b2→b3 (forward blocked by own piece) - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'b2', to: 'b3' },
            boardWithOwnPiece
        ), false);
    
    console.log('\n--- White Pawn Diagonal Capture ---');
    
    // White pawn diagonal capture enemy (VALID)
    const boardWithEnemy = createCleanBoard();
    boardWithEnemy.setPieceAt('c3', { type: 'pawn', color: 'black' });
    test('White pawn: b2×c3 (diagonal capture enemy)', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'b2', to: 'c3' },
            boardWithEnemy
        ), true);
    
    // White pawn diagonal to empty square (INVALID)
    test('White pawn: b2→c3 (diagonal to empty) - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'b2', to: 'c3' },
            createCleanBoard()
        ), false);
    
    // White pawn diagonal capture own piece (INVALID)
    const boardWithOwnDiag = createCleanBoard();
    boardWithOwnDiag.setPieceAt('c3', { type: 'pawn', color: 'white' });
    test('White pawn: b2×c3 (diagonal capture own) - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'b2', to: 'c3' },
            boardWithOwnDiag
        ), false);
    
    console.log('\n--- White Pawn Invalid Moves ---');
    
    test('White pawn: b2→b4 (double move) - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'b2', to: 'b4' },
            createCleanBoard()
        ), false);
    
    test('White pawn: b2→c2 (sideways) - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'b2', to: 'c2' },
            createCleanBoard()
        ), false);
    
    test('White pawn: b3→b2 (backward) - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'b3', to: 'b2' },
            createCleanBoard()
        ), false);
    
    console.log('\n--- Black Pawn Tests ---');
    
    test('Black pawn: b5→b4 (forward to empty)', 
        movement.isValidMove(
            { type: 'pawn', color: 'black' },
            { from: 'b5', to: 'b4' },
            createCleanBoard()
        ), true);
    
    const boardForBlackCapture = createCleanBoard();
    boardForBlackCapture.setPieceAt('c4', { type: 'pawn', color: 'white' });
    test('Black pawn: b5×c4 (diagonal capture enemy)', 
        movement.isValidMove(
            { type: 'pawn', color: 'black' },
            { from: 'b5', to: 'c4' },
            boardForBlackCapture
        ), true);
    
    test('Black pawn: b5→b6 (backward) - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'black' },
            { from: 'b5', to: 'b6' },
            createCleanBoard()
        ), false);
    
    // ========================================================================
    // KNIGHT COMPREHENSIVE TESTS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('KNIGHT MOVEMENT TESTS');
    console.log('='.repeat(80));
    
    console.log('\n--- Valid L-shaped Moves ---');
    
    const knightMoves = [
        { from: 'd3', to: 'f4', desc: '+2 file, +1 rank' },
        { from: 'd3', to: 'f2', desc: '+2 file, -1 rank' },
        { from: 'd3', to: 'b4', desc: '-2 file, +1 rank' },
        { from: 'd3', to: 'b2', desc: '-2 file, -1 rank' },
        { from: 'd3', to: 'e5', desc: '+1 file, +2 rank' },
        { from: 'd3', to: 'e1', desc: '+1 file, -2 rank' },
        { from: 'd3', to: 'c5', desc: '-1 file, +2 rank' },
        { from: 'd3', to: 'c1', desc: '-1 file, -2 rank' }
    ];
    
    knightMoves.forEach(move => {
        test(`Knight: ${move.from}→${move.to} (${move.desc})`, 
            movement.isValidMove(
                { type: 'knight', color: 'white' },
                move,
                createCleanBoard()
            ), true);
    });
    
    console.log('\n--- Knight Captures ---');
    
    const boardWithEnemyKnight = createCleanBoard();
    boardWithEnemyKnight.setPieceAt('f4', { type: 'rook', color: 'black' });
    test('Knight: d3×f4 (capture enemy)', 
        movement.isValidMove(
            { type: 'knight', color: 'white' },
            { from: 'd3', to: 'f4' },
            boardWithEnemyKnight
        ), true);
    
    const boardWithOwnKnight = createCleanBoard();
    boardWithOwnKnight.setPieceAt('f4', { type: 'rook', color: 'white' });
    test('Knight: d3→f4 (blocked by own) - MUST FAIL', 
        movement.isValidMove(
            { type: 'knight', color: 'white' },
            { from: 'd3', to: 'f4' },
            boardWithOwnKnight
        ), false);
    
    console.log('\n--- Invalid Knight Moves ---');
    
    test('Knight: d3→d5 (straight) - MUST FAIL', 
        movement.isValidMove(
            { type: 'knight', color: 'white' },
            { from: 'd3', to: 'd5' },
            createCleanBoard()
        ), false);
    
    test('Knight: d3→f5 (diagonal) - MUST FAIL', 
        movement.isValidMove(
            { type: 'knight', color: 'white' },
            { from: 'd3', to: 'f5' },
            createCleanBoard()
        ), false);
    
    test('Knight: d3→e4 (one square) - MUST FAIL', 
        movement.isValidMove(
            { type: 'knight', color: 'white' },
            { from: 'd3', to: 'e4' },
            createCleanBoard()
        ), false);
    
    // ========================================================================
    // ROOK COMPREHENSIVE TESTS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('ROOK MOVEMENT TESTS');
    console.log('='.repeat(80));
    
    console.log('\n--- Valid Rook Moves ---');
    
    test('Rook: a1→a6 (vertical)', 
        movement.isValidMove(
            { type: 'rook', color: 'white' },
            { from: 'a1', to: 'a6' },
            createCleanBoard()
        ), true);
    
    test('Rook: a1→f1 (horizontal)', 
        movement.isValidMove(
            { type: 'rook', color: 'white' },
            { from: 'a1', to: 'f1' },
            createCleanBoard()
        ), true);
    
    console.log('\n--- Rook Path Blocking ---');
    
    const boardWithBlocker = createCleanBoard();
    boardWithBlocker.setPieceAt('a3', { type: 'pawn', color: 'white' });
    test('Rook: a1→a5 (blocked by own piece) - MUST FAIL', 
        movement.isValidMove(
            { type: 'rook', color: 'white' },
            { from: 'a1', to: 'a5' },
            boardWithBlocker
        ), false);
    
    const boardWithEnemyBlocker = createCleanBoard();
    boardWithEnemyBlocker.setPieceAt('a3', { type: 'pawn', color: 'black' });
    test('Rook: a1→a3 (capture enemy)', 
        movement.isValidMove(
            { type: 'rook', color: 'white' },
            { from: 'a1', to: 'a3' },
            boardWithEnemyBlocker
        ), true);
    
    test('Rook: a1→a5 (jump over enemy) - MUST FAIL', 
        movement.isValidMove(
            { type: 'rook', color: 'white' },
            { from: 'a1', to: 'a5' },
            boardWithEnemyBlocker
        ), false);
    
    console.log('\n--- Invalid Rook Moves ---');
    
    test('Rook: a1→b2 (diagonal) - MUST FAIL', 
        movement.isValidMove(
            { type: 'rook', color: 'white' },
            { from: 'a1', to: 'b2' },
            createCleanBoard()
        ), false);
    
    test('Rook: a1→b3 (knight move) - MUST FAIL', 
        movement.isValidMove(
            { type: 'rook', color: 'white' },
            { from: 'a1', to: 'b3' },
            createCleanBoard()
        ), false);
    
    // ========================================================================
    // QUEEN COMPREHENSIVE TESTS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('QUEEN MOVEMENT TESTS');
    console.log('='.repeat(80));
    
    console.log('\n--- Valid Queen Moves (Rook-like) ---');
    
    test('Queen: d3→d6 (vertical)', 
        movement.isValidMove(
            { type: 'queen', color: 'white' },
            { from: 'd3', to: 'd6' },
            createCleanBoard()
        ), true);
    
    test('Queen: d3→f3 (horizontal)', 
        movement.isValidMove(
            { type: 'queen', color: 'white' },
            { from: 'd3', to: 'f3' },
            createCleanBoard()
        ), true);
    
    console.log('\n--- Valid Queen Moves (Bishop-like) ---');
    
    test('Queen: d3→f5 (diagonal NE)', 
        movement.isValidMove(
            { type: 'queen', color: 'white' },
            { from: 'd3', to: 'f5' },
            createCleanBoard()
        ), true);
    
    test('Queen: d3→b5 (diagonal NW)', 
        movement.isValidMove(
            { type: 'queen', color: 'white' },
            { from: 'd3', to: 'b5' },
            createCleanBoard()
        ), true);
    
    test('Queen: d3→f1 (diagonal SE)', 
        movement.isValidMove(
            { type: 'queen', color: 'white' },
            { from: 'd3', to: 'f1' },
            createCleanBoard()
        ), true);
    
    test('Queen: d3→b1 (diagonal SW)', 
        movement.isValidMove(
            { type: 'queen', color: 'white' },
            { from: 'd3', to: 'b1' },
            createCleanBoard()
        ), true);
    
    console.log('\n--- Invalid Queen Moves ---');
    
    test('Queen: d3→e5 (knight move) - MUST FAIL', 
        movement.isValidMove(
            { type: 'queen', color: 'white' },
            { from: 'd3', to: 'e5' },
            createCleanBoard()
        ), false);
    
    test('Queen: d3→f4 (irregular) - MUST FAIL', 
        movement.isValidMove(
            { type: 'queen', color: 'white' },
            { from: 'd3', to: 'f4' },
            createCleanBoard()
        ), false);
    
    // ========================================================================
    // KING COMPREHENSIVE TESTS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('KING MOVEMENT TESTS');
    console.log('='.repeat(80));
    
    console.log('\n--- Valid King Moves (One Square) ---');
    
    const kingMoves = [
        { from: 'd3', to: 'd4', desc: 'forward' },
        { from: 'd3', to: 'd2', desc: 'backward' },
        { from: 'd3', to: 'e3', desc: 'right' },
        { from: 'd3', to: 'c3', desc: 'left' },
        { from: 'd3', to: 'e4', desc: 'diagonal NE' },
        { from: 'd3', to: 'c4', desc: 'diagonal NW' },
        { from: 'd3', to: 'e2', desc: 'diagonal SE' },
        { from: 'd3', to: 'c2', desc: 'diagonal SW' }
    ];
    
    kingMoves.forEach(move => {
        test(`King: ${move.from}→${move.to} (${move.desc})`, 
            movement.isValidMove(
                { type: 'king', color: 'white' },
                move,
                createCleanBoard()
            ), true);
    });
    
    console.log('\n--- Invalid King Moves ---');
    
    test('King: d3→d5 (two squares) - MUST FAIL', 
        movement.isValidMove(
            { type: 'king', color: 'white' },
            { from: 'd3', to: 'd5' },
            createCleanBoard()
        ), false);
    
    test('King: d3→f5 (two squares diagonal) - MUST FAIL', 
        movement.isValidMove(
            { type: 'king', color: 'white' },
            { from: 'd3', to: 'f5' },
            createCleanBoard()
        ), false);
    
    test('King: d3→d3 (same square) - MUST FAIL', 
        movement.isValidMove(
            { type: 'king', color: 'white' },
            { from: 'd3', to: 'd3' },
            createCleanBoard()
        ), false);
    
    // ========================================================================
    // EDGE CASES & BOUNDARY TESTS
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('EDGE CASES & BOUNDARY TESTS');
    console.log('='.repeat(80));
    
    console.log('\n--- Board Boundaries ---');
    
    test('Pawn: a6→a7 (off board) - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'a6', to: 'a7' },
            createCleanBoard()
        ), false);
    
    test('Knight: a1→c0 (off board) - MUST FAIL', 
        movement.isValidMove(
            { type: 'knight', color: 'white' },
            { from: 'a1', to: 'c0' },
            createCleanBoard()
        ), false);
    
    console.log('\n--- Null/Invalid Inputs ---');
    
    test('Null piece - MUST FAIL', 
        movement.isValidMove(
            null,
            { from: 'a1', to: 'a2' },
            createCleanBoard()
        ), false);
    
    test('Null move - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            null,
            createCleanBoard()
        ), false);
    
    test('Null board - MUST FAIL', 
        movement.isValidMove(
            { type: 'pawn', color: 'white' },
            { from: 'a1', to: 'a2' },
            null
        ), false);
    
    test('Invalid piece type - MUST FAIL', 
        movement.isValidMove(
            { type: 'dragon', color: 'white' },
            { from: 'a1', to: 'a2' },
            createCleanBoard()
        ), false);
    
} catch (error) {
    console.log('\n ERROR:', error.message);
    console.log(error.stack);
}

// ========================================================================
// SUMMARY
// ========================================================================
console.log('\n' + '='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));
console.log(`Total tests: ${totalTests}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${totalTests - passCount}`);
console.log(`Success rate: ${((passCount / totalTests) * 100).toFixed(2)}%`);

if (failedTests.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('FAILED TESTS:');
    console.log('='.repeat(80));
    failedTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test}`);
    });
    process.exit(1);
} else {
    console.log('\nYEAH BABY: ALL TESTS PASSED!');
    process.exit(0);
}