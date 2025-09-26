/*
 * Position Evaluator
 * Evaluates chess positions for AI decision making
 */

class Evaluator {
    /**
     * Initialise material values and simple piece–square/centre-control tables.
     * Values are scaled (e.g., pawn=100) so small positional terms are meaningful.
     **/
    constructor() {
        this.pieceValues = {
            'p': 100,
            'n': 320,
            'r': 500,
            'q': 900,
            'k': 20000
        };
        
        // Piece-square tables for positional evaluation
        this.pawnTable = [
            [0,  0,  0,  0,  0,  0],
            [5, 10, 10, 10, 10,  5],
            [5,  5, 10, 10,  5,  5],
            [0,  0,  5,  5,  0,  0],
            [5,  0,  0,  0,  0,  5],
            [0,  0,  0,  0,  0,  0]
        ];
        
        this.knightTable = [
            [-10, -5,  0,  0, -5, -10],
            [ -5,  0,  5,  5,  0,  -5],
            [  0,  5, 10, 10,  5,   0],
            [  0,  5, 10, 10,  5,   0],
            [ -5,  0,  5,  5,  0,  -5],
            [-10, -5,  0,  0, -5, -10]
        ];
        
        this.centerControl = [
            [0, 0, 0, 0, 0, 0],
            [0, 2, 3, 3, 2, 0],
            [0, 3, 5, 5, 3, 0],
            [0, 3, 5, 5, 3, 0],
            [0, 2, 3, 3, 2, 0],
            [0, 0, 0, 0, 0, 0]
        ];
    }

    /**
     * Evaluate a position given in Los Alamos FEN.
     * Score is from the side-to-move’s perspective (positive = good for side to move).
     *
     * @param {string} fen
     * @returns {number}
     **/
    evaluatePosition(fen) {
        // Parse FEN to get board
        const board = this.parseFEN(fen);
        if (!board) return 0;
        
        let evaluation = 0;
        
        // Material and positional evaluation
        for (let rank = 0; rank < 6; rank++) {
            for (let file = 0; file < 6; file++) {
                const piece = board.squares[rank][file];
                if (piece) {
                    const value = this.getPieceValue(piece, rank, file);
                    evaluation += piece.color === 'white' ? value : -value;
                }
            }
        }
        
        // Mobility bonus
        const mobility = this.evaluateMobility(fen, board);
        evaluation += board.turn === 'white' ? mobility : -mobility;
        
        // King safety (simplified)
        const kingSafety = this.evaluateKingSafety(board);
        evaluation += kingSafety;
        
        // Return from current player's perspective
        return board.turn === 'white' ? evaluation : -evaluation;
    }

     /**
     * Base material value + piece–square positional bonus.
     * @param {{type:string,color:'white'|'black'}} piece
     * @param {number} rank - 0 (top) … 5 (bottom)
     * @param {number} file - 0 … 5
     * @returns {number}
     **/
    getPieceValue(piece, rank, file) {
        const baseValue = this.pieceValues[piece.type.toLowerCase()];
        let positionalBonus = 0;
        
        // Add positional bonuses based on piece type
        switch(piece.type) {
            case 'pawn':
                if (piece.color === 'white') {
                    positionalBonus = this.pawnTable[rank][file];
                } else {
                    positionalBonus = this.pawnTable[5-rank][file];
                }
                break;
            case 'knight':
                positionalBonus = this.knightTable[rank][file];
                break;
            case 'rook':
            case 'queen':
                // Bonus for controlling center files
                if (file === 2 || file === 3) positionalBonus += 10;
                break;
            case 'king':
                // King should stay safe in opening/middlegame
                if (rank === 0 || rank === 5) positionalBonus += 20;
                break;
        }
        
        return baseValue + positionalBonus;
    }

    /**
     * Very rough mobility proxy: counts potential activity by piece type for side to move.
     * (In a full engine, you’d call the rules engine to enumerate legal moves.)
     *
     * @param {string} fen - Unused here; kept for parity with richer evaluators.
     * @param {{squares:any[][],turn:'white'|'black'}} board
     * @returns {number}
     **/
    evaluateMobility(fen, board) {
        // Simpler mobilitw here we jsut count available moves
        // In a real implementation, this would use the rules engine
        let mobility = 0;
        
        // Estimate based on piece positions
        for (let rank = 0; rank < 6; rank++) {
            for (let file = 0; file < 6; file++) {
                const piece = board.squares[rank][file];
                if (piece && piece.color === board.turn) {
                    // Rough estimate of moves per piece type
                    switch(piece.type) {
                        case 'pawn': mobility += 1; break;
                        case 'knight': mobility += 4; break;
                        case 'rook': mobility += 7; break;
                        case 'queen': mobility += 13; break;
                        case 'king': mobility += 3; break;
                    }
                }
            }
        }
        
        return mobility * 5; // Scale the mobility bonus
    }
    /**
     * Penalise kings that are too central (files 2–3) on a 6×6 board.
     * Positive return favours White; negative favours Black.
     *
     * @param {{squares:any[][]}} board
     * @returns {number}
     **/
    evaluateKingSafety(board) {
        let safety = 0;
        
        // Find kings
        let whiteKingPos = null;
        let blackKingPos = null;
        
        for (let rank = 0; rank < 6; rank++) {
            for (let file = 0; file < 6; file++) {
                const piece = board.squares[rank][file];
                if (piece && piece.type === 'king') {
                    if (piece.color === 'white') {
                        whiteKingPos = {rank, file};
                    } else {
                        blackKingPos = {rank, file};
                    }
                }
            }
        }
        
        // Penalize exposed kings (center positions in opening)
        if (whiteKingPos) {
            if (whiteKingPos.file > 1 && whiteKingPos.file < 4) {
                safety -= 30; // White king exposed
            }
        }
        
        if (blackKingPos) {
            if (blackKingPos.file > 1 && blackKingPos.file < 4) {
                safety += 30; // Black king exposed (good for white)
            }
        }
        
        return safety;
    }

    /**
     * Minimal Los Alamos FEN parser sufficient for evaluation.
     * Expects 6 fields and 6 ranks; ignores castling/en passant/halfmove/fullmove semantics.
     *
     * @param {string} fen
     * @returns {{squares:(Array<(null|{type:string,color:string,notation:string})[]>),turn:'white'|'black'}|null}
     **/
    parseFEN(fen) {
        // Simplified FEN parser for evaluation
        if (!fen || typeof fen !== 'string') return null;
        
        const parts = fen.split(' ');
        if (parts.length !== 6) return null;
        
        const position = parts[0];
        const turn = parts[1] === 'w' ? 'white' : 'black';
        
        const board = {
            squares: [],
            turn: turn
        };
        
        const ranks = position.split('/');
        if (ranks.length !== 6) return null;
        
        // Process from rank 6 to rank 1 (top to bottom)
        for (let i = 5; i >= 0; i--) {
            const rankString = ranks[5 - i];
            const row = [];
            
            for (const char of rankString) {
                if (isNaN(char)) {
                    // It's a piece
                    row.push({
                        type: this.getPieceType(char),
                        color: char === char.toUpperCase() ? 'white' : 'black',
                        notation: char
                    });
                } else {
                    // Empty squares
                    const emptyCount = parseInt(char);
                    for (let j = 0; j < emptyCount; j++) {
                        row.push(null);
                    }
                }
            }
            
            board.squares.push(row);
        }
        
        return board;
    }

     /**
     * Map FEN piece letters to internal type strings.
     * @param {string} notation - Single letter, case-insensitive.
     * @returns {'king'|'queen'|'rook'|'knight'|'pawn'|undefined}
     **/
    getPieceType(notation) {
        const types = {
            'k': 'king',
            'q': 'queen',
            'r': 'rook',
            'n': 'knight',
            'p': 'pawn'
        };
        return types[notation.toLowerCase()];
    }
}

module.exports = Evaluator;