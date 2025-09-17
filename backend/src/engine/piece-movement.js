class PieceMovement {
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
     * Validates if a piece can make the specified move
     * @param {Object} piece - Piece object with type and color
     * @param {Object} move - Move object with from, to, promotion
     * @param {Object} board - Board state
     * @returns {boolean} True if move is valid for this piece type
     */
    isValidMove(piece, move, board) {
        if (!piece || !move || !board) return false;
        
        const validator = this.pieceTypes[piece.type];
        if (!validator) return false;
        
        return validator(piece, move, board);
    }

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
        
        // Forward move
        if (fileDiff === 0) {
            // One square forward to empty square only
            if (rankDiff === direction && !targetPiece) {
                return true;
            }
            // No double pawn moves in Los Alamos
            return false;
        }
        
        // Diagonal capture
        if (fileDiff === 1 && rankDiff === direction) {
            // Must capture an opponent piece
            return targetPiece && targetPiece.color !== piece.color;
        }
        
        return false;
    }

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