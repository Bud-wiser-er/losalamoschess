/*
 * L3 - Enhanced Minimax Strategy
 * Depth 3 with move ordering and transposition table
 */

const MinimaxStrategy = require('./minimax');
const Evaluator = require('../evaluator');

/**
 * Enhanced alpha–beta minimax with light heuristics:
 * - Fixed search depth of 3 plies
 * - Move ordering (captures, checks, centre control) to improve pruning
 * - Transposition table keyed by (FEN, depth, side-to-move) to avoid recomputation
 *
 * Assumptions:
 * - `rulesEngine.applyMove(fen, move)` returns an object with at least:
 *     { fen: string, capturedPiece?: {type:string,color:string}, flags?: { check?: boolean } }
 * - `super.findBestMove` / `super.minimax` implement the core alpha–beta logic
 */
class EnhancedStrategy extends MinimaxStrategy {
    /**
     * Create an EnhancedStrategy.
     * @param {Object} rulesEngine - Game rules interface used to generate/apply moves.
     **/
    constructor(rulesEngine) {
        super(rulesEngine, 3); // Depth 3
        this.transpositionTable = new Map(); // Cache positions
        this.evaluator = new Evaluator();
    }

    /**
     * Entry point: find the best move from a given FEN and legal move list.
     * Clears the transposition table, orders moves to aid pruning, then delegates to base.
     * @param {string} fen - Current position in FEN.
     * @param {string[]} legalMoves - Array of legal moves (engine-specific format, e.g. "c3d4").
     * @param {number} [seed] - Optional RNG seed for tie-breaking in the base class.
     * @returns {string|null} The chosen best move or null if none.
     **/
    findBestMove(fen, legalMoves, seed) {
        // Clear transposition table for new search
        this.transpositionTable.clear();
        
        // Order moves for better alpha-beta pruning
        const orderedMoves = this.orderMoves(fen, legalMoves);
        
        return super.findBestMove(fen, orderedMoves, seed);
    }

    /**
     * Heuristic move ordering to improve alpha–beta pruning effectiveness.
     * Prioritises:
     *   1) Captures
     *   2) Moves that give check
     *   3) Central file moves (files 'c' or 'd' on a 6×6 board)
     * You can expand this to include killer moves, MVV-LVA, history heuristics, etc.
     * @param {string} fen - Position to evaluate moves from.
     * @param {string[]} moves - Candidate legal moves.
     * @returns {string[]} Same moves, sorted best-first for searching.
     **/
    orderMoves(fen, moves) {
        // Order moves by likely quality: captures, checks, center moves
        const scoredMoves = moves.map(move => {
            let score = 0;
            const result = this.rulesEngine.applyMove(fen, move);
            
            if (result.capturedPiece) score += 10;
            if (result.flags.check) score += 5;
            if (move.includes('c') || move.includes('d')) score += 1; // Center squares
            
            return { move, score };
        });
        
        scoredMoves.sort((a, b) => b.score - a.score);
        return scoredMoves.map(sm => sm.move);
    }

    /**
     * Alpha–beta minimax with transposition-table lookups.
     * Delegates core search to the base class but memoises results per (fen, depth, side).
     *
     * NOTE:
     * - We key by fen, depth, maximizingPlayer. 
     *
     * @param {string} fen - Current position in FEN.
     * @param {number} depth - Remaining depth to search (plies).
     * @param {number} alpha - Alpha bound.
     * @param {number} beta - Beta bound.
     * @param {boolean} maximizingPlayer - True if it's the maximiser's turn.
     * @returns {number} Static evaluation of the node under alpha–beta.
     **/

    minimax(fen, depth, alpha, beta, maximizingPlayer) {
        // Check transposition table
        const key = `${fen}-${depth}-${maximizingPlayer}`;
        if (this.transpositionTable.has(key)) {
            return this.transpositionTable.get(key);
        }
        
        const result = super.minimax(fen, depth, alpha, beta, maximizingPlayer);
        
        // Store in transposition table
        this.transpositionTable.set(key, result);
        
        return result;
    }
}

module.exports = EnhancedStrategy;