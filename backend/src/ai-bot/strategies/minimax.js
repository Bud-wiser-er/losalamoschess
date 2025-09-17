/*
 * L2 - Minimax Strategy
 * Looks 2 moves ahead using minimax with alpha-beta pruning
 */

const Evaluator = require('../evaluator');

class MinimaxStrategy {
    constructor(rulesEngine, maxDepth) {
        this.rulesEngine = rulesEngine;
        this.maxDepth = maxDepth;
        this.evaluator = new Evaluator();
        this.bestMoveSoFar = null;
        this.nodesSearched = 0;
    }

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

    getBestMoveSoFar() {
        return this.bestMoveSoFar;
    }
}

module.exports = MinimaxStrategy;