/*
 * L1 - Greedy Strategy
 * Single-ply evaluation, captures when possible
 */

const Evaluator = require('../evaluator');

class GreedyStrategy {
    constructor(rulesEngine) {
        this.rulesEngine = rulesEngine;
        this.evaluator = new Evaluator();
        this.bestMoveSoFar = null;
    }

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

    getBestMoveSoFar() {
        return this.bestMoveSoFar;
    }
}

module.exports = GreedyStrategy;