// debug-fen-issue.js
// Specific test to isolate and fix the FEN generation/parsing issue

const RulesEngine = require('../src/engine/index.js');

console.log('='.repeat(60));
console.log('DEBUGGING FEN ISSUE - ISOLATED TEST');
console.log('='.repeat(60));

const engine = new RulesEngine();
const INITIAL_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

console.log('\n1. INITIAL BOARD STATE ANALYSIS');
console.log('-'.repeat(40));
console.log('Starting FEN:', INITIAL_FEN);

const initialBoard = engine.parseFEN(INITIAL_FEN);
if (!initialBoard) {
    console.log('WRONG ( FIX IT) ERROR: Cannot parse initial FEN');
    process.exit(1);
}

console.log('LETS GO ( working) Initial board parsed successfully');
console.log('Initial turn:', initialBoard.turn);

// Let's examine the initial board layout
console.log('\n2. INITIAL BOARD LAYOUT');
console.log('-'.repeat(40));
for (let rank = 5; rank >= 0; rank--) {
    let rankStr = `Rank ${rank + 1}: `;
    for (let file = 0; file < 6; file++) {
        const piece = initialBoard.squares[rank][file];
        if (piece) {
            rankStr += `${String.fromCharCode(97 + file)}${rank + 1}:${piece.notation} `;
        } else {
            rankStr += `${String.fromCharCode(97 + file)}${rank + 1}:- `;
        }
    }
    console.log(rankStr);
}

console.log('\n3. VERIFY SPECIFIC SQUARES');
console.log('-'.repeat(40));
console.log('a2 piece:', initialBoard.getPieceAt('a2'));
console.log('a6 piece:', initialBoard.getPieceAt('a6'));
console.log('a3 piece:', initialBoard.getPieceAt('a3'));
console.log('a5 piece:', initialBoard.getPieceAt('a5'));

console.log('\n4. FIRST MOVE: a2a3');
console.log('-'.repeat(40));

// Test the first move
const move1Validation = engine.validateMove(INITIAL_FEN, 'a2a3');
console.log('Move 1 validation:', move1Validation);

if (!move1Validation || !move1Validation.valid) {
    console.log('WRONG ( FIX IT) ERROR: First move validation failed');
    process.exit(1);
}

// Apply the first move
const move1Result = engine.applyMove(INITIAL_FEN, 'a2a3');
console.log('Move 1 result:', move1Result);

if (!move1Result || !move1Result.fen) {
    console.log('WRONG ( FIX IT) ERROR: First move application failed');
    process.exit(1);
}

const afterMove1FEN = move1Result.fen;
console.log('FEN after a2a3:', afterMove1FEN);

console.log('\n5. PARSE NEW FEN AND ANALYZE');
console.log('-'.repeat(40));

const newBoard = engine.parseFEN(afterMove1FEN);
if (!newBoard) {
    console.log('WRONG ( FIX IT) ERROR: Cannot parse FEN after move 1');
    process.exit(1);
}

console.log('LETS GO ( working) New board parsed successfully');
console.log('New turn:', newBoard.turn);

// Let's examine the board layout after the move
console.log('\n6. BOARD LAYOUT AFTER a2a3');
console.log('-'.repeat(40));
for (let rank = 5; rank >= 0; rank--) {
    let rankStr = `Rank ${rank + 1}: `;
    for (let file = 0; file < 6; file++) {
        const piece = newBoard.squares[rank][file];
        if (piece) {
            rankStr += `${String.fromCharCode(97 + file)}${rank + 1}:${piece.notation} `;
        } else {
            rankStr += `${String.fromCharCode(97 + file)}${rank + 1}:- `;
        }
    }
    console.log(rankStr);
}

console.log('\n7. VERIFY CRITICAL SQUARES AFTER MOVE');
console.log('-'.repeat(40));
console.log('a2 piece (should be empty):', newBoard.getPieceAt('a2'));
console.log('a3 piece (should be white pawn):', newBoard.getPieceAt('a3'));
console.log('a6 piece (should be black pawn):', newBoard.getPieceAt('a6'));
console.log('a5 piece (should be empty):', newBoard.getPieceAt('a5'));

console.log('\n8. UNDERSTAND LOS ALAMOS PIECE LAYOUT');
console.log('-'.repeat(40));

console.log('Los Alamos Chess starting layout:');
console.log('  Rank 6 (a6-f6): Black pieces (rook, knight, queen, king, knight, rook)');
console.log('  Rank 5 (a5-f5): Black pawns');
console.log('  Rank 4 (a4-f4): Empty');
console.log('  Rank 3 (a3-f3): Empty');
console.log('  Rank 2 (a2-f2): White pawns');
console.log('  Rank 1 (a1-f1): White pieces (rook, knight, queen, king, knight, rook)');

console.log('\nCurrent board pieces:');
console.log('a6 piece:', newBoard.getPieceAt('a6'), '(should be black rook)');
console.log('a5 piece:', newBoard.getPieceAt('a5'), '(should be black pawn)');
console.log('a4 piece:', newBoard.getPieceAt('a4'), '(should be empty)');
console.log('a3 piece:', newBoard.getPieceAt('a3'), '(should be white pawn after move)');
console.log('a2 piece:', newBoard.getPieceAt('a2'), '(should be empty after move)');
console.log('a1 piece:', newBoard.getPieceAt('a1'), '(should be white rook)');

console.log('\n9. TEST CORRECT SECOND MOVE: a5a4');
console.log('-'.repeat(40));

// Test the CORRECT second move - black pawn from a5 to a4
const blackPawnA5 = newBoard.getPieceAt('a5');
console.log('Black piece at a5:', blackPawnA5);

if (!blackPawnA5) {
    console.log('WRONG ( FIX IT) ERROR: No piece at a5');
} else if (blackPawnA5.type !== 'pawn') {
    console.log('WRONG ( FIX IT) ERROR: Wrong piece type at a5. Expected pawn, got:', blackPawnA5.type);
} else if (blackPawnA5.color !== 'black') {
    console.log('WRONG ( FIX IT) ERROR: Wrong piece color at a5. Expected black, got:', blackPawnA5.color);
} else {
    console.log('LETS GO ( working) Correct black pawn at a5');
}

const targetSquareA4 = newBoard.getPieceAt('a4');
console.log('Target square a4:', targetSquareA4);

if (targetSquareA4) {
    console.log('WRONG ( FIX IT) ERROR: a4 should be empty but contains:', targetSquareA4);
} else {
    console.log('LETS GO ( working) Target square a4 is empty');
}

// Test CORRECT move validation
const correctMove2Validation = engine.validateMove(afterMove1FEN, 'a5a4');
console.log('Correct move a5a4 validation:', correctMove2Validation);

// Test the WRONG move for comparison
console.log('\nFor comparison, test the WRONG move a6a5:');
const wrongMove2Validation = engine.validateMove(afterMove1FEN, 'a6a5');
console.log('Wrong move a6a5 validation:', wrongMove2Validation);

console.log('\n10. MANUAL FEN BREAKDOWN');
console.log('-'.repeat(40));
console.log('Current FEN:', afterMove1FEN);
const fenParts = afterMove1FEN.split(' ');
console.log('Position part:', fenParts[0]);
console.log('Turn part:', fenParts[1]);

const ranks = fenParts[0].split('/');
console.log('Rank breakdown:');
ranks.forEach((rank, index) => {
    console.log(`  FEN rank ${index} (board rank ${6 - index}): ${rank}`);
});

console.log('\n11. IDENTIFY THE CORRECT UNDERSTANDING');
console.log('-'.repeat(40));

console.log('Expected after a2a3:');
console.log('  Rank 6 (FEN rank 0): rnqknr (black back rank) LETS GO ( working)');
console.log('  Rank 5 (FEN rank 1): pppppp (black pawns) LETS GO ( working)');
console.log('  Rank 4 (FEN rank 2): 6 (empty) LETS GO ( working)');
console.log('  Rank 3 (FEN rank 3): P5 (white pawn moved to a3 + 5 empty) LETS GO ( working)');
console.log('  Rank 2 (FEN rank 4): 1PPPPP (empty a2 + 5 white pawns) LETS GO ( working)');
console.log('  Rank 1 (FEN rank 5): RNQKNR (white back rank) LETS GO ( working)');

console.log('\nActual FEN ranks:');
ranks.forEach((rank, index) => {
    console.log(`  FEN rank ${index}: ${rank}`);
});

// Check if everything is correct
if (ranks[0] === 'rnqknr' && ranks[1] === 'pppppp' && ranks[3] === 'P5') {
    console.log('\nYea Boi: FEN generation and parsing are CORRECT');
    console.log('Yea Boi: The board layout matches Los Alamos Chess rules');
    console.log('Yea Boi: The issue was using the wrong move (a6a5 instead of a5a4)');
} else {
    console.log('\nWROGN FEN generation is incorrect');
    console.log('Ranks are in wrong order or content is wrong');
}

console.log('\n12. TURN ISSUE DEBUG');
console.log('-'.repeat(40));

console.log('Board turn:', newBoard.turn);
console.log('Board turn type:', typeof newBoard.turn);

const pieceAtA2After = newBoard.getPieceAt('a2');
console.log('Piece at a2 after move:', pieceAtA2After);

const pieceAtA5After = newBoard.getPieceAt('a5');
console.log('Piece at a5 after move:', pieceAtA5After);

if (pieceAtA5After) {
    console.log('a5 piece color:', pieceAtA5After.color);
    console.log('a5 piece color type:', typeof pieceAtA5After.color);
    console.log('Turn matches a5 piece?', pieceAtA5After.color === newBoard.turn);
    console.log('Expected: black pawn should match black turn');
}

// Test validation on the CORRECT move
console.log('\nDirect validation test for a5a4 (CORRECT):');
console.log('Current turn:', newBoard.turn);
console.log('Piece at a5:', newBoard.getPieceAt('a5'));
console.log('Turn check passes?', newBoard.getPieceAt('a5')?.color === newBoard.turn);



console.log('\n' + '='.repeat(60));
console.log('DEBUG COMPLETE');
console.log('='.repeat(60));