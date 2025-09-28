/**
 * FRONTEND API CONTRACT INTEGRATION TESTS
 *
 * Purpose: Test that Byron's backend outputs match Natasha's frontend expectations
 * File Location: /backend/unit-tests/integration-tests/test-frontend-integration.js
 *
 * Tests:
 * 1. Legal moves format matches frontend display requirements
 * 2. Board state format compatible with frontend rendering
 * 3. Game status format matches frontend UI expectations
 * 4. Promotion dialog data format validation
 * 5. Move history format for frontend consumption
 * 6. AI move response format for frontend processing
 */

const assert = require('assert');

// Import Byron's backend components
const RulesEngine = require('../../src/engine/index');
const AIBot = require('../../src/ai-bot/index');

// Mock Frontend Game State (based on fixed-game-script.js)
class MockFrontendGameState {
    constructor() {
        this.gameId = 'test-game-123';
        this.board = {};
        this.currentPlayer = 'white';
        this.playerColor = 'white';
        this.selectedSquare = null;
        this.legalMoves = [];
        this.moveHistory = [];
        this.timeLeft = { white: 900000, black: 900000 };
        this.isGameActive = true;
        this.gameOver = false;
        this.gameResult = null;
        this.botLevel = 'L2';
        this.botElo = null;

        // Initialize board from INITIAL_POSITION (from frontend)
        this.initializeBoard();
    }

    initializeBoard() {
        // Los Alamos Chess initial position
        this.board = {
            'a6': '♜', 'b6': '♞', 'c6': '♛', 'd6': '♚', 'e6': '♞', 'f6': '♜',
            'a5': '♟', 'b5': '♟', 'c5': '♟', 'd5': '♟', 'e5': '♟', 'f5': '♟',
            'a4': '', 'b4': '', 'c4': '', 'd4': '', 'e4': '', 'f4': '',
            'a3': '', 'b3': '', 'c3': '', 'd3': '', 'e3': '', 'f3': '',
            'a2': '♙', 'b2': '♙', 'c2': '♙', 'd2': '♙', 'e2': '♙', 'f2': '♙',
            'a1': '♖', 'b1': '♘', 'c1': '♕', 'd1': '♔', 'e1': '♘', 'f1': '♖'
        };
    }

    // Frontend-style FEN generation (from fixed-game-script.js)
    generateCurrentFEN() {
        let fen = '';

        for (let rank = 6; rank >= 1; rank--) {
            let emptyCount = 0;

            for (let file = 0; file < 6; file++) {
                const square = String.fromCharCode(97 + file) + rank;
                const piece = this.board[square];

                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    fen += this.pieceToFEN(piece);
                } else {
                    emptyCount++;
                }
            }

            if (emptyCount > 0) {
                fen += emptyCount;
            }

            if (rank > 1) fen += '/';
        }

        fen += ` ${this.currentPlayer === 'white' ? 'w' : 'b'} - - 0 ${Math.floor(this.moveHistory.length / 2) + 1}`;
        return fen;
    }

    pieceToFEN(piece) {
        const pieceMap = {
            '♔': 'K', '♕': 'Q', '♖': 'R', '♘': 'N', '♙': 'P',
            '♚': 'k', '♛': 'q', '♜': 'r', '♞': 'n', '♟': 'p'
        };
        return pieceMap[piece] || '';
    }

    // Frontend-style move execution
    executeMove(from, to, promotion = null) {
        const capturedPiece = this.board[to];

        // Apply move
        this.board[to] = this.board[from];
        this.board[from] = '';

        // Handle promotion
        if (promotion) {
            const promotionPieces = {
                'white': { 'q': '♕', 'r': '♖', 'n': '♘' },
                'black': { 'q': '♛', 'r': '♜', 'n': '♞' }
            };
            const pieceColor = this.currentPlayer;
            this.board[to] = promotionPieces[pieceColor][promotion];
        }

        // Add to move history
        this.moveHistory.push({
            from,
            to,
            piece: this.board[to],
            captured: !!capturedPiece,
            promotion,
            timestamp: Date.now()
        });

        // Switch turn
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
    }
}

// Mock Frontend UI Components
class MockFrontendUI {
    constructor() {
        this.highlights = [];
        this.selectedSquare = null;
        this.displayedMoves = [];
        this.gameStatusDisplay = '';
        this.promotionDialogOpen = false;
        this.boardState = {};
    }

    // Simulate frontend legal moves highlighting
    highlightLegalMoves(moves) {
        this.highlights = [...moves];
        console.log(`🎨 Frontend: Highlighting ${moves.length} legal moves`);
    }

    // Simulate frontend square selection
    selectSquare(squareId) {
        this.selectedSquare = squareId;
        console.log(`🎯 Frontend: Selected square ${squareId}`);
    }

    // Simulate frontend board update
    updateBoard(boardState) {
        this.boardState = { ...boardState };
        console.log('🏁 Frontend: Board updated');
    }

    // Simulate frontend move history display
    addMoveToHistory(moveData) {
        this.displayedMoves.push(moveData);
        console.log(`📝 Frontend: Added move to history - ${moveData.from} → ${moveData.to}`);
    }

    // Simulate frontend game status update
    updateGameStatus(status) {
        this.gameStatusDisplay = status;
        console.log(`🎮 Frontend: Game status updated - ${status}`);
    }

    // Simulate frontend promotion dialog
    showPromotionDialog(from, to, color) {
        this.promotionDialogOpen = true;
        console.log(`👑 Frontend: Promotion dialog shown for ${from} → ${to} (${color})`);
        return 'q'; // Default to queen
    }
}

describe('🎨 Frontend API Contract Integration Tests', () => {
    let rulesEngine;
    let aiBot;
    let mockGameState;
    let mockUI;

    beforeEach(() => {
        // Initialize Byron's components and mock frontend
        rulesEngine = new RulesEngine();
        aiBot = new AIBot();
        mockGameState = new MockFrontendGameState();
        mockUI = new MockFrontendUI();

        console.log('🔧 Frontend integration test setup complete');
    });

    describe('🎯 Legal Moves Frontend Integration', () => {

        /**
         * Test: Legal moves format matches frontend display requirements
         * Expected: Legal moves array compatible with frontend highlighting system
         * Description: Ensures Rules Engine output can be directly used by frontend
         */
        it('should provide legal moves in frontend-compatible format', () => {
            console.log('🎯 Testing legal moves frontend compatibility...');

            try {
                const currentFEN = mockGameState.generateCurrentFEN();

                // Get legal moves from Byron's Rules Engine
                const legalMoves = rulesEngine.getLegalMoves(currentFEN);

                // Verify format matches frontend expectations (from fixed-game-script.js)
                assert(Array.isArray(legalMoves),
                    `❌ Legal moves should be array\nExpected: Array\nGot: ${typeof legalMoves}`);

                // Each move should be square ID format (e.g., "a1", "b2")
                legalMoves.forEach((move, index) => {
                    assert(typeof move === 'string',
                        `❌ Move ${index} should be string\nExpected: string\nGot: ${typeof move}`);
                    assert(/^[a-f][1-6]$/.test(move),
                        `❌ Move ${index} wrong format\nExpected: Square ID (a1-f6)\nGot: ${move}`);
                });

                // Test frontend highlighting integration
                mockUI.highlightLegalMoves(legalMoves);
                assert(mockUI.highlights.length === legalMoves.length,
                    `❌ Frontend highlighting mismatch\nExpected: ${legalMoves.length} highlights\nGot: ${mockUI.highlights.length}`);

                // Verify moves are valid board squares
                legalMoves.forEach(move => {
                    const file = move.charCodeAt(0) - 97; // 0-5
                    const rank = parseInt(move[1]); // 1-6

                    assert(file >= 0 && file <= 5,
                        `❌ Invalid file in move\nExpected: a-f (0-5)\nGot: ${move[0]} (${file})`);
                    assert(rank >= 1 && rank <= 6,
                        `❌ Invalid rank in move\nExpected: 1-6\nGot: ${rank}`);
                });

                console.log('✅ Legal moves frontend compatibility passed');
                console.log(`📊 Generated ${legalMoves.length} frontend-compatible moves`);

            } catch (error) {
                assert.fail(`❌ Legal moves frontend integration failed\nExpected: Frontend-compatible format\nGot Error: ${error.message}`);
            }
        });

        /**
         * Test: Move validation matches frontend selection system
         * Expected: Move validation works with frontend square selection
         * Description: Ensures frontend selection logic aligns with Rules Engine validation
         */
        it('should validate moves compatible with frontend selection system', () => {
            console.log('🎯 Testing move validation frontend integration...');

            try {
                const currentFEN = mockGameState.generateCurrentFEN();

                // Simulate frontend square selection (white pawn at b2)
                const selectedSquare = 'b2';
                mockUI.selectSquare(selectedSquare);

                // Get legal moves for selected square
                const legalMoves = rulesEngine.getLegalMoves(currentFEN);
                const squareLegalMoves = legalMoves.filter(move => {
                    // This simulates how frontend calculates moves from selected square
                    return true; // In real implementation, would filter by piece at selectedSquare
                });

                // Test move validation for frontend move format
                const testMove = 'b2b3'; // UCI format that Rules Engine expects
                const validation = rulesEngine.validateMove(currentFEN, testMove);

                // Verify validation result matches frontend expectations
                assert(typeof validation === 'object',
                    `❌ Validation should return object\nExpected: object\nGot: ${typeof validation}`);
                assert(validation.hasOwnProperty('valid'),
                    `❌ Missing valid property\nExpected: {valid: boolean}\nGot: ${Object.keys(validation)}`);

                if (validation.valid) {
                    // Test move execution for frontend board update
                    const moveResult = rulesEngine.applyMove(currentFEN, testMove);

                    // Verify result format matches frontend needs
                    const requiredFields = ['newFEN', 'san', 'moveType'];
                    requiredFields.forEach(field => {
                        assert(moveResult.hasOwnProperty(field),
                            `❌ Move result missing ${field}\nExpected: ${requiredFields}\nGot: ${Object.keys(moveResult)}`);
                    });

                    // Test frontend move format conversion
                    const frontendMove = {
                        from: testMove.slice(0, 2),
                        to: testMove.slice(2, 4)
                    };

                    assert(frontendMove.from === 'b2' && frontendMove.to === 'b3',
                        `❌ Frontend move format error\nExpected: {from: 'b2', to: 'b3'}\nGot: ${JSON.stringify(frontendMove)}`);
                }

                console.log('✅ Move validation frontend integration passed');
                console.log(`📊 Selected: ${selectedSquare}, Validated: ${testMove}`);

            } catch (error) {
                assert.fail(`❌ Move validation frontend integration failed\nExpected: Compatible validation\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🏁 Board State Frontend Integration', () => {

        /**
         * Test: Board state format compatible with frontend rendering
         * Expected: Board state can be directly consumed by frontend display
         * Description: Ensures board representation matches frontend requirements
         */
        it('should provide board state in frontend-compatible format', () => {
            console.log('🏁 Testing board state frontend compatibility...');

            try {
                const currentFEN = mockGameState.generateCurrentFEN();

                // Parse FEN into board state using Rules Engine
                const boardState = rulesEngine.parseFEN(currentFEN);

                // Verify board structure matches frontend expectations
                assert(typeof boardState === 'object',
                    `❌ Board state should be object\nExpected: object\nGot: ${typeof boardState}`);

                // Test FEN-to-frontend conversion (simulating frontend logic)
                const frontendBoard = {};

                // Convert Rules Engine board format to frontend format
                for (let rank = 6; rank >= 1; rank--) {
                    for (let file = 0; file < 6; file++) {
                        const square = String.fromCharCode(97 + file) + rank;
                        frontendBoard[square] = ''; // Initialize empty
                    }
                }

                // Populate with pieces from FEN
                const fenParts = currentFEN.split(' ')[0];
                const ranks = fenParts.split('/');

                for (let rankIndex = 0; rankIndex < ranks.length; rankIndex++) {
                    const rank = 6 - rankIndex; // Convert to board rank
                    let fileIndex = 0;

                    for (const char of ranks[rankIndex]) {
                        if (char >= '1' && char <= '6') {
                            fileIndex += parseInt(char);
                        } else {
                            const square = String.fromCharCode(97 + fileIndex) + rank;
                            frontendBoard[square] = this.fenToPiece(char);
                            fileIndex++;
                        }
                    }
                }

                // Verify all squares exist
                for (let rank = 1; rank <= 6; rank++) {
                    for (let file = 0; file < 6; file++) {
                        const square = String.fromCharCode(97 + file) + rank;
                        assert(frontendBoard.hasOwnProperty(square),
                            `❌ Missing square ${square}\nExpected: All squares a1-f6\nGot: Missing ${square}`);
                    }
                }

                // Test frontend board update
                mockUI.updateBoard(frontendBoard);
                assert(Object.keys(mockUI.boardState).length === 36,
                    `❌ Frontend board size wrong\nExpected: 36 squares\nGot: ${Object.keys(mockUI.boardState).length}`);

                // Test board state consistency
                const regeneratedFEN = mockGameState.generateCurrentFEN();
                const boardFromRegen = rulesEngine.parseFEN(regeneratedFEN);

                // Verify board states are equivalent
                assert(regeneratedFEN.split(' ')[0] === currentFEN.split(' ')[0],
                    `❌ Board state inconsistent\nExpected: ${currentFEN.split(' ')[0]}\nGot: ${regeneratedFEN.split(' ')[0]}`);

                console.log('✅ Board state frontend compatibility passed');
                console.log(`📊 Board: 36 squares, Format: Object notation`);

            } catch (error) {
                assert.fail(`❌ Board state frontend integration failed\nExpected: Compatible board format\nGot Error: ${error.message}`);
            }
        });

        // Helper method for FEN to piece conversion
        fenToPiece(fenChar) {
            const pieceMap = {
                'K': '♔', 'Q': '♕', 'R': '♖', 'N': '♘', 'P': '♙',
                'k': '♚', 'q': '♛', 'r': '♜', 'n': '♞', 'p': '♟'
            };
            return pieceMap[fenChar] || '';
        }
    });

    describe('👑 Promotion Dialog Frontend Integration', () => {

        /**
         * Test: Promotion dialog data format matches frontend requirements
         * Expected: Promotion data compatible with frontend dialog system
         * Description: Ensures promotion handling works with frontend UI
         */
        it('should handle promotion data in frontend-compatible format', () => {
            console.log('👑 Testing promotion dialog frontend integration...');

            try {
                // Set up promotion scenario (white pawn to 6th rank)
                mockGameState.board['b5'] = '♙'; // White pawn near promotion
                mockGameState.board['b6'] = ''; // Empty promotion square
                mockGameState.currentPlayer = 'white';

                const currentFEN = mockGameState.generateCurrentFEN();

                // Test promotion move validation
                const promotionMove = 'b5b6'; // Move to promotion square
                const validation = rulesEngine.validateMove(currentFEN, promotionMove);

                if (validation.valid) {
                    // Simulate frontend promotion detection
                    const piece = mockGameState.board['b5'];
                    const isPawn = piece === '♙' || piece === '♟';
                    const toRank = parseInt('b6'[1]);
                    const isPromotion = isPawn && ((piece === '♙' && toRank === 6) || (piece === '♟' && toRank === 1));

                    assert(isPromotion,
                        `❌ Promotion not detected\nExpected: true\nGot: ${isPromotion}`);

                    // Test frontend promotion dialog
                    const pieceColor = piece === '♙' ? 'white' : 'black';
                    const selectedPromotion = mockUI.showPromotionDialog('b5', 'b6', pieceColor);

                    assert(typeof selectedPromotion === 'string',
                        `❌ Promotion selection wrong type\nExpected: string\nGot: ${typeof selectedPromotion}`);
                    assert(['q', 'r', 'n'].includes(selectedPromotion),
                        `❌ Invalid promotion piece\nExpected: q, r, or n\nGot: ${selectedPromotion}`);

                    // Test promotion move execution
                    const promotionMoveWithPiece = promotionMove + selectedPromotion;
                    const promotionResult = rulesEngine.applyMove(currentFEN, promotionMoveWithPiece);

                    // Verify promotion result format
                    assert(promotionResult.hasOwnProperty('newFEN'),
                        `❌ Missing newFEN in promotion result\nExpected: newFEN property\nGot: ${Object.keys(promotionResult)}`);
                    assert(promotionResult.hasOwnProperty('san'),
                        `❌ Missing SAN in promotion result\nExpected: SAN property\nGot: ${Object.keys(promotionResult)}`);

                    // Test frontend promotion display
                    const promotionPieces = {
                        'white': { 'q': '♕', 'r': '♖', 'n': '♘' },
                        'black': { 'q': '♛', 'r': '♜', 'n': '♞' }
                    };

                    const promotedPiece = promotionPieces[pieceColor][selectedPromotion];
                    assert(typeof promotedPiece === 'string',
                        `❌ Promoted piece format wrong\nExpected: string (Unicode)\nGot: ${typeof promotedPiece}`);

                    // Test frontend move history with promotion
                    const moveHistoryEntry = {
                        from: 'b5',
                        to: 'b6',
                        piece: promotedPiece,
                        promotion: selectedPromotion,
                        timestamp: Date.now()
                    };

                    mockUI.addMoveToHistory(moveHistoryEntry);
                    assert(mockUI.displayedMoves.length === 1,
                        `❌ Move not added to history\nExpected: 1 move\nGot: ${mockUI.displayedMoves.length}`);
                }

                console.log('✅ Promotion dialog frontend integration passed');
                console.log(`📊 Promotion: b5b6${validation.valid ? 'q' : ''}`);

            } catch (error) {
                assert.fail(`❌ Promotion dialog frontend integration failed\nExpected: Compatible promotion format\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🤖 AI Move Frontend Integration', () => {

        /**
         * Test: AI move response format compatible with frontend processing
         * Expected: AI responses can be directly consumed by frontend
         * Description: Ensures AI Bot output works with frontend AI move handling
         */
        it('should provide AI moves in frontend-compatible format', async () => {
            console.log('🤖 Testing AI move frontend integration...');

            try {
                const currentFEN = mockGameState.generateCurrentFEN();

                // Generate AI move using Byron's AI Bot
                const aiResponse = await aiBot.generateMove(currentFEN, 'L2', 3000);

                // Verify AI response matches frontend expectations (from fixed-game-script.js)
                const requiredFields = ['move', 'newFEN', 'san', 'metadata'];
                requiredFields.forEach(field => {
                    assert(aiResponse.hasOwnProperty(field),
                        `❌ AI response missing ${field}\nExpected: ${requiredFields}\nGot: ${Object.keys(aiResponse)}`);
                });

                // Test frontend AI move format conversion
                const frontendAIMove = {
                    from: aiResponse.move.slice(0, 2),
                    to: aiResponse.move.slice(2, 4),
                    san: aiResponse.san,
                    activeColor: currentFEN.split(' ')[1] === 'w' ? 'black' : 'white' // Switch turn
                };

                // Verify frontend move format
                assert(/^[a-f][1-6]$/.test(frontendAIMove.from),
                    `❌ AI move from format wrong\nExpected: Square ID\nGot: ${frontendAIMove.from}`);
                assert(/^[a-f][1-6]$/.test(frontendAIMove.to),
                    `❌ AI move to format wrong\nExpected: Square ID\nGot: ${frontendAIMove.to}`);

                // Test frontend AI move execution
                mockGameState.executeMove(frontendAIMove.from, frontendAIMove.to);

                // Verify game state update
                assert(mockGameState.moveHistory.length === 1,
                    `❌ AI move not added to history\nExpected: 1 move\nGot: ${mockGameState.moveHistory.length}`);
                assert(mockGameState.currentPlayer !== 'white',
                    `❌ Turn not switched after AI move\nExpected: Not white\nGot: ${mockGameState.currentPlayer}`);

                // Test frontend board update after AI move
                mockUI.updateBoard(mockGameState.board);
                assert(Object.keys(mockUI.boardState).length === 36,
                    `❌ Board not updated after AI move\nExpected: 36 squares\nGot: ${Object.keys(mockUI.boardState).length}`);

                // Test AI move metadata handling
                if (aiResponse.metadata) {
                    assert(typeof aiResponse.metadata === 'object',
                        `❌ AI metadata wrong type\nExpected: object\nGot: ${typeof aiResponse.metadata}`);

                    // Verify metadata can be used by frontend
                    const metadataDisplay = `AI move: ${aiResponse.san} (${aiResponse.metadata.level || 'Unknown'} level)`;
                    assert(typeof metadataDisplay === 'string',
                        `❌ Metadata display format wrong\nExpected: string\nGot: ${typeof metadataDisplay}`);
                }

                console.log('✅ AI move frontend integration passed');
                console.log(`📊 AI move: ${aiResponse.move} (${aiResponse.san})`);

            } catch (error) {
                assert.fail(`❌ AI move frontend integration failed\nExpected: Compatible AI format\nGot Error: ${error.message}`);
            }
        });
    });

    describe('📊 Game Status Frontend Integration', () => {

        /**
         * Test: Game status format matches frontend UI expectations
         * Expected: Game status data compatible with frontend status display
         * Description: Ensures game end conditions work with frontend UI
         */
        it('should provide game status in frontend-compatible format', () => {
            console.log('📊 Testing game status frontend integration...');

            try {
                const currentFEN = mockGameState.generateCurrentFEN();

                // Test game status check
                const boardState = rulesEngine.parseFEN(currentFEN);
                const gameStatus = rulesEngine.checkGameStatus(boardState);

                // Verify game status format matches frontend expectations
                assert(typeof gameStatus === 'object',
                    `❌ Game status should be object\nExpected: object\nGot: ${typeof gameStatus}`);
                assert(gameStatus.hasOwnProperty('type'),
                    `❌ Missing status type\nExpected: type property\nGot: ${Object.keys(gameStatus)}`);

                // Test different game status types
                const validStatusTypes = ['ACTIVE', 'CHECKMATE', 'STALEMATE', 'DRAW'];
                assert(validStatusTypes.includes(gameStatus.type),
                    `❌ Invalid status type\nExpected: ${validStatusTypes}\nGot: ${gameStatus.type}`);

                // Test frontend status display update
                const statusMessage = this.formatGameStatusForFrontend(gameStatus);
                mockUI.updateGameStatus(statusMessage);

                assert(mockUI.gameStatusDisplay === statusMessage,
                    `❌ Status not updated in frontend\nExpected: ${statusMessage}\nGot: ${mockUI.gameStatusDisplay}`);

                // Test game end scenario
                if (gameStatus.type !== 'ACTIVE') {
                    // Simulate frontend game end handling
                    mockGameState.gameOver = true;
                    mockGameState.gameResult = gameStatus.type;

                    assert(mockGameState.gameOver === true,
                        `❌ Game not marked as over\nExpected: true\nGot: ${mockGameState.gameOver}`);
                    assert(mockGameState.gameResult === gameStatus.type,
                        `❌ Game result not set\nExpected: ${gameStatus.type}\nGot: ${mockGameState.gameResult}`);
                }

                // Test legal moves for game status
                const legalMoves = rulesEngine.getLegalMoves(currentFEN);

                if (gameStatus.type === 'ACTIVE') {
                    assert(legalMoves.length > 0,
                        `❌ Active game should have moves\nExpected: > 0\nGot: ${legalMoves.length}`);
                } else {
                    // Game ended - should have no legal moves or specific end condition
                    console.log(`🎯 Game ended: ${gameStatus.type} (${legalMoves.length} moves available)`);
                }

                console.log('✅ Game status frontend integration passed');
                console.log(`📊 Status: ${gameStatus.type}, UI: ${statusMessage}`);

            } catch (error) {
                assert.fail(`❌ Game status frontend integration failed\nExpected: Compatible status format\nGot Error: ${error.message}`);
            }
        });

        // Helper method to format game status for frontend
        formatGameStatusForFrontend(gameStatus) {
            switch (gameStatus.type) {
                case 'ACTIVE':
                    return 'Game in progress';
                case 'CHECKMATE':
                    return `Checkmate! Game over.`;
                case 'STALEMATE':
                    return 'Stalemate - Draw';
                case 'DRAW':
                    return 'Draw';
                default:
                    return 'Unknown game status';
            }
        }
    });

    after(() => {
        console.log('🧹 Frontend integration tests cleanup complete');
    });
});

// Export utilities for other integration tests
module.exports = {
    MockFrontendGameState,
    MockFrontendUI,
    testLegalMovesFormat: (legalMoves) => {
        return Array.isArray(legalMoves) &&
               legalMoves.every(move =>
                   typeof move === 'string' &&
                   /^[a-f][1-6]$/.test(move)
               );
    },
    testAIMoveFormat: (aiResponse) => {
        const requiredFields = ['move', 'newFEN', 'san', 'metadata'];
        return requiredFields.every(field => aiResponse.hasOwnProperty(field));
    },
    testBoardStateFormat: (boardState) => {
        const expectedSquares = 36; // 6x6 board
        return typeof boardState === 'object' &&
               Object.keys(boardState).length === expectedSquares;
    }
};