/*
Author: 				Byron Norval
Last date modified: 	15/09/2025
Title:					Board Validator
Description:


*/

class BoardValidator {
    constructor() {}

    /**
     * Validates that a board state is legal
     * @param {Object} board - Board object
     * @returns {boolean} True if board is valid
     */
    isValidBoard(board) {
        if (!board || !board.squares) return false;
        
        // Check board dimensions (6x6)
        if (board.squares.length !== 6) return false;
        
        for (const row of board.squares) {
            if (row.length !== 6) return false;
        }
        
        // Check kings exist
        const whiteKing = this.findKing(board, 'white');
        const blackKing = this.findKing(board, 'black');
        
        if (!whiteKing || !blackKing) return false;
        
        // Check no bishops exist (Los Alamos rule)
        if (this.hasBishops(board)) return false;
        
        return true;
    }

    /**
     * Finds king of specified color
     * @param {Object} board - Board state
     * @param {string} color - King color
     * @returns {string|null} Square with king
     */
    findKing(board, color) {
        for (let rank = 0; rank < 6; rank++) {
            for (let file = 0; file < 6; file++) {
                const piece = board.squares[rank][file];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return `${String.fromCharCode(97 + file)}${rank + 1}`;
                }
            }
        }
        return null;
    }

    /**
     * Checks if board has any bishops (illegal in Los Alamos)
     * @param {Object} board - Board state
     * @returns {boolean} True if bishops found
     */
    hasBishops(board) {
        for (let rank = 0; rank < 6; rank++) {
            for (let file = 0; file < 6; file++) {
                const piece = board.squares[rank][file];
                if (piece && piece.type === 'bishop') {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Validates square notation
     * @param {string} square - Square notation (e.g., "a1")
     * @returns {boolean} True if valid
     */
    isValidSquare(square) {
        if (typeof square !== 'string' || square.length !== 2) return false;
        
        const file = square[0];
        const rank = square[1];
        
        return file >= 'a' && file <= 'f' && rank >= '1' && rank <= '6';
    }

    /**
     * Validates UCI move format
     * @param {string} uci - UCI move string
     * @returns {boolean} True if valid format
     */
    isValidUCI(uci) {
        if (typeof uci !== 'string') return false;
        
        // Basic UCI: 4 characters (e.g., "e2e4")
        if (uci.length === 4) {
            return this.isValidSquare(uci.substring(0, 2)) && 
                   this.isValidSquare(uci.substring(2, 4));
        }
        
        // UCI with promotion: 5 characters (e.g., "e7e8q")
        if (uci.length === 5) {
            const promotion = uci[4].toLowerCase();
            return this.isValidSquare(uci.substring(0, 2)) && 
                   this.isValidSquare(uci.substring(2, 4)) &&
                   ['q', 'r', 'n'].includes(promotion); // No bishop promotion in Los Alamos
        }
        
        return false;
    }

    /**
     * Validates FEN string format
     * @param {string} fen - FEN string
     * @returns {boolean} True if valid format
     */
    isValidFEN(fen) {
        if (typeof fen !== 'string') return false;
        
        const parts = fen.split(' ');
        if (parts.length !== 6) return false;
        
        const [position, turn, castling, enPassant, halfMove, fullMove] = parts;
        
        // Check turn
        if (turn !== 'w' && turn !== 'b') return false;
        
        // Check castling (should be '-' for Los Alamos)
        if (castling !== '-') return false;
        
        // Check en passant (should be '-' for Los Alamos)
        if (enPassant !== '-') return false;
        
        // Check move counters
        if (isNaN(halfMove) || isNaN(fullMove)) return false;
        
        // Check position part
        const ranks = position.split('/');
        if (ranks.length !== 6) return false;
        
        for (const rank of ranks) {
            if (!this.isValidRankString(rank)) return false;
        }
        
        return true;
    }

    /**
     * Validates a single rank string in FEN
     * @param {string} rank - Rank string (e.g., "rnqknr")
     * @returns {boolean} True if valid
     */
    isValidRankString(rank) {
        let fileCount = 0;
        
        for (const char of rank) {
            if (isNaN(char)) {
                // It's a piece
                if (!'rnqknrpRNQKNRP'.includes(char)) return false;
                fileCount++;
            } else {
                // It's a number (empty squares)
                const emptySquares = parseInt(char);
                if (emptySquares < 1 || emptySquares > 6) return false;
                fileCount += emptySquares;
            }
        }
        
        return fileCount === 6; // Must total 6 files
    }
}

module.exports = BoardValidator;