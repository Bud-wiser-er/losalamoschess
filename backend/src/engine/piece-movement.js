/**
 * Movement validation engine for the Los Alamos 6×6 chess variant.
 * - Board coordinates are constrained to files a–f and ranks 1–6 (a1..f6).
 * - Bishops, castling, and en passant are not part of this variant.
 * Each piece type validator enforces board bounds, move shape, path clearance,
 * and same-colour capture rules as applicable.
 * @class
 */

class PieceMovement {
    /**
     * Constructs a PieceMovement instance and binds validators for each piece type.
     * Maps: 'pawn' → validatePawnMove, 'rook' → validateRookMove,
     * 'knight' → validateKnightMove, 'queen' → validateQueenMove, 'king' → validateKingMove.
     * @constructor
     */
    constructor() {
        this.pieceTypes = {
            'pawn': this.validatePawnMove.bind(this),
            'rook': this.validateRookMove.bind(this),
            'knight': this.validateKnightMove.bind(this),
            'queen': this.validateQueenMove.bind(this),
            'king': this.validateKingMove.bind(this)
        };
    }

    /**
     * Validates whether the given piece can legally perform the specified move.
     * - Selects the correct piece-type validator and delegates validation.
     * - Returns false on missing inputs or unknown piece type.
     * @param {{type: 'pawn'|'rook'|'knight'|'queen'|'king', color: 'white'|'black'}} piece
     *   Piece object describing the mover.
     * @param {{from: string, to: string, promotion?: string}} move
     *   Move object using algebraic squares within a1..f6 (Los Alamos 6×6).
     * @param {{getPieceAt?: (square: string) => ({type: string, color: string}|null)}} board
     *   Board state object; if provided, getPieceAt() is used for occupancy/capture checks.
     * @returns {boolean} True if the move is legal for this piece type on a 6×6 board; otherwise false.
     */
    isValidMove(piece, move, board) {
        if (!piece || !move || !board) return false;
        
        const validator = this.pieceTypes[piece.type];
        if (!validator) return false;
        
        return validator(piece, move, board);
    }

    /**
     * Validates a pawn move on a 6×6 Los Alamos board (no double-step, no en passant).
     * Rules:
     * - Forward one rank only in the pawn's colour direction (white: +1, black: −1) to an empty square.
     * - Diagonal forward one file for captures only; target must exist and be opposite colour.
     * - Files a–f, ranks 1–6 only.
     * @param {{color: 'white'|'black'}} piece
     *   Pawn piece; 'type' is assumed 'pawn'.
     * @param {{from: string, to: string}} move
     *   Algebraic coordinates within a1..f6.
     * @param {{getPieceAt?: (square: string) => ({color: string}|null)}} board
     *   Board state; getPieceAt() used to test emptiness or enemy presence.
     * @returns {boolean} True if the pawn move is legal; otherwise false.
     */


    validatePawnMove(piece, move, board) {
        if (!move || !move.from || !move.to || !board) return false;
        
        const fromFile = move.from.charCodeAt(0) - 97;
        const fromRank = parseInt(move.from[1]) - 1;
        const toFile = move.to.charCodeAt(0) - 97;
        const toRank = parseInt(move.to[1]) - 1;
        
        // Check bounds
        if (fromFile < 0 || fromFile > 5 || fromRank < 0 || fromRank > 5 ||
            toFile < 0 || toFile > 5 || toRank < 0 || toRank > 5) {
            return false;
        }
        
        const direction = piece.color === 'white' ? 1 : -1;
        const rankDiff = toRank - fromRank;
        const fileDiff = Math.abs(toFile - fromFile);
        
        const targetPiece = board.getPieceAt ? board.getPieceAt(move.to) : null;
        
        // Forward move - must be to empty square
        if (fileDiff === 0 && rankDiff === direction) {
            // Pawns can only move forward to an EMPTY square
            return !targetPiece;
        }
        
        // Diagonal capture - must be to enemy piece
        if (fileDiff === 1 && rankDiff === direction) {
            // Must capture an opponent piece (cannot be empty or same color)
            // FIX: Explicitly return false if no target piece, true only if enemy piece
            if (!targetPiece) return false;
            return targetPiece.color !== piece.color;
        }
        
        // All other moves are invalid
        return false;
    }

    /**
     * Validates a rook move (orthogonal sliding) on a 6×6 board.
     * Rules:
     * - Move strictly along file or rank; not both.
     * - Must change square (no zero-length move).
     * - Path between from→to must be clear of pieces.
     * - Destination must be empty or occupied by an opponent piece (no friendly capture).
     * @param {{color: 'white'|'black'}} piece
     *   Rook piece; 'type' is assumed 'rook'.
     * @param {{from: string, to: string}} move
     *   Algebraic coordinates within a1..f6.
     * @param {{getPieceAt?: (square: string) => ({color: string}|null)}} board
     *   Board state for path and destination checks.
     * @returns {boolean} True if the rook move is legal; otherwise false.
     */

    validateRookMove(piece, move, board) {
        if (!move || !move.from || !move.to || !board) return false;
        
        const fromFile = move.from.charCodeAt(0) - 97;
        const fromRank = parseInt(move.from[1]) - 1;
        const toFile = move.to.charCodeAt(0) - 97;
        const toRank = parseInt(move.to[1]) - 1;
        
        // Check bounds
        if (fromFile < 0 || fromFile > 5 || fromRank < 0 || fromRank > 5 ||
            toFile < 0 || toFile > 5 || toRank < 0 || toRank > 5) {
            return false;
        }
        
        // Must move in straight line (rank or file)
        if (fromFile !== toFile && fromRank !== toRank) {
            return false;
        }
        
        // Can't stay in same place
        if (fromFile === toFile && fromRank === toRank) {
            return false;
        }
        
        // Check path is clear
        if (!this.isPathClear(move.from, move.to, board)) {
            return false;
        }
        
        // Check destination
        const targetPiece = board.getPieceAt ? board.getPieceAt(move.to) : null;
        return !targetPiece || targetPiece.color !== piece.color;
    }

    /**
     * Validates a knight move (L-shape, leaping) on a 6×6 board.
     * Rules:
     * - |Δfile|,|Δrank| must be {2,1} in either order (2+1 or 1+2).
     * - Knights ignore intervening pieces (no path check).
     * - Destination must be empty or opponent-occupied (no friendly capture).
     * - Bounds restricted to a1..f6.
     * @param {{color: 'white'|'black'}} piece
     *   Knight piece; 'type' is assumed 'knight'.
     * @param {{from: string, to: string}} move
     *   Algebraic coordinates within a1..f6.
     * @param {{getPieceAt?: (square: string) => ({color: string}|null)}} board
     *   Board state for destination occupancy.
     * @returns {boolean} True if the knight move is legal; otherwise false.
     */


    validateKnightMove(piece, move, board) {
        if (!move || !move.from || !move.to || !board) return false;
        
        const fromFile = move.from.charCodeAt(0) - 97;
        const fromRank = parseInt(move.from[1]) - 1;
        const toFile = move.to.charCodeAt(0) - 97;
        const toRank = parseInt(move.to[1]) - 1;
        
        // Check bounds
        if (fromFile < 0 || fromFile > 5 || fromRank < 0 || fromRank > 5 ||
            toFile < 0 || toFile > 5 || toRank < 0 || toRank > 5) {
            return false;
        }
        
        const fileDiff = Math.abs(toFile - fromFile);
        const rankDiff = Math.abs(toRank - fromRank);
        
        // Knight moves in L-shape: 2+1 or 1+2
        const isLShape = (fileDiff === 2 && rankDiff === 1) || 
                        (fileDiff === 1 && rankDiff === 2);
        if (!isLShape) return false;
        
        // Check destination
        const targetPiece = board.getPieceAt ? board.getPieceAt(move.to) : null;
        return !targetPiece || targetPiece.color !== piece.color;
    }

    /**
     * Validates a queen move (rook + bishop movement) on a 6×6 board.
     * Rules:
     * - Move must be strictly orthogonal (same file or rank) OR diagonal (|Δfile| == |Δrank| > 0).
     * - Must change square (no zero-length move).
     * - Path between from→to must be clear of pieces.
     * - Destination must be empty or opponent-occupied (no friendly capture).
     * - Bounds restricted to a1..f6.
     * @param {{color: 'white'|'black'}} piece
     *   Queen piece; 'type' is assumed 'queen'.
     * @param {{from: string, to: string}} move
     *   Algebraic coordinates within a1..f6.
     * @param {{getPieceAt?: (square: string) => ({color: string}|null)}} board
     *   Board state for path and destination checks.
     * @returns {boolean} True if the queen move is legal; otherwise false.
     */

    validateQueenMove(piece, move, board) {
        if (!move || !move.from || !move.to || !board) return false;
        
        const fromFile = move.from.charCodeAt(0) - 97;
        const fromRank = parseInt(move.from[1]) - 1;
        const toFile = move.to.charCodeAt(0) - 97;
        const toRank = parseInt(move.to[1]) - 1;
        
        // Check bounds
        if (fromFile < 0 || fromFile > 5 || fromRank < 0 || fromRank > 5 ||
            toFile < 0 || toFile > 5 || toRank < 0 || toRank > 5) {
            return false;
        }
        
        // Can't stay in same place
        if (fromFile === toFile && fromRank === toRank) {
            return false;
        }
        
        const fileDiff = Math.abs(toFile - fromFile);
        const rankDiff = Math.abs(toRank - fromRank);
        
        // Queen moves either straight or diagonally
        const isStraight = (fromFile === toFile || fromRank === toRank);
        const isDiagonal = (fileDiff === rankDiff && fileDiff > 0);
        
        if (!isStraight && !isDiagonal) {
            return false;
        }
        
        // Check path is clear
        if (!this.isPathClear(move.from, move.to, board)) {
            return false;
        }
        
        // Check destination
        const targetPiece = board.getPieceAt ? board.getPieceAt(move.to) : null;
        return !targetPiece || targetPiece.color !== piece.color;
    }


    /**
     * Validates a king move (one square any direction; no castling) on a 6×6 board.
     * Rules:
     * - |Δfile| ≤ 1 and |Δrank| ≤ 1, and not both zero (must move).
     * - Destination must be empty or opponent-occupied (no friendly capture).
     * - Bounds restricted to a1..f6.
     * Note: This method does not check for moving into check; that is handled elsewhere.
     * @param {{color: 'white'|'black'}} piece
     *   King piece; 'type' is assumed 'king'.
     * @param {{from: string, to: string}} move
     *   Algebraic coordinates within a1..f6.
     * @param {{getPieceAt?: (square: string) => ({color: string}|null)}} board
     *   Board state for destination occupancy.
     * @returns {boolean} True if the king move is legal; otherwise false.
     */

    validateKingMove(piece, move, board) {
        if (!move || !move.from || !move.to || !board) return false;
        
        const fromFile = move.from.charCodeAt(0) - 97;
        const fromRank = parseInt(move.from[1]) - 1;
        const toFile = move.to.charCodeAt(0) - 97;
        const toRank = parseInt(move.to[1]) - 1;
        
        // Check bounds
        if (fromFile < 0 || fromFile > 5 || fromRank < 0 || fromRank > 5 ||
            toFile < 0 || toFile > 5 || toRank < 0 || toRank > 5) {
            return false;
        }
        
        const fileDiff = Math.abs(toFile - fromFile);
        const rankDiff = Math.abs(toRank - fromRank);
        
        // King moves one square in any direction
        if (fileDiff > 1 || rankDiff > 1) {
            return false;
        }
        
        // Can't stay in same position
        if (fileDiff === 0 && rankDiff === 0) {
            return false;
        }
        
        // Check destination
        const targetPiece = board.getPieceAt ? board.getPieceAt(move.to) : null;
        return !targetPiece || targetPiece.color !== piece.color;
    }

    /**
     * Checks if path between two squares is clear
     * @param {string} from - Starting square
     * @param {string} to - Ending square
     * @param {Object} board - Board state
     * @returns {boolean} True if path is clear
     */
    isPathClear(from, to, board) {
        if (!from || !to || !board) return false;
        
        const fromFile = from.charCodeAt(0) - 97;
        const fromRank = parseInt(from[1]) - 1;
        const toFile = to.charCodeAt(0) - 97;
        const toRank = parseInt(to[1]) - 1;
        
        // Check bounds
        if (fromFile < 0 || fromFile > 5 || fromRank < 0 || fromRank > 5 ||
            toFile < 0 || toFile > 5 || toRank < 0 || toRank > 5) {
            return false;
        }
        
        const fileDiff = toFile - fromFile;
        const rankDiff = toRank - fromRank;
        
        const steps = Math.max(Math.abs(fileDiff), Math.abs(rankDiff));
        
        // No need to check path for single step moves
        if (steps <= 1) return true;
        
        const fileStep = fileDiff === 0 ? 0 : fileDiff / Math.abs(fileDiff);
        const rankStep = rankDiff === 0 ? 0 : rankDiff / Math.abs(rankDiff);
        
        // Check each square in the path (excluding start and end)
        for (let step = 1; step < steps; step++) {
            const checkFile = fromFile + (fileStep * step);
            const checkRank = fromRank + (rankStep * step);
            
            // Additional bounds check
            if (checkFile < 0 || checkFile > 5 || checkRank < 0 || checkRank > 5) {
                return false;
            }
            
            const checkSquare = `${String.fromCharCode(97 + checkFile)}${checkRank + 1}`;
            
            if (board.getPieceAt && board.getPieceAt(checkSquare)) {
                return false; // Path is blocked
            }
        }
        
        return true;
    }
}

module.exports = PieceMovement;