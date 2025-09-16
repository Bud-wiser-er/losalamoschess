// unit-tests/test-piece-movement.js
// COMPLETE TEST for PieceMovement

console.log('PieceMovement Complete Test\n');

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
    const PieceMovement = require('../src/engine/piece-movement.js');
    const movement = new PieceMovement();
    
    // Create comprehensive mock board for testing
    const mockBoard = {
        getPieceAt: function(square) {
            // Enemy pieces for capture testing
            if (square === 'c3') return { type: 'pawn', color: 'black' };
            if (square === 'd3') return { type: 'knight', color: 'black' };
            if (square === 'e3') return { type: 'rook', color: 'white' }; // Same color - blocking
            
            // Path blocking for rook/queen tests
            if (square === 'a3') return { type: 'pawn', color: 'white' };
            
            return null; // Empty square
        }
    };
    
    console.log('Testing PieceMovement methods...\n');
    
    if (typeof movement.isValidMove === 'function') {
        
        // Test 1: Pawn Movement
        console.log('Group 1: Pawn Movement');
        const whitePawn = { type: 'pawn', color: 'white' };
        const blackPawn = { type: 'pawn', color: 'black' };
        
        // White pawn moves
        test('White pawn b2-b3 (forward)', movement.isValidMove(whitePawn, { from: 'b2', to: 'b3' }, mockBoard));
        test('White pawn b2xc3 (capture)', movement.isValidMove(whitePawn, { from: 'b2', to: 'c3' }, mockBoard));
        test('White pawn b2-b4 rejected (double move)', movement.isValidMove(whitePawn, { from: 'b2', to: 'b4' }, mockBoard) === false);
        test('White pawn b2-c2 rejected (sideways)', movement.isValidMove(whitePawn, { from: 'b2', to: 'c2' }, mockBoard) === false);
        test('White pawn b2-b1 rejected (backwards)', movement.isValidMove(whitePawn, { from: 'b2', to: 'b1' }, mockBoard) === false);
        
        // Black pawn moves (opposite direction)
        test('Black pawn b5-b4 (forward)', movement.isValidMove(blackPawn, { from: 'b5', to: 'b4' }, mockBoard));
        test('Black pawn b5-b6 rejected (backwards)', movement.isValidMove(blackPawn, { from: 'b5', to: 'b6' }, mockBoard) === false);
        
        // Test 2: Knight Movement
        console.log('\nGroup 2: Knight Movement');
        const whiteKnight = { type: 'knight', color: 'white' };
        
        // Valid L-shaped moves
        test('Knight b1-c3 (L-shape)', movement.isValidMove(whiteKnight, { from: 'b1', to: 'c3' }, mockBoard));
        test('Knight b1-d2 (L-shape)', movement.isValidMove(whiteKnight, { from: 'b1', to: 'd2' }, mockBoard));
        test('Knight d4-c2 (L-shape)', movement.isValidMove(whiteKnight, { from: 'd4', to: 'c2' }, mockBoard));
        test('Knight d4-f5 (L-shape)', movement.isValidMove(whiteKnight, { from: 'd4', to: 'f5' }, mockBoard));
        
        // Invalid knight moves
        test('Knight b1-b3 rejected (not L-shape)', movement.isValidMove(whiteKnight, { from: 'b1', to: 'b3' }, mockBoard) === false);
        test('Knight b1-d3 rejected (not L-shape)', movement.isValidMove(whiteKnight, { from: 'b1', to: 'd3' }, mockBoard) === false);
        test('Knight b1-c1 rejected (not L-shape)', movement.isValidMove(whiteKnight, { from: 'b1', to: 'c1' }, mockBoard) === false);
        
        // Test 3: Rook Movement
        console.log('\nGroup 3: Rook Movement');
        const whiteRook = { type: 'rook', color: 'white' };
        
        // Valid rook moves
        test('Rook a1-a2 (vertical)', movement.isValidMove(whiteRook, { from: 'a1', to: 'a2' }, mockBoard));
        test('Rook a1-b1 (horizontal)', movement.isValidMove(whiteRook, { from: 'a1', to: 'b1' }, mockBoard));
        test('Rook d4-d6 (vertical)', movement.isValidMove(whiteRook, { from: 'd4', to: 'd6' }, mockBoard));
        test('Rook d4-f4 (horizontal)', movement.isValidMove(whiteRook, { from: 'd4', to: 'f4' }, mockBoard));
        
        // Invalid rook moves
        test('Rook a1-b2 rejected (diagonal)', movement.isValidMove(whiteRook, { from: 'a1', to: 'b2' }, mockBoard) === false);
        test('Rook a1-c3 rejected (not straight)', movement.isValidMove(whiteRook, { from: 'a1', to: 'c3' }, mockBoard) === false);
        
        // Path blocking
        if (typeof movement.isPathClear === 'function') {
            test('Rook a1-a6 rejected (blocked)', movement.isValidMove(whiteRook, { from: 'a1', to: 'a6' }, mockBoard) === false);
        }
        
        // Test 4: Queen Movement
        console.log('\nGroup 4: Queen Movement');
        const whiteQueen = { type: 'queen', color: 'white' };
        
        // Valid queen moves (rook + bishop)
        test('Queen d4-d6 (vertical like rook)', movement.isValidMove(whiteQueen, { from: 'd4', to: 'd6' }, mockBoard));
        test('Queen d4-f4 (horizontal like rook)', movement.isValidMove(whiteQueen, { from: 'd4', to: 'f4' }, mockBoard));
        test('Queen d4-f6 (diagonal like bishop)', movement.isValidMove(whiteQueen, { from: 'd4', to: 'f6' }, mockBoard));
        test('Queen d4-b2 (diagonal like bishop)', movement.isValidMove(whiteQueen, { from: 'd4', to: 'b2' }, mockBoard));
        
        // Invalid queen moves
        test('Queen d4-e6 rejected (not straight/diagonal)', movement.isValidMove(whiteQueen, { from: 'd4', to: 'e6' }, mockBoard) === false);
        test('Queen d4-c6 rejected (not straight/diagonal)', movement.isValidMove(whiteQueen, { from: 'd4', to: 'c6' }, mockBoard) === false);
        
        // Test 5: King Movement
        console.log('\nGroup 5: King Movement');
        const whiteKing = { type: 'king', color: 'white' };
        
        // Valid king moves (one square any direction)
        test('King d4-d5 (one forward)', movement.isValidMove(whiteKing, { from: 'd4', to: 'd5' }, mockBoard));
        test('King d4-e4 (one right)', movement.isValidMove(whiteKing, { from: 'd4', to: 'e4' }, mockBoard));
        test('King d4-e5 (one diagonal)', movement.isValidMove(whiteKing, { from: 'd4', to: 'e5' }, mockBoard));
        test('King d4-c3 (one diagonal)', movement.isValidMove(whiteKing, { from: 'd4', to: 'c3' }, mockBoard));
        
        // Invalid king moves
        test('King d4-d6 rejected (too far)', movement.isValidMove(whiteKing, { from: 'd4', to: 'd6' }, mockBoard) === false);
        test('King d4-f4 rejected (too far)', movement.isValidMove(whiteKing, { from: 'd4', to: 'f4' }, mockBoard) === false);
        test('King d4-d4 rejected (same square)', movement.isValidMove(whiteKing, { from: 'd4', to: 'd4' }, mockBoard) === false);
        
        // Test 6: Capture Rules
        console.log('\nGroup 6: Capture Rules');
        
        // Can capture enemy pieces
        test('Can capture enemy piece', movement.isValidMove(whiteKnight, { from: 'b1', to: 'd3' }, mockBoard)); // d3 has black knight
        
        // Cannot capture own pieces
        test('Cannot capture own piece', movement.isValidMove(whiteRook, { from: 'd4', to: 'e3' }, mockBoard) === false); // e3 has white rook
        
    } else {
        console.log('ERROR: isValidMove method not found');
    }
    
    // Test path clearing functionality
    console.log('\nGroup 7: Path Clearing');
    if (typeof movement.isPathClear === 'function') {
        test('Clear path a1-a2', movement.isPathClear('a1', 'a2', mockBoard));
        test('Blocked path a1-a6', movement.isPathClear('a1', 'a6', mockBoard) === false);
        test('Single step always clear', movement.isPathClear('b1', 'c1', mockBoard));
    } else {
        console.log('WARNING: isPathClear method not found (this is optional)');
    }
    
} catch (error) {
    console.log('ERROR loading PieceMovement:', error.message);
    console.log('Stack:', error.stack);
}

console.log(`\nResults: ${passCount}/${totalTests} tests passed`);
if (passCount === totalTests) {
    console.log('ALL TESTS PASSED!');
} else {
    console.log(`${totalTests - passCount} tests failed - check implementation`);
}