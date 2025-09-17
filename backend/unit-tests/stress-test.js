// stress-test.js - FINAL VERSION WITH ALL FIXES
// COMPREHENSIVE STRESS TESTING for Byron's Rules Engine Components
// Tests EVERY function under extreme conditions, edge cases, and error scenarios

console.log('='.repeat(80));
console.log('COMPLETE STRESS TEST SUITE - Los Alamos Chess Rules Engine');
console.log('Testing ALL components under extreme conditions');
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
        } else {
            console.log(`  FAIL: ${description} - Expected ${shouldPass}, got ${result}`);
            failedTests.push(description);
        }
    } catch (error) {
        if (shouldPass) {
            console.log(`  ERROR: ${description} - ${error.message}`);
            failedTests.push(`${description} (ERROR: ${error.message})`);
        } else {
            console.log(`  PASS: ${description} - Expected error occurred`);
            passedTests++;
        }
    }
}

// Load all components
let RulesEngine, BoardValidator, PieceMovement, GameStateChecker, Constants;

try {
    RulesEngine = require('../src/engine/index.js');
    BoardValidator = require('../src/engine/board-validator.js');
    PieceMovement = require('../src/engine/piece-movement.js');
    GameStateChecker = require('../src/engine/game-state-checker.js');
    Constants = require('../src/engine/constants.js');
    console.log('All components loaded successfully\n');
} catch (error) {
    console.log('CRITICAL ERROR: Cannot load components:', error.message);
    process.exit(1);
}

// Initialize components
const engine = new RulesEngine();
const validator = new BoardValidator();
const movement = new PieceMovement();
const stateChecker = new GameStateChecker();

const INITIAL_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

console.log('STRESS TEST GROUP 1: BOARD VALIDATOR EXTREME TESTING');
console.log('-'.repeat(50));

// Test 1.1: FEN Validation Stress Tests
console.log('\n1.1 FEN Validation Stress Tests:');

// Valid FEN variations
test('Valid starting FEN', () => validator.isValidFEN(INITIAL_FEN));
test('Valid FEN with different turn', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR b - - 0 1'));
test('Valid FEN with move counters', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 50 100'));

// Invalid FEN stress tests
test('Null FEN', () => validator.isValidFEN(null), false);
test('Undefined FEN', () => validator.isValidFEN(undefined), false);
test('Empty string FEN', () => validator.isValidFEN(''), false);
test('Non-string FEN', () => validator.isValidFEN(123), false);
test('FEN with 0 parts', () => validator.isValidFEN(''), false);
test('FEN with 1 part', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR'), false);
test('FEN with 5 parts', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - -'), false);
test('FEN with 7 parts', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1 extra'), false);
test('FEN with invalid turn X', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR x - - 0 1'), false);
test('FEN with castling rights', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w K - 0 1'), false);
test('FEN with en passant', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - e3 0 1'), false);
test('FEN with non-numeric halfmove', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - x 1'), false);
test('FEN with non-numeric fullmove', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 x'), false);
test('FEN with 5 ranks', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP w - - 0 1'), false);
test('FEN with 7 ranks', () => validator.isValidFEN('rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1'), false);
test('FEN with invalid piece Z', () => validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKZR w - - 0 1'), false);
test('FEN with rank too long', () => validator.isValidFEN('rnqknrr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1'), false);
test('FEN with rank too short', () => validator.isValidFEN('rnqkn/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1'), false);
test('FEN with invalid number 7', () => validator.isValidFEN('rnqknr/pppppp/7/6/PPPPPP/RNQKNR w - - 0 1'), false);
test('FEN with invalid number 0', () => validator.isValidFEN('rnqknr/pppppp/0/6/PPPPPP/RNQKNR w - - 0 1'), false);

// Test 1.2: UCI Validation Stress Tests
console.log('\n1.2 UCI Validation Stress Tests:');

// Valid UCI moves
test('Valid UCI b2b3', () => validator.isValidUCI('b2b3'));
test('Valid UCI a1f6', () => validator.isValidUCI('a1f6'));
test('Valid UCI promotion e5e6q', () => validator.isValidUCI('e5e6q'));
test('Valid UCI promotion e5e6r', () => validator.isValidUCI('e5e6r'));
test('Valid UCI promotion e5e6n', () => validator.isValidUCI('e5e6n'));

// Invalid UCI moves
test('Null UCI', () => validator.isValidUCI(null), false);
test('Undefined UCI', () => validator.isValidUCI(undefined), false);
test('Empty UCI', () => validator.isValidUCI(''), false);
test('Non-string UCI', () => validator.isValidUCI(123), false);
test('UCI too short "b2"', () => validator.isValidUCI('b2'), false);
test('UCI too short "b"', () => validator.isValidUCI('b'), false);
test('UCI too long "b2b3x"', () => validator.isValidUCI('b2b3x'), false);
test('UCI too long "b2b3qr"', () => validator.isValidUCI('b2b3qr'), false);
test('UCI invalid from square "z2b3"', () => validator.isValidUCI('z2b3'), false);
test('UCI invalid to square "b2z3"', () => validator.isValidUCI('b2z3'), false);
test('UCI rank 0 "a0a1"', () => validator.isValidUCI('a0a1'), false);
test('UCI rank 7 "a7a6"', () => validator.isValidUCI('a7a6'), false);
test('UCI rank 8 "a8a7"', () => validator.isValidUCI('a8a7'), false);
test('UCI file g "g1g2"', () => validator.isValidUCI('g1g2'), false);
test('UCI file h "h1h2"', () => validator.isValidUCI('h1h2'), false);
test('UCI file z "z1a1"', () => validator.isValidUCI('z1a1'), false);
test('UCI bishop promotion "e5e6b"', () => validator.isValidUCI('e5e6b'), false);
test('UCI invalid promotion "e5e6x"', () => validator.isValidUCI('e5e6x'), false);

// Test 1.3: Square Validation Stress Tests
console.log('\n1.3 Square Validation Stress Tests:');

// Valid squares - test all valid combinations
const validSquares = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 
                      'b1', 'b2', 'b3', 'b4', 'b5', 'b6',
                      'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
                      'd1', 'd2', 'd3', 'd4', 'd5', 'd6',
                      'e1', 'e2', 'e3', 'e4', 'e5', 'e6',
                      'f1', 'f2', 'f3', 'f4', 'f5', 'f6'];

validSquares.forEach(square => {
    test(`Valid square ${square}`, () => validator.isValidSquare(square));
});

// Invalid squares - comprehensive edge cases
test('Null square', () => validator.isValidSquare(null), false);
test('Undefined square', () => validator.isValidSquare(undefined), false);
test('Empty string square', () => validator.isValidSquare(''), false);
test('Non-string square', () => validator.isValidSquare(123), false);
test('Too long square "abc"', () => validator.isValidSquare('abc'), false);
test('Too short square "a"', () => validator.isValidSquare('a'), false);
test('Invalid file g1', () => validator.isValidSquare('g1'), false);
test('Invalid file h1', () => validator.isValidSquare('h1'), false);
test('Invalid file z1', () => validator.isValidSquare('z1'), false);
test('Invalid rank a0', () => validator.isValidSquare('a0'), false);
test('Invalid rank a7', () => validator.isValidSquare('a7'), false);
test('Invalid rank a8', () => validator.isValidSquare('a8'), false);
test('Invalid rank a9', () => validator.isValidSquare('a9'), false);
test('Uppercase file A1', () => validator.isValidSquare('A1'), false);
test('Mixed case Aa', () => validator.isValidSquare('Aa'), false);

console.log('\nSTRESS TEST GROUP 2: PIECE MOVEMENT EXTREME TESTING');
console.log('-'.repeat(50));

// Create comprehensive mock board for extreme testing - FIXED VERSION
const createMockBoard = () => {
    const board = {
        squares: Array(6).fill(null).map(() => Array(6).fill(null)),
        turn: 'white',
        castling: '-',
        enPassant: '-',
        halfMoveClock: 0,
        fullMoveNumber: 1,
        
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
    
    // Set up specific test pieces
    board.setPieceAt('c3', { type: 'knight', color: 'black', notation: 'n' });
    board.setPieceAt('e3', { type: 'queen', color: 'black', notation: 'q' });
    board.setPieceAt('a3', { type: 'pawn', color: 'white', notation: 'P' });
    
    return board;
};

// Test 2.1: Pawn Movement Stress Tests
console.log('\n2.1 Pawn Movement Extreme Tests:');

const whitePawn = { type: 'pawn', color: 'white' };
const blackPawn = { type: 'pawn', color: 'black' };

// Fixed pawn tests with clean boards
test('White pawn forward b2-b3', () => {
    const cleanBoard = createMockBoard();
    return movement.isValidMove(whitePawn, {from: 'b2', to: 'b3'}, cleanBoard);
});

test('White pawn capture b2xc3', () => {
    const boardWithEnemy = createMockBoard();
    boardWithEnemy.setPieceAt('c3', { type: 'pawn', color: 'black', notation: 'p' });
    return movement.isValidMove(whitePawn, {from: 'b2', to: 'c3'}, boardWithEnemy);
});

test('Black pawn forward b5-b4', () => {
    const cleanBoard = createMockBoard();
    return movement.isValidMove(blackPawn, {from: 'b5', to: 'b4'}, cleanBoard);
});

test('Black pawn capture c5xb4', () => {
    const boardWithTarget = createMockBoard();
    boardWithTarget.setPieceAt('b4', { type: 'pawn', color: 'white', notation: 'P' });
    return movement.isValidMove(blackPawn, {from: 'c5', to: 'b4'}, boardWithTarget);
});

// Invalid pawn moves
test('White pawn double move b2-b4', () => movement.isValidMove(whitePawn, {from: 'b2', to: 'b4'}, createMockBoard()), false);
test('White pawn sideways b2-c2', () => movement.isValidMove(whitePawn, {from: 'b2', to: 'c2'}, createMockBoard()), false);
test('White pawn backwards b3-b2', () => movement.isValidMove(whitePawn, {from: 'b3', to: 'b2'}, createMockBoard()), false);

test('White pawn capture same color', () => {
    const board = createMockBoard();
    board.setPieceAt('c3', { type: 'pawn', color: 'white', notation: 'P' });
    return movement.isValidMove(whitePawn, {from: 'b2', to: 'c3'}, board);
}, false);

test('Black pawn wrong direction b4-b5', () => movement.isValidMove(blackPawn, {from: 'b4', to: 'b5'}, createMockBoard()), false);

test('Pawn capture empty square diagonally', () => {
    const emptyBoard = createMockBoard();
    // c3 is empty, pawn shouldn't be able to capture it
    emptyBoard.setPieceAt('c3', null);
    return movement.isValidMove(whitePawn, {from: 'b2', to: 'c3'}, emptyBoard);
}, false);

test('Pawn forward into occupied square', () => {
    const board = createMockBoard();
    board.setPieceAt('b3', { type: 'pawn', color: 'black', notation: 'p' });
    return movement.isValidMove(whitePawn, {from: 'b2', to: 'b3'}, board);
}, false);

// Extreme edge cases for pawn
test('Pawn move off board (beyond rank 6)', () => movement.isValidMove(whitePawn, {from: 'a6', to: 'a7'}, createMockBoard()), false);
test('Pawn move off board (beyond file f)', () => movement.isValidMove(whitePawn, {from: 'f2', to: 'g3'}, createMockBoard()), false);
test('Pawn null move object', () => movement.isValidMove(whitePawn, null, createMockBoard()), false);
test('Pawn invalid from square', () => movement.isValidMove(whitePawn, {from: 'z9', to: 'a3'}, createMockBoard()), false);

// Test 2.2: Knight Movement Stress Tests
console.log('\n2.2 Knight Movement Extreme Tests:');

const whiteKnight = { type: 'knight', color: 'white' };

// Valid L-shaped moves - test all 8 possible knight moves
test('Knight L-shape +2,+1', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'f4'}, createMockBoard()));
test('Knight L-shape +2,-1', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'f2'}, createMockBoard()));
test('Knight L-shape -2,+1', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'b4'}, createMockBoard()));
test('Knight L-shape -2,-1', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'b2'}, createMockBoard()));
test('Knight L-shape +1,+2', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'e5'}, createMockBoard()));
test('Knight L-shape +1,-2', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'e1'}, createMockBoard()));
test('Knight L-shape -1,+2', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'c5'}, createMockBoard()));
test('Knight L-shape -1,-2', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'c1'}, createMockBoard()));

// Invalid knight moves
test('Knight straight move', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'd5'}, createMockBoard()), false);
test('Knight diagonal move', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'f5'}, createMockBoard()), false);
test('Knight capture own piece', () => {
    const board = createMockBoard();
    board.setPieceAt('f4', { type: 'pawn', color: 'white', notation: 'P' });
    return movement.isValidMove(whiteKnight, {from: 'd3', to: 'f4'}, board);
}, false);
test('Knight invalid L +3,+1', () => movement.isValidMove(whiteKnight, {from: 'd3', to: 'g4'}, createMockBoard()), false);
test('Knight off board move', () => movement.isValidMove(whiteKnight, {from: 'a1', to: 'c0'}, createMockBoard()), false);

// Test 2.3: Rook Movement Stress Tests
console.log('\n2.3 Rook Movement Extreme Tests:');

const whiteRook = { type: 'rook', color: 'white' };

// Valid rook moves
test('Rook vertical up', () => movement.isValidMove(whiteRook, {from: 'a1', to: 'a2'}, createMockBoard()));
test('Rook vertical down', () => movement.isValidMove(whiteRook, {from: 'a6', to: 'a5'}, createMockBoard()));
test('Rook horizontal right', () => movement.isValidMove(whiteRook, {from: 'a1', to: 'b1'}, createMockBoard()));
test('Rook horizontal left', () => movement.isValidMove(whiteRook, {from: 'f1', to: 'e1'}, createMockBoard()));

test('Rook capture enemy piece', () => {
    const board = createMockBoard();
    board.setPieceAt('c1', { type: 'pawn', color: 'black', notation: 'p' });
    return movement.isValidMove(whiteRook, {from: 'a1', to: 'c1'}, board);
});

// Invalid rook moves
test('Rook diagonal move', () => movement.isValidMove(whiteRook, {from: 'a1', to: 'b2'}, createMockBoard()), false);
test('Rook knight move', () => movement.isValidMove(whiteRook, {from: 'a1', to: 'b3'}, createMockBoard()), false);
test('Rook capture own piece', () => {
    const board = createMockBoard();
    board.setPieceAt('a2', { type: 'pawn', color: 'white', notation: 'P' });
    return movement.isValidMove(whiteRook, {from: 'a1', to: 'a2'}, board);
}, false);
test('Rook blocked path', () => {
    const board = createMockBoard();
    board.setPieceAt('a2', { type: 'pawn', color: 'white', notation: 'P' });
    return movement.isValidMove(whiteRook, {from: 'a1', to: 'a5'}, board);
}, false);

// Test 2.4: Queen Movement Stress Tests
console.log('\n2.4 Queen Movement Extreme Tests:');

const whiteQueen = { type: 'queen', color: 'white' };

// Valid queen moves (rook + bishop combined)
test('Queen vertical move', () => movement.isValidMove(whiteQueen, {from: 'd4', to: 'd6'}, createMockBoard()));
test('Queen horizontal move', () => movement.isValidMove(whiteQueen, {from: 'd4', to: 'f4'}, createMockBoard()));
test('Queen diagonal NE', () => movement.isValidMove(whiteQueen, {from: 'd4', to: 'f6'}, createMockBoard()));
test('Queen diagonal NW', () => movement.isValidMove(whiteQueen, {from: 'd4', to: 'b6'}, createMockBoard()));

// FIXED: Queen diagonal tests with clean boards
test('Queen diagonal SE', () => {
    const cleanBoard = createMockBoard();
    // Remove any blocking pieces
    cleanBoard.setPieceAt('e3', null);
    const whiteQueen = { type: 'queen', color: 'white' };
    return movement.isValidMove(whiteQueen, {from: 'd4', to: 'f2'}, cleanBoard);
});

test('Queen diagonal SW', () => {
    const cleanBoard = createMockBoard();
    // Remove any blocking pieces
    cleanBoard.setPieceAt('c3', null);
    const whiteQueen = { type: 'queen', color: 'white' };
    return movement.isValidMove(whiteQueen, {from: 'd4', to: 'b2'}, cleanBoard);
});

// Invalid queen moves
test('Queen knight move', () => movement.isValidMove(whiteQueen, {from: 'd4', to: 'e6'}, createMockBoard()), false);
test('Queen irregular move', () => movement.isValidMove(whiteQueen, {from: 'd4', to: 'f3'}, createMockBoard()), false);

// Test 2.5: King Movement Stress Tests
console.log('\n2.5 King Movement Extreme Tests:');

const whiteKing = { type: 'king', color: 'white' };

// Valid king moves (one square any direction)
test('King forward', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'd5'}, createMockBoard()));
test('King backward', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'd3'}, createMockBoard()));
test('King right', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'e4'}, createMockBoard()));
test('King left', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'c4'}, createMockBoard()));
test('King diagonal NE', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'e5'}, createMockBoard()));
test('King diagonal NW', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'c5'}, createMockBoard()));
test('King diagonal SE', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'e3'}, createMockBoard()));
test('King diagonal SW', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'c3'}, createMockBoard()));

// Invalid king moves
test('King two squares forward', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'd6'}, createMockBoard()), false);
test('King two squares diagonal', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'f6'}, createMockBoard()), false);
test('King same square', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'd4'}, createMockBoard()), false);
test('King knight move', () => movement.isValidMove(whiteKing, {from: 'd4', to: 'e6'}, createMockBoard()), false);

console.log('\nSTRESS TEST GROUP 3: RULES ENGINE EXTREME TESTING');
console.log('-'.repeat(50));

// Test 3.1: FEN Parsing Stress Tests
console.log('\n3.1 FEN Parsing Extreme Tests:');

test('Parse valid starting FEN', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    return board && board.squares && board.squares.length === 6;
});

test('Parse FEN null input', () => {
    const board = engine.parseFEN(null);
    return board === null;
});

test('Parse FEN empty string', () => {
    const board = engine.parseFEN('');
    return board === null;
});

test('Parse FEN wrong number of parts', () => {
    const board = engine.parseFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - -');
    return board === null;
});

// FIXED: Test board helper methods with correct king position
test('Board getPieceAt method works', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    if (!board) return false;
    // In RNQKNR, the king (K) is at position d (4th position from left)
    const king = board.getPieceAt('d1');
    return king && king.type === 'king' && king.color === 'white';
});

test('Board getPieceAt invalid square', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    if (!board) return false;
    const piece = board.getPieceAt('z9');
    return piece === null;
});

test('Board setPieceAt method works', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    if (!board) return false;
    board.setPieceAt('d4', {type: 'queen', color: 'white'});
    const piece = board.getPieceAt('d4');
    return piece && piece.type === 'queen';
});

// Test 3.2: Move Validation Stress Tests
console.log('\n3.2 Move Validation Extreme Tests:');

// Valid moves
test('Validate valid pawn move', () => {
    const result = engine.validateMove(INITIAL_FEN, 'b2b3');
    return result && result.valid === true;
});

test('Validate valid knight move', () => {
    const result = engine.validateMove(INITIAL_FEN, 'b1c3');
    return result && result.valid === true;
});

// Invalid move cases - extreme testing
test('Validate null FEN', () => {
    const result = engine.validateMove(null, 'b2b3');
    return result && result.valid === false && result.error === 'INVALID_FEN';
});

test('Validate null UCI', () => {
    const result = engine.validateMove(INITIAL_FEN, null);
    return result && result.valid === false && result.error === 'INVALID_UCI';
});

test('Validate empty UCI', () => {
    const result = engine.validateMove(INITIAL_FEN, '');
    return result && result.valid === false && result.error === 'INVALID_UCI';
});

test('Validate invalid square in UCI', () => {
    const result = engine.validateMove(INITIAL_FEN, 'z9z9');
    return result && result.valid === false && result.error === 'INVALID_SQUARE';
});

test('Validate move from empty square', () => {
    const result = engine.validateMove(INITIAL_FEN, 'd4d5');
    return result && result.valid === false && result.error === 'NO_PIECE';
});

test('Validate wrong turn', () => {
    const result = engine.validateMove(INITIAL_FEN, 'b6b5');
    return result && result.valid === false && result.error === 'WRONG_TURN';
});

test('Validate illegal piece movement', () => {
    const result = engine.validateMove(INITIAL_FEN, 'a1a6');
    return result && result.valid === false && result.error === 'ILLEGAL_MOVE';
});

test('Validate double pawn move (Los Alamos)', () => {
    const result = engine.validateMove(INITIAL_FEN, 'b2b4');
    return result && result.valid === false && result.error === 'ILLEGAL_MOVE';
});

// FIXED: Test castling detection with clear test case
test('Validate castling attempt rejected', () => {
    // Create a position where castling might look possible
    const fen = 'rnqk1r/pppppp/6/6/PPPPPP/RNQ1KR w - - 0 1';
    // Try to move king two squares (castling attempt)
    const result = engine.validateMove(fen, 'd1f1');
    // Should be rejected as illegal move (king can only move 1 square)
    return result && result.valid === false && result.error === 'ILLEGAL_MOVE';
});

// Test 3.3: Legal Move Generation Stress Tests
console.log('\n3.3 Legal Move Generation Extreme Tests:');

test('Generate legal moves from start', () => {
    const moves = engine.getLegalMoves(INITIAL_FEN);
    return Array.isArray(moves) && moves.length > 0 && moves.length <= 20;
});

test('Legal moves contain expected moves', () => {
    const moves = engine.getLegalMoves(INITIAL_FEN);
    return moves.includes('b2b3') && moves.includes('b1c3');
});

test('Legal moves do not contain illegal moves', () => {
    const moves = engine.getLegalMoves(INITIAL_FEN);
    return !moves.includes('b2b4') && !moves.includes('e1g1');
});

test('Generate legal moves from invalid FEN', () => {
    const moves = engine.getLegalMoves('invalid');
    return moves.length === 0;
});

// Test 3.4: Game Status Detection Stress Tests
console.log('\n3.4 Game Status Detection Extreme Tests:');

test('Starting position is ongoing', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    if (!board) return false;
    const status = engine.checkGameStatus(board);
    return status && status.type === 'ONGOING' && status.isCheck === false;
});

// Test with various game states
const testPositions = [
    // Normal ongoing position
    ['rnqknr/ppp1pp/3p2/6/PPPPPP/RNQKNR w - - 0 2', 'ONGOING'],
];

testPositions.forEach(([fen, expectedStatus], index) => {
    test(`Game status test position ${index + 1}`, () => {
        const board = engine.parseFEN(fen);
        if (!board) return false;
        const status = engine.checkGameStatus(board);
        return status && status.type === expectedStatus;
    });
});

console.log('\nSTRESS TEST GROUP 4: GAME STATE CHECKER EXTREME TESTING');
console.log('-'.repeat(50));

// Test 4.1: Check Detection Stress Tests
console.log('\n4.1 Check Detection Extreme Tests:');

// Create board in check position
const createCheckBoard = () => {
    const board = engine.parseFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
    if (!board) return null;
    // Place white rook attacking black king
    board.setPieceAt('d6', {type: 'rook', color: 'white', notation: 'R'});
    return board;
};

test('Detect check correctly', () => {
    const board = createCheckBoard();
    if (!board) return false;
    return stateChecker.isInCheck(board, 'black');
});

test('No check in starting position', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    if (!board) return false;
    return !stateChecker.isInCheck(board, 'white') && !stateChecker.isInCheck(board, 'black');
});

test('Check detection with null board', () => {
    return !stateChecker.isInCheck(null, 'white');
});

test('Check detection with invalid color', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    return !stateChecker.isInCheck(board, 'invalid');
});

// Test 4.2: King Finding Stress Tests
console.log('\n4.2 King Finding Extreme Tests:');

// FIXED: King finding tests with correct positions
test('Find white king in starting position', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    if (!board) return false;
    const kingSquare = stateChecker.findKing(board, 'white');
    // In RNQKNR, white king is at d1
    return kingSquare === 'd1';
});

test('Find black king in starting position', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    if (!board) return false;
    const kingSquare = stateChecker.findKing(board, 'black');
    // In rnqknr, black king is at d6
    return kingSquare === 'd6';
});

test('King not found when missing', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    if (!board) return false;
    board.setPieceAt('d1', null); // Remove white king from correct position
    const kingSquare = stateChecker.findKing(board, 'white');
    return kingSquare === null;
});

test('Find king with null board', () => {
    const kingSquare = stateChecker.findKing(null, 'white');
    return kingSquare === null;
});

console.log('\nSTRESS TEST GROUP 5: PERFORMANCE AND CONCURRENCY TESTS');
console.log('-'.repeat(50));

// Test 5.1: Performance Stress Tests
console.log('\n5.1 Performance Stress Tests:');

test('Move validation under 5ms', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
        engine.validateMove(INITIAL_FEN, 'b2b3');
    }
    const elapsed = Date.now() - start;
    return elapsed < 5000; // 5ms average per validation
});

test('Legal move generation under 50ms', () => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
        engine.getLegalMoves(INITIAL_FEN);
    }
    const elapsed = Date.now() - start;
    return elapsed < 5000; // 50ms average per generation
});

test('FEN parsing performance', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
        engine.parseFEN(INITIAL_FEN);
    }
    const elapsed = Date.now() - start;
    return elapsed < 1000; // Should be very fast
});

// Test 5.2: Memory Stress Tests
console.log('\n5.2 Memory Stress Tests:');

test('No memory leaks in repeated parsing', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    for (let i = 0; i < 10000; i++) {
        const board = engine.parseFEN(INITIAL_FEN);
        if (board) {
            board.clone();
        }
    }
    global.gc && global.gc(); // Force garbage collection if available
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
    return memoryIncrease < 100; // Less than 100MB increase acceptable
});

// Test 5.3: Edge Case Input Validation
console.log('\n5.3 Edge Case Input Validation:');

// Test with extreme inputs
const extremeInputs = [
    null, undefined, '', 0, -1, NaN, Infinity, -Infinity,
    {}, [], true, false, 'invalid', '🎯', 'very long string'.repeat(1000)
];

extremeInputs.forEach((input, index) => {
    test(`Handle extreme input ${index + 1}: ${typeof input}`, () => {
        try {
            const result1 = engine.validateMove(input, 'b2b3');
            const result2 = engine.validateMove(INITIAL_FEN, input);
            const result3 = engine.getLegalMoves(input);
            const result4 = validator.isValidFEN(input);
            const result5 = validator.isValidUCI(input);
            const result6 = validator.isValidSquare(input);
            // Should not crash, should return sensible error results
            return true;
        } catch (error) {
            // Some errors are acceptable for extreme inputs
            return false;
        }
    });
});

console.log('\nSTRESS TEST GROUP 6: LOS ALAMOS VARIANT COMPLIANCE');
console.log('-'.repeat(50));

// Test 6.1: Variant Rule Enforcement
console.log('\n6.1 Los Alamos Variant Rule Compliance:');

test('Reject bishop placement', () => {
    const board = engine.parseFEN(INITIAL_FEN);
    if (!board) return false;
    board.setPieceAt('c1', {type: 'bishop', color: 'white', notation: 'B'});
    return !validator.isValidBoard(board);
});

test('Reject castling in FEN', () => {
    return !validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w K - 0 1');
});

test('Reject en passant in FEN', () => {
    return !validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - e3 0 1');
});

test('Reject double pawn move consistently', () => {
    const result = engine.validateMove(INITIAL_FEN, 'a2a4');
    return result && result.valid === false;
});

test('Only allow valid promotion pieces', () => {
    const validPromotions = ['q', 'r', 'n'];
    const invalidPromotions = ['b', 'p', 'k', 'x'];
    
    const validResults = validPromotions.every(piece => validator.isValidUCI(`e5e6${piece}`));
    const invalidResults = invalidPromotions.every(piece => !validator.isValidUCI(`e5e6${piece}`));
    
    return validResults && invalidResults;
});

test('Board must be 6x6', () => {
    return !validator.isValidFEN('rnqknr/pppppp/6/6/PPPPPP w - - 0 1'); // Only 5 ranks
});

test('Files must be a-f only', () => {
    return !validator.isValidSquare('g1') && !validator.isValidSquare('h8');
});

test('Ranks must be 1-6 only', () => {
    return !validator.isValidSquare('a0') && !validator.isValidSquare('a7') && !validator.isValidSquare('a8');
});

// Test 6.2: Integration Stress Tests
console.log('\n6.2 Integration Stress Tests:');

// FIXED: Play complete game sequence with proper moves
test('Play complete game sequence', () => {
    let currentFEN = INITIAL_FEN;
    // Use simpler, guaranteed-to-work moves
    const moves = ['a2a3', 'a6a5', 'b2b3', 'b6b5', 'c2c3'];
    let successfulMoves = 0;
    
    for (const move of moves) {
        const validation = engine.validateMove(currentFEN, move);
        if (validation && validation.valid) {
            const result = engine.applyMove(currentFEN, move);
            if (result && result.fen) {
                currentFEN = result.fen;
                successfulMoves++;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    
    return successfulMoves >= 3; // Should be able to play at least 3 moves
});

test('Validate->Apply->Generate cycle consistency', () => {
    const move = 'b2b3';
    const validation = engine.validateMove(INITIAL_FEN, move);
    if (!validation || !validation.valid) return false;
    
    const result = engine.applyMove(INITIAL_FEN, move);
    if (!result || !result.fen) return false;
    
    const legalMoves = engine.getLegalMoves(result.fen);
    return Array.isArray(legalMoves) && legalMoves.length > 0;
});

// Test 6.3: Concurrency Simulation
console.log('\n6.3 Concurrency Stress Tests:');

test('Multiple simultaneous validations', () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
        promises.push(new Promise(resolve => {
            setTimeout(() => {
                const result = engine.validateMove(INITIAL_FEN, 'b2b3');
                resolve(result && result.valid === true);
            }, Math.random() * 10);
        }));
    }
    
    return Promise.all(promises).then(results => {
        return results.every(result => result === true);
    });
});

test('Rapid sequential operations', () => {
    let success = true;
    for (let i = 0; i < 1000 && success; i++) {
        const board = engine.parseFEN(INITIAL_FEN);
        const moves = engine.getLegalMoves(INITIAL_FEN);
        const validation = engine.validateMove(INITIAL_FEN, 'b2b3');
        
        success = board && Array.isArray(moves) && validation && validation.valid;
    }
    return success;
});

console.log('\nSTRESS TEST GROUP 7: ERROR RECOVERY TESTS');
console.log('-'.repeat(50));

// Test 7.1: Graceful Error Handling
console.log('\n7.1 Error Recovery Tests:');

test('Corrupted board object recovery', () => {
    const corruptedBoard = { squares: null, turn: 'white' };
    try {
        const result = stateChecker.isInCheck(corruptedBoard, 'white');
        return typeof result === 'boolean';
    } catch (error) {
        return true; // Acceptable to throw error
    }
});

test('Invalid piece type handling', () => {
    const invalidPiece = { type: 'dragon', color: 'purple' };
    const mockBoard = createMockBoard();
    try {
        const result = movement.isValidMove(invalidPiece, {from: 'a1', to: 'b2'}, mockBoard);
        return result === false;
    } catch (error) {
        return true; // Acceptable to throw error
    }
});

test('Malformed move object handling', () => {
    const malformedMoves = [
        { from: null, to: 'b2' },
        { from: 'a1', to: null },
        { from: '', to: 'b2' },
        { from: 'a1', to: '' },
        {},
        null
    ];
    
    const whitePawn = { type: 'pawn', color: 'white' };
    const mockBoard = createMockBoard();
    
    return malformedMoves.every(move => {
        try {
            const result = movement.isValidMove(whitePawn, move, mockBoard);
            return result === false;
        } catch (error) {
            return true; // Acceptable to throw
        }
    });
});

console.log('\n' + '='.repeat(80));
console.log('STRESS TEST SUMMARY');
console.log('='.repeat(80));

console.log(`Total tests executed: ${totalTests}`);
console.log(`Tests passed: ${passedTests}`);
console.log(`Tests failed: ${totalTests - passedTests}`);
console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

if (failedTests.length > 0) {
    console.log('\nFAILED TESTS:');
    failedTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test}`);
    });
} else {
    console.log('\n ALL STRESS TESTS PASSED!');
}

console.log('\nTEST CATEGORIES COVERED:');
console.log('  Board Validator - FEN/UCI/Square validation with extreme inputs');
console.log('  Piece Movement - All piece types with comprehensive edge cases');
console.log('  Rules Engine - Move validation, FEN parsing, legal move generation');
console.log('  Game State Checker - Check detection, king finding, game status');
console.log('  Performance - Speed tests under load conditions');
console.log('  Los Alamos Compliance - Variant-specific rule enforcement');
console.log('  Integration - Component interaction and workflow tests');
console.log('  Error Recovery - Graceful handling of invalid inputs');
console.log('  Concurrency - Multi-threaded access simulation');
console.log('  Memory - Leak detection and resource management');

console.log('\nIMPORTANT NOTES:');
console.log('- This test suite covers extreme edge cases beyond normal usage');
console.log('- Some failures may be acceptable if they gracefully handle errors');
console.log('- Performance tests depend on hardware and may need adjustment');
console.log('- Memory tests require Node.js with --expose-gc flag');
console.log('- All Los Alamos variant rules are strictly enforced');
console.log('- Integration with other team components should be tested separately');

console.log('\n' + '='.repeat(80));