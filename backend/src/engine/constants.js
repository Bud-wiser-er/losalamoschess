/*
	Author: Byon Norval
	Last Update: 15/09/2025
	Title :Constants for Los Alamos Chess variant
 */

const LOS_ALAMOS_CONSTANTS = {
    // Board dimensions
    BOARD_SIZE: 6,
    FILES: ['a', 'b', 'c', 'd', 'e', 'f'],
    RANKS: [1, 2, 3, 4, 5, 6],
    
    // Initial position
    INITIAL_FEN: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    
    // Piece values (for evaluation)
    PIECE_VALUES: {
        'p': 100,   // pawn
        'n': 320,   // knight
        'r': 500,   // rook
        'q': 900,   // queen
        'k': 20000  // king
    },
    
    // Los Alamos specific rules
    VARIANT_RULES: {
        NO_BISHOPS: true,
        NO_CASTLING: true,
        NO_EN_PASSANT: true,
        NO_DOUBLE_PAWN_MOVE: true,
        PROMOTION_PIECES: ['q', 'r', 'n'] // No bishop promotion
    },
    
    // Game status types
    GAME_STATUS: {
        ONGOING: 'ONGOING',
        CHECKMATE: 'CHECKMATE',
        STALEMATE: 'STALEMATE',
        DRAW: 'DRAW'
    },
    
    // Draw reasons
    DRAW_REASONS: {
        FIFTY_MOVE: 'FIFTY_MOVE',
        THREEFOLD_REPETITION: 'THREEFOLD',
        INSUFFICIENT_MATERIAL: 'INSUFFICIENT_MATERIAL'
    },
    
    // Error codes
    ERROR_CODES: {
        INVALID_FEN: 'INVALID_FEN',
        INVALID_UCI: 'INVALID_UCI',
        INVALID_SQUARE: 'INVALID_SQUARE',
        NO_PIECE: 'NO_PIECE',
        WRONG_TURN: 'WRONG_TURN',
        ILLEGAL_MOVE: 'ILLEGAL_MOVE',
        NO_CASTLING: 'NO_CASTLING',
        NO_EN_PASSANT: 'NO_EN_PASSANT',
        INVALID_PROMOTION: 'INVALID_PROMOTION',
        LEAVES_KING_IN_CHECK: 'LEAVES_KING_IN_CHECK'
    }
};

module.exports = LOS_ALAMOS_CONSTANTS;