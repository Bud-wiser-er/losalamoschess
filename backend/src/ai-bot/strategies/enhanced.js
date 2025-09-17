/*
 * L3 - Enhanced Minimax Strategy
 * Depth 3 with move ordering and transposition table
 */

const MinimaxStrategy = require('./minimax');
const Evaluator = require('../evaluator');

class EnhancedStrategy extends MinimaxStrategy {
    constructor(rulesEngine) {
        super(rulesEngine, 3); // Depth 3
        this.transpositionTable = new Map(); // Cache positions
        this.evaluator = new Evaluator();
    }

    findBestMove(fen, legalMoves, seed) {
        // Clear transposition table for new search
        this.transpositionTable.clear();
        
        // Order moves for better alpha-beta pruning
        const orderedMoves = this.orderMoves(fen, legalMoves);
        
        return super.findBestMove(fen, orderedMoves, seed);
    }

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