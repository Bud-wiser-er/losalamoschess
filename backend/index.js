const PieceMovement = require('./piece-movement');
const BoardValidator = require('./board-validator');
const GameStateChecker = require('./game-state-checker');
const LOS_ALAMOS_CONSTANTS = require('./constants');

class RulesEngine {
    constructor() {
        this.pieceMovement = new PieceMovement();
        this.boardValidator = new BoardValidator();
        this.gameStateChecker = new GameStateChecker();
        this.positionHistory = []; // Track positions for threefold repetition
    }

    /**
     * Main validation function - checks if a move is legal
     * @param {string} fen - Current board position in FEN format
     * @param {string} uci - Move in UCI format (e.g., "b2b3", "e5e6q" for promotion)
     * @returns {Object} Validation result with detailed information
     */
    validateMove(fen, uci) {
        // Step 1: Parse FEN
        const board = this.parseFEN(fen);
        if (!board) {
            return {
                valid: false,
                error: 'INVALID_FEN',
                details: 'Cannot parse FEN string'
            };
        }

        // Step 2: Parse UCI move
        const move = this.parseUCI(uci);
        if (!move) {
            return {
                valid: false,
                error: 'INVALID_UCI',
                details: 'Cannot parse UCI move'
            };
        }

        // Step 3: Basic validation
        if (!this.basicValidation(board, move)) {
            return {
                valid: false,
                error: 'INVALID_SQUARE',
                details: 'Move references invalid square'
            };
        }

        // Step 4: Check piece exists and belongs to current player
        const piece = board.getPieceAt(move.from);
        if (!piece) {
            return {
                valid: false,
                error: 'NO_PIECE',
                details: 'No piece at source square'
            };
        }

        if (piece.color !== board.turn) {
            return {
                valid: false,
                error: 'WRONG_TURN',
                details: `It's ${board.turn}'s turn`
            };
        }

        // Step 5: Validate piece movement
        if (!this.pieceMovement.isValidMove(piece, move, board)) {
            return {
                valid: false,
                error: 'ILLEGAL_MOVE',
                details: 'Piece cannot move that way'
            };
        }

        // Step 6: Check for castling attempt (ALWAYS ILLEGAL in Los Alamos)
        if (this.isCastlingAttempt(piece, move)) {
            return {
                valid: false,
                error: 'NO_CASTLING',
                details: 'Castling is not allowed in Los Alamos chess'
            };
        }

        // Step 7: Check for en passant attempt (ALWAYS ILLEGAL in Los Alamos)
        if (this.isEnPassantAttempt(piece, move, board)) {
            return {
                valid: false,
                error: 'NO_EN_PASSANT',
                details: 'En passant is not allowed in Los Alamos chess'
            };
        }

        // Step 8: Check promotion validity
        if (this.isPromotionMove(piece, move) && move.promotion) {
            if (!this.isValidPromotion(move.promotion)) {
                return {
                    valid: false,
                    error: 'INVALID_PROMOTION',
                    details: 'Invalid promotion piece for Los Alamos chess'
                };
            }
        }

        // Step 9: Would move leave king in check?
        const testBoard = this.cloneBoard(board);
        testBoard.makeMove(move);
        if (this.gameStateChecker.isInCheck(testBoard, board.turn)) {
            return {
                valid: false,
                error: 'LEAVES_KING_IN_CHECK',
                details: 'Move would leave your king in check'
            };
        }

        // Move is valid!
        return {
            valid: true,
            flags: {
                check: this.gameStateChecker.isInCheck(testBoard, this.opponent(board.turn)),
                capture: board.getPieceAt(move.to) !== null,
                promotion: this.isPromotionMove(piece, move)
            }
        };
    }

    /**
     * Applies a validated move and returns new game state
     * @param {string} fen - Current position
     * @param {string} uci - Move to apply (already validated)
     * @returns {Object} New game state with FEN and status
     */
    applyMove(fen, uci) {
        const board = this.parseFEN(fen);
        const move = this.parseUCI(uci);

        // Apply the move
        const capturedPiece = board.getPieceAt(move.to);
        board.makeMove(move);

        // Update turn
        board.turn = board.turn === 'white' ? 'black' : 'white';
        board.fullMoveNumber += board.turn === 'white' ? 1 : 0;

        // Update fifty-move rule counter
        if (capturedPiece || board.getPieceAt(move.to).type === 'pawn') {
            board.halfMoveClock = 0;
        } else {
            board.halfMoveClock++;
        }

        // Check game status
        const status = this.checkGameStatus(board);

        return {
            fen: this.generateFEN(board),
            status: status.type, // 'ONGOING', 'CHECKMATE', 'STALEMATE', 'DRAW'
            flags: {
                check: status.isCheck,
                checkmate: status.type === 'CHECKMATE',
                stalemate: status.type === 'STALEMATE',
                threefoldRepetition: status.type === 'DRAW' && status.reason === 'THREEFOLD',
                fiftyMoveRule: status.type === 'DRAW' && status.reason === 'FIFTY_MOVE'
            },
            capturedPiece: capturedPiece ? capturedPiece.notation : null
        };
    }

    /**
     * Gets all legal moves from current position
     * @param {string} fen - Current position
     * @returns {Array<string>} Array of UCI format moves
     */
    getLegalMoves(fen) {
        const board = this.parseFEN(fen);
        const legalMoves = [];

        // Iterate through all squares
        for (let rank = 0; rank < 6; rank++) {
            for (let file = 0; file < 6; file++) {
                const piece = board.squares[rank][file];
                if (piece && piece.color === board.turn) {
                    const from = `${String.fromCharCode(97 + file)}${rank + 1}`;
                    
                    // Try all possible destination squares
                    for (let destRank = 0; destRank < 6; destRank++) {
                        for (let destFile = 0; destFile < 6; destFile++) {
                            const to = `${String.fromCharCode(97 + destFile)}${destRank + 1}`;
                            const uci = from + to;
                            
                            // Check if move is valid
                            const validation = this.validateMove(fen, uci);
                            if (validation.valid) {
                                // Handle promotions
                                if (validation.flags.promotion) {
                                    legalMoves.push(uci + 'q', uci + 'r', uci + 'n');
                                } else {
                                    legalMoves.push(uci);
                                }
                            }
                        }
                    }
                }
            }
        }

        return legalMoves;
    }

    /**
     * Parses FEN string into board representation
     * @param {string} fen - FEN string (6×6 Los Alamos format)
     * @returns {Object} Board object with piece positions and metadata
     */
    parseFEN(fen) {
        const parts = fen.split(' ');
        if (parts.length !== 6) return null;

        const position = parts[0];
        const turn = parts[1] === 'w' ? 'white' : 'black';
        const castling = parts[2]; // Always '-' for Los Alamos
        const enPassant = parts[3]; // Always '-' for Los Alamos
        const halfMoveClock = parseInt(parts[4]);
        const fullMoveNumber = parseInt(parts[5]);

        const board = {
            squares: [],
            turn,
            castling,
            enPassant,
            halfMoveClock,
            fullMoveNumber
        };

        const ranks = position.split('/').reverse(); // Start from rank 1
        ranks.forEach((rank, rankIndex) => {
            const row = [];
            let fileIndex = 0;
            
            for (const char of rank) {
                if (isNaN(char)) {
                    // It's a piece
                    row.push({
                        type: this.getPieceType(char),
                        color: char === char.toUpperCase() ? 'white' : 'black',
                        notation: char
                    });
                    fileIndex++;
                } else {
                    // Empty squares
                    const emptyCount = parseInt(char);
                    for (let i = 0; i < emptyCount; i++) {
                        row.push(null);
                        fileIndex++;
                    }
                }
            }
            board.squares.push(row);
        });

        // Add helper methods
        board.getPieceAt = function(square) {
            const file = square.charCodeAt(0) - 97;
            const rank = parseInt(square[1]) - 1;
            if (rank < 0 || rank > 5 || file < 0 || file > 5) return null;
            return this.squares[rank][file];
        };

        board.setPieceAt = function(square, piece) {
            const file = square.charCodeAt(0) - 97;
            const rank = parseInt(square[1]) - 1;
            if (rank < 0 || rank > 5 || file < 0 || file > 5) return;
            this.squares[rank][file] = piece;
        };

        board.makeMove = function(move) {
            const piece = this.getPieceAt(move.from);
            this.setPieceAt(move.to, piece);
            this.setPieceAt(move.from, null);
            
            // Handle promotion
            if (move.promotion) {
                const promotedPiece = {
                    type: this.getPieceTypeFromNotation(move.promotion),
                    color: piece.color,
                    notation: piece.color === 'white' ? move.promotion.toUpperCase() : move.promotion.toLowerCase()
                };
                this.setPieceAt(move.to, promotedPiece);
            }
        };

        board.clone = function() {
            const cloned = {
                squares: this.squares.map(row => row.map(piece => 
                    piece ? { ...piece } : null
                )),
                turn: this.turn,
                castling: this.castling,
                enPassant: this.enPassant,
                halfMoveClock: this.halfMoveClock,
                fullMoveNumber: this.fullMoveNumber
            };
            // Re-add methods
            cloned.getPieceAt = this.getPieceAt;
            cloned.setPieceAt = this.setPieceAt;
            cloned.makeMove = this.makeMove;
            cloned.clone = this.clone;
            cloned.getPieceTypeFromNotation = this.getPieceTypeFromNotation;
            return cloned;
        };

        board.getPieceTypeFromNotation = function(notation) {
            const types = {
                'q': 'queen', 'r': 'rook', 'n': 'knight'
            };
            return types[notation.toLowerCase()];
        };

        return board;
    }

    /**
     * Generates FEN string from board state
     * @param {Object} board - Board representation
     * @returns {string} FEN string
     */
    generateFEN(board) {
        let fen = '';
        
        // Position
        for (let rank = 5; rank >= 0; rank--) {
            let emptyCount = 0;
            for (let file = 0; file < 6; file++) {
                const piece = board.squares[rank][file];
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    fen += piece.notation;
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            if (rank > 0) fen += '/';
        }
        
        // Other FEN components
        fen += ' ' + (board.turn === 'white' ? 'w' : 'b');
        fen += ' -'; // No castling in Los Alamos
        fen += ' -'; // No en passant in Los Alamos
        fen += ' ' + board.halfMoveClock;
        fen += ' ' + board.fullMoveNumber;
        
        return fen;
    }

    /**
     * Creates a deep clone of the board
     * @param {Object} board - Board to clone
     * @returns {Object} Cloned board
     */
    cloneBoard(board) {
        return board.clone();
    }

    /**
     * Checks the game status without recursion
     * @param {Object} board - Board state
     * @returns {Object} Status information
     */
    checkGameStatus(board) {
        const isCheck = this.gameStateChecker.isInCheck(board, board.turn);
        const hasLegalMove = this.gameStateChecker.hasLegalMoves(board, board.turn);

        if (!hasLegalMove) {
            if (isCheck) {
                return { type: 'CHECKMATE', isCheck: true };
            } else {
                return { type: 'STALEMATE', isCheck: false };
            }
        }

        // Check for draws
        if (board.halfMoveClock >= 50) {
            return { type: 'DRAW', reason: 'FIFTY_MOVE', isCheck };
        }

        // Check for threefold repetition would require position history
        // Implementation would require tracking position history

        return { type: 'ONGOING', isCheck };
    }

    // Helper methods
    parseUCI(uci) {
        if (!uci || uci.length < 4) return null;
        return {
            from: uci.substring(0, 2),
            to: uci.substring(2, 4),
            promotion: uci[4] || null
        };
    }

    getPieceType(notation) {
        const types = {
            'k': 'king', 'q': 'queen', 'r': 'rook',
            'n': 'knight', 'p': 'pawn'
        };
        return types[notation.toLowerCase()];
    }

    basicValidation(board, move) {
        // Check square format
        const squareRegex = /^[a-f][1-6]$/;
        return squareRegex.test(move.from) && squareRegex.test(move.to);
    }

    isCastlingAttempt(piece, move) {
        if (piece.type !== 'king') return false;
        const fileDiff = move.to.charCodeAt(0) - move.from.charCodeAt(0);
        return Math.abs(fileDiff) > 1;
    }

    isEnPassantAttempt(piece, move, board) {
        if (piece.type !== 'pawn') return false;
        const fileDiff = Math.abs(move.to.charCodeAt(0) - move.from.charCodeAt(0));
        const targetPiece = board.getPieceAt(move.to);
        return fileDiff === 1 && !targetPiece; // Diagonal move to empty square
    }

    isPromotionMove(piece, move) {
        if (piece.type !== 'pawn') return false;
        const rank = parseInt(move.to[1]);
        return (piece.color === 'white' && rank === 6) || 
               (piece.color === 'black' && rank === 1);
    }

    isValidPromotion(promotion) {
        if (!promotion) return true; // No promotion specified is fine
        return ['q', 'r', 'n'].includes(promotion.toLowerCase());
    }

    opponent(color) {
        return color === 'white' ? 'black' : 'white';
    }
}

module.exports = RulesEngine;