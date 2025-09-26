/*
 * L2 - Minimax Strategy
 * Looks 2 moves ahead using minimax with alpha-beta pruning
 */

const Evaluator = require('../evaluator');
/**
 * Depth-limited minimax with alpha–beta pruning.
 * - Uses `rulesEngine` to enumerate legal moves and apply them to produce child FENs.
 * - Uses `Evaluator` to score leaf nodes (static evaluation).
 * - Tracks a running node counter and the best move discovered at root.
 *
 * Assumptions about `rulesEngine`:
 *   - getLegalMoves(fen): string[]
 *   - applyMove(fen, move): { fen: string, capturedPiece?: any, flags?: any }
 *   - parseFEN(fen): BoardObject
 *   - checkGameStatus(board): { type: 'CHECKMATE'|'STALEMATE'|'ONGOING'|string }
 **/
class MinimaxStrategy {
    constructor(rulesEngine, maxDepth) {
        this.rulesEngine = rulesEngine;
        this.maxDepth = maxDepth;
        this.evaluator = new Evaluator();
        this.bestMoveSoFar = null;
        this.nodesSearched = 0;
    }

    /**
     * Root search: iterate all legal moves, evaluate via minimax, and pick the best.
     * @param {string} fen - Current position in FEN notation.
     * @param {string[]} legalMoves - Legal moves from the root position.
     * @param {number} [seed] - Unused here; kept for API parity with other strategies.
     * @returns {{move:string|null,evaluation:number,depth:number,nodes:number}}
     *   move: best move found (or null if none),
     *   evaluation: evaluation score of the chosen move,
     *   depth: search depth actually used,
     *   nodes: total nodes expanded in this search.
     **/
    findBestMove(fen, legalMoves, seed) {
        this.bestMoveSoFar = legalMoves[0];
        this.nodesSearched = 0;
        
        let bestValue = -Infinity;
        let bestMove = legalMoves[0];
        
        for (const move of legalMoves) {
            const newFen = this.rulesEngine.applyMove(fen, move).fen;
            const value = this.minimax(newFen, this.maxDepth - 1, -Infinity, Infinity, false);
            
            if (value > bestValue) {
                bestValue = value;
                bestMove = move;
                this.bestMoveSoFar = move;
            }
        }
        
        return {
            move: bestMove,
            evaluation: bestValue,
            depth: this.maxDepth,
            nodes: this.nodesSearched
        };
    }

    /**
     * Depth-limited minimax with alpha–beta pruning.
     * @param {string} fen - Current node position.
     * @param {number} depth - Remaining depth to search (plies).
     * @param {number} alpha - Best score guaranteed for maximiser so far (lower bound).
     * @param {number} beta - Best score guaranteed for minimiser so far (upper bound).
     * @param {boolean} maximizingPlayer - True if the side to move is the maximiser.
     * @returns {number} Static evaluation for this node.
     **/
    minimax(fen, depth, alpha, beta, maximizingPlayer) {
        this.nodesSearched++;
        
        // Terminal node or depth limit reached
        if (depth === 0) {
            return this.evaluator.evaluatePosition(fen);
        }
        
        const legalMoves = this.rulesEngine.getLegalMoves(fen);
        
        // Game over conditions
        if (legalMoves.length === 0) {
            const board = this.rulesEngine.parseFEN(fen);
            const status = this.rulesEngine.checkGameStatus(board);
            
            if (status.type === 'CHECKMATE') {
                return maximizingPlayer ? -100000 : 100000;
            } else if (status.type === 'STALEMATE') {
                return 0;
            }
        }
        
        if (maximizingPlayer) {
            let maxEval = -Infinity;
            for (const move of legalMoves) {
                const newFen = this.rulesEngine.applyMove(fen, move).fen;
                const  evaluation = this.minimax(newFen, depth - 1, alpha, beta, false);
                maxEval = Math.max(maxEval,  evaluation);
                alpha = Math.max(alpha,  evaluation);
                if (beta <= alpha) break; // Alpha-beta pruning
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of legalMoves) {
                const newFen = this.rulesEngine.applyMove(fen, move).fen;
                const  evaluation = this.minimax(newFen, depth - 1, alpha, beta, true);
                minEval = Math.min(minEval,  evaluation);
                beta = Math.min(beta,  evaluation);
                if (beta <= alpha) break; // Alpha-beta pruning
            }
            return minEval;
        }
    }

    /**
     * Returns the most recently preferred move at the root during the last call to findBestMove.
     * Useful for UIs that display progressive best guesses during a time-limited search.
     * @returns {string|null}
     **/
    getBestMoveSoFar() {
        return this.bestMoveSoFar;
    }
}

module.exports = MinimaxStrategy;