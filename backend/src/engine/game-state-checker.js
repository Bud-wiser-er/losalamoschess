const PieceMovement = require('./piece-movement');

class GameStateChecker {
    constructor() {
        this.pieceMovement = new PieceMovement();
    }

    /**
     * Checks if a king is in check
     * @param {Object} board - Board state
     * @param {string} kingColor - Color of king to check
     * @returns {boolean} True if king is in check
     */
    isInCheck(board, kingColor) {
        // Find the king
        const kingSquare = this.findKing(board, kingColor);
        if (!kingSquare) return false; // No king found (shouldn't happen)
        
        // Check if any opponent piece can attack the king
        const opponentColor = kingColor === 'white' ? 'black' : 'white';
        
        for (let rank = 0; rank < 6; rank++) {
            for (let file = 0; file < 6; file++) {
                const piece = board.squares[rank][file];
                if (piece && piece.color === opponentColor) {
                    const attackerSquare = `${String.fromCharCode(97 + file)}${rank + 1}`;
                    if (this.canPieceAttackSquare(piece, attackerSquare, kingSquare, board)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    /**
     * Finds the king of specified color
     * @param {Object} board - Board state
     * @param {string} color - King color to find
     * @returns {string|null} Square containing the king, or null if not found
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
     * Checks if a piece can attack a specific square
     * @param {Object} piece - Attacking piece
     * @param {string} fromSquare - Square piece is on
     * @param {string} toSquare - Square to attack
     * @param {Object} board - Board state
     * @returns {boolean} True if piece can attack the square
     */
    canPieceAttackSquare(piece, fromSquare, toSquare, board) {
        // Create a mock move to test
        const mockMove = {
            from: fromSquare,
            to: toSquare,
            promotion: null
        };
        
        // Special case for pawns - they attack differently than they move
        if (piece.type === 'pawn') {
            const fromFile = fromSquare.charCodeAt(0) - 97;
            const fromRank = parseInt(fromSquare[1]) - 1;
            const toFile = toSquare.charCodeAt(0) - 97;
            const toRank = parseInt(toSquare[1]) - 1;
            
            const direction = piece.color === 'white' ? 1 : -1;
            const fileDiff = Math.abs(toFile - fromFile);
            const rankDiff = toRank - fromRank;
            
            // Pawns attack diagonally
            return fileDiff === 1 && rankDiff === direction;
        }
        
        // For other pieces, use the normal movement validation
        // Temporarily mark target square as occupied by opponent
        const originalPiece = board.getPieceAt(toSquare);
        const mockTargetPiece = {
            type: 'pawn',
            color: piece.color === 'white' ? 'black' : 'white',
            notation: piece.color === 'white' ? 'p' : 'P'
        };
        
        // Temporarily set a piece at target square for attack validation
        board.setPieceAt(toSquare, mockTargetPiece);
        
        // Check if the piece can move to (attack) that square
        const canAttack = this.pieceMovement.isValidMove(piece, mockMove, board);
        
        // Restore original piece (or null)
        board.setPieceAt(toSquare, originalPiece);
        
        return canAttack;
    }

    /**
     * Checks if a position has any legal moves
     * @param {Object} board - Board state
     * @param {string} color - Color to check for moves
     * @returns {boolean} True if there's at least one legal move
     */
    hasLegalMoves(board, color) {
        for (let fromRank = 0; fromRank < 6; fromRank++) {
            for (let fromFile = 0; fromFile < 6; fromFile++) {
                const piece = board.squares[fromRank][fromFile];
                if (piece && piece.color === color) {
                    const fromSquare = `${String.fromCharCode(97 + fromFile)}${fromRank + 1}`;
                    
                    // Check all possible destination squares
                    for (let toRank = 0; toRank < 6; toRank++) {
                        for (let toFile = 0; toFile < 6; toFile++) {
                            const toSquare = `${String.fromCharCode(97 + toFile)}${toRank + 1}`;
                            const move = {
                                from: fromSquare,
                                to: toSquare,
                                promotion: null
                            };
                            
                            // Check if this is a valid piece move
                            if (this.pieceMovement.isValidMove(piece, move, board)) {
                                // Make the move temporarily to check if it leaves king in check
                                const testBoard = this.cloneBoard(board);
                                testBoard.setPieceAt(toSquare, testBoard.getPieceAt(fromSquare));
                                testBoard.setPieceAt(fromSquare, null);
                                
                                // If this move doesn't leave our king in check, it's legal
                                if (!this.isInCheck(testBoard, color)) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Creates a deep clone of the board
     * @param {Object} board - Board to clone
     * @returns {Object} Cloned board
     */
    cloneBoard(board) {
        const cloned = {
            squares: board.squares.map(row => row.map(piece => 
                piece ? { ...piece } : null
            )),
            turn: board.turn,
            castling: board.castling,
            enPassant: board.enPassant,
            halfMoveClock: board.halfMoveClock,
            fullMoveNumber: board.fullMoveNumber
        };
        
        // Add methods
        cloned.getPieceAt = board.getPieceAt;
        cloned.setPieceAt = board.setPieceAt;
        
        return cloned;
    }
}

module.exports = GameStateChecker;