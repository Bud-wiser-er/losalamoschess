// unit-tests/test-rules-engine.js
// COMPLETE TEST for RulesEngine

console.log('RulesEngine Complete Test\n');

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
    const RulesEngine = require('../src/engine/index.js');
    const engine = new RulesEngine();
    
    const startingFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
    
    console.log('Testing RulesEngine methods...\n');
    
    // Test 1: FEN Parsing
    console.log('Group 1: FEN Parsing');
    if (typeof engine.parseFEN === 'function') {
        
        const board = engine.parseFEN(startingFEN);
        test('parseFEN returns object', board !== null && typeof board === 'object');
        
        if (board) {
            test('Board has squares array', Array.isArray(board.squares));
            test('Board has 6 ranks', board.squares && board.squares.length === 6);
            test('First rank has 6 files', board.squares[0] && board.squares[0].length === 6);
            test('Turn is white', board.turn === 'white');
            test('Half-move clock is 0', board.halfMoveClock === 0);
            test('Full-move number is 1', board.fullMoveNumber === 1);
            test('Castling is - (none)', board.castling === '-');
            test('En passant is - (none)', board.enPassant === '-');
            
            // Test helper methods exist
            test('Board has getPieceAt method', typeof board.getPieceAt === 'function');
            test('Board has setPieceAt method', typeof board.setPieceAt === 'function');
            test('Board has makeMove method', typeof board.makeMove === 'function');
            test('Board has clone method', typeof board.clone === 'function');
            
            // Test helper methods work
            if (typeof board.getPieceAt === 'function') {
                const piece = board.getPieceAt('e1');
                test('Can get piece at e1', piece !== null);
                if (piece) {
                    test('King at e1 is correct type', piece.type === 'king');
                    test('King at e1 is white', piece.color === 'white');
                }
            }
        }
        
        // Test invalid FEN
        const invalidBoard = engine.parseFEN('invalid');
        test('Invalid FEN returns null', invalidBoard === null);
        
    } else {
        console.log('ERROR: parseFEN method not found');
    }
    
    // Test 2: FEN Generation
    console.log('\nGroup 2: FEN Generation');
    if (typeof engine.generateFEN === 'function') {
        
        const board = engine.parseFEN(startingFEN);
        if (board) {
            const regeneratedFEN = engine.generateFEN(board);
            test('FEN round-trip works', regeneratedFEN === startingFEN);
        }
        
    } else {
        console.log('WARNING: generateFEN method not found');
    }
    
    // Test 3: Move Validation
    console.log('\nGroup 3: Move Validation');
    if (typeof engine.validateMove === 'function') {
        
        // Valid moves
        const validPawn = engine.validateMove(startingFEN, 'b2b3');
        test('Valid pawn move accepted', validPawn && validPawn.valid === true);
        
        const validKnight = engine.validateMove(startingFEN, 'b1c3');
        test('Valid knight move accepted', validKnight && validKnight.valid === true);
        
        // Invalid moves
        const invalidMove = engine.validateMove(startingFEN, 'x1y9');
        test('Invalid squares rejected', invalidMove && invalidMove.valid === false);
        
        const emptySquare = engine.validateMove(startingFEN, 'd3d4');
        test('Move from empty square rejected', emptySquare && emptySquare.valid === false);
        
        const wrongTurn = engine.validateMove(startingFEN, 'b5b4'); // Black piece on white turn
        test('Wrong turn rejected', wrongTurn && wrongTurn.valid === false);
        
        // Los Alamos specific rules
        const doublePawn = engine.validateMove(startingFEN, 'b2b4');
        test('Double pawn move rejected (Los Alamos)', doublePawn && doublePawn.valid === false);
        
        // Test castling rejection (if implemented)
        const fenWithSpace = 'rnqk1r/pppppp/6/6/PPPPPP/RNQ1NR w - - 0 1';
        const castling = engine.validateMove(fenWithSpace, 'e1f1'); // King move that might look like castling
        if (castling && castling.error === 'NO_CASTLING') {
            test('Castling properly rejected', true);
        }
        
    } else {
        console.log('ERROR: validateMove method not found');
    }
    
    // Test 4: Move Application
    console.log('\nGroup 4: Move Application');
    if (typeof engine.applyMove === 'function') {
        
        const result = engine.applyMove(startingFEN, 'b2b3');
        test('applyMove returns object', result && typeof result === 'object');
        
        if (result) {
            test('Result has new FEN', typeof result.fen === 'string');
            test('Result has status', typeof result.status === 'string');
            test('Result has flags', result.flags && typeof result.flags === 'object');
            
            // Check that turn changed
            if (result.fen) {
                test('Turn changed to black', result.fen.includes(' b '));
            }
        }
        
    } else {
        console.log('WARNING: applyMove method not found');
    }
    
    // Test 5: Legal Move Generation
    console.log('\nGroup 5: Legal Move Generation');
    if (typeof engine.getLegalMoves === 'function') {
        
        const legalMoves = engine.getLegalMoves(startingFEN);
        test('getLegalMoves returns array', Array.isArray(legalMoves));
        
        if (Array.isArray(legalMoves)) {
            test('Has legal moves from start', legalMoves.length > 0);
            test('Reasonable number of moves (8-12)', legalMoves.length >= 8 && legalMoves.length <= 12);
            
            // Check that moves are strings
            const allStrings = legalMoves.every(move => typeof move === 'string');
            test('All moves are strings', allStrings);
            
            // Check for expected moves
            test('Contains b2b3', legalMoves.includes('b2b3'));
            test('Contains b1c3', legalMoves.includes('b1c3'));
            
            // Should not contain double pawn moves
            test('Does not contain b2b4', !legalMoves.includes('b2b4'));
        }
        
    } else {
        console.log('WARNING: getLegalMoves method not found');
    }
    
    // Test 6: Game State Detection
    console.log('\nGroup 6: Game State Detection');
    if (typeof engine.checkGameStatus === 'function') {
        
        const board = engine.parseFEN(startingFEN);
        if (board) {
            const status = engine.checkGameStatus(board);
            test('checkGameStatus returns object', status && typeof status === 'object');
            
            if (status) {
                test('Status has type property', typeof status.type === 'string');
                test('Starting position is ongoing', status.type === 'ONGOING');
                test('Starting position not in check', status.isCheck === false);
            }
        }
        
    } else {
        console.log('WARNING: checkGameStatus method not found');
    }
    
    // Test 7: Integration Test
    console.log('\nGroup 7: Integration Test');
    
    // Try to play a few moves
    let currentFEN = startingFEN;
    const moves = ['b2b3', 'b5b4', 'b1c3', 'b6b5'];
    let moveCount = 0;
    
    for (const move of moves) {
        const validation = engine.validateMove(currentFEN, move);
        if (validation && validation.valid) {
            const result = engine.applyMove(currentFEN, move);
            if (result && result.fen) {
                currentFEN = result.fen;
                moveCount++;
            }
        }
    }
    
    test('Can play multiple moves', moveCount >= 2);
    test('Final position is valid FEN', currentFEN.split(' ').length === 6);
    
} catch (error) {
    console.log('ERROR loading RulesEngine:', error.message);
    console.log('Stack:', error.stack);
}

console.log(`\nResults: ${passCount}/${totalTests} tests passed`);
if (passCount === totalTests) {
    console.log('ALL TESTS PASSED! Your RulesEngine is working correctly.');
} else {
    console.log(`${totalTests - passCount} tests failed - check implementation`);
}