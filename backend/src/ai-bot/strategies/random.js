/*
 * L0 - Random Strategy
 * Selects a completely random legal move
 */

class RandomStrategy {
    constructor(rulesEngine) {
        this.rulesEngine = rulesEngine;
        this.bestMoveSoFar = null;
    }

    findBestMove(fen, legalMoves, seed) {
        // Use seeded random if provided (for testing)
        const random = seed ? this.seededRandom(seed) : Math.random();
        const index = Math.floor(random * legalMoves.length);
        
        this.bestMoveSoFar = legalMoves[index];
        
        return {
            move: legalMoves[index],
            evaluation: 0,
            depth: 0,
            nodes: 1
        };
    }

    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    getBestMoveSoFar() {
        return this.bestMoveSoFar;
    }
}

module.exports = RandomStrategy;