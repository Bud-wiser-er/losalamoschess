/*
 * L1 - Greedy Strategy
 * Single-ply evaluation, captures when possible
 */

const Evaluator = require('../evaluator');

class GreedyStrategy {
    /**
     * @param {Object} rulesEngine
     * Interface to the game rules. Must provide:
     *   applyMove(fen: string, move: string): {
     *     fen: string,
     *     capturedPiece?: string,           // single-char piece code e.g. 'p','n','r','q','k' (case denotes colour)
     *     flags?: { check?: boolean, checkmate?: boolean }
     *   } | null
     **/
    constructor(rulesEngine) {
        this.rulesEngine = rulesEngine;
        this.evaluator = new Evaluator();
        this.bestMoveSoFar = null;
    }

    /**
     * Pick the highest-scoring move by evaluating each legal move once.
     * @param {string} fen - Current position in FEN.
     * @param {string[]} legalMoves - Engine-formatted legal moves from `fen`.
     * @param {number} [seed] - Unused here (kept for API parity with deeper strategies).
     * @returns {{move:string|null,evaluation:number,depth:number,nodes:number}}
     *   move: best move found (or null if none),
     *   evaluation: score of that move,
     *   depth: fixed at 1 (single ply),
     *   nodes: number of moves evaluated.
     **/
    findBestMove(fen, legalMoves, seed) {
        let bestMove = legalMoves[0];
        let bestValue = -Infinity;
        let nodesSearched = 0;
        
        for (const move of legalMoves) {
            nodesSearched++;
            const value = this.evaluateMove(fen, move);
            
            if (value > bestValue) {
                bestValue = value;
                bestMove = move;
                this.bestMoveSoFar = move;
            }
        }
        
        return {
            move: bestMove,
            evaluation: bestValue,
            depth: 1,
            nodes: nodesSearched
        };
    }

     /**
     * Evaluate a single move by:
     *  1) Applying it to get the child FEN.
     *  2) Adding tactical bonuses (capture/check/mate).
     *  3) Adding static evaluation of the child FEN.
     *
     * Notes:
     * - Uses a small piece-value table for capture bonus. Consider MVV-LVA for nuance.
     * - Checkmate gets a very large bonus to dominate the score.
     * - If the evaluator throws, we fall back to the tactical bonuses only.
     *
     * @param {string} fen - Parent position.
     * @param {string} move - Candidate move (engine format).
     * @returns {number} Higher is better for the side to move in `fen`.
     **/
    
    evaluateMove(fen, move) {
        const result = this.rulesEngine.applyMove(fen, move);
        if (!result || !result.fen) {
            return -Infinity; // Invalid move
        }
        
        let value = 0;
        
        // Bonus for captures
        if (result.capturedPiece) {
            const pieceValues = { 'p': 1, 'n': 3, 'r': 5, 'q': 9, 'k': 1000 };
            const capturedPieceType = result.capturedPiece.toLowerCase();
            value += pieceValues[capturedPieceType] || 0;
        }
        
        // Bonus for checks
        if (result.flags && result.flags.check) {
            value += 0.5;
        }
        
        // Huge bonus for checkmate
        if (result.flags && result.flags.checkmate) {
            value += 10000;
        }
        
        // Evaluate board position
        try {
            value += this.evaluator.evaluatePosition(result.fen);
        } catch (error) {
            // If evaluator fails, just use the capture/check bonuses
            console.warn('Evaluator failed for position:', result.fen);
        }
        
        return value;
    }
    /**
     * Returns the most recently preferred move discovered during the last search.
     * Useful for progressive display or time-cutoff strategies.
     * @returns {string|null}
     **/
    getBestMoveSoFar() {
        return this.bestMoveSoFar;
    }
}

module.exports = GreedyStrategy;