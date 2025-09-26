/*
 * L0 - Random Strategy
 * Selects a completely random legal move
 *  * Stateless random move selector (optionally seeded).
 * `rulesEngine` is accepted for API parity with other strategies,
 * but is not required for pure random selection.
 */

class RandomStrategy {
    constructor(rulesEngine) {
        this.rulesEngine = rulesEngine;
        this.bestMoveSoFar = null;
    }

    /**
     * Choose a random move from the provided legal move list.
     * If `seed` is provided, uses a deterministic pseudo-random number for reproducible tests.
     *
     * @param {string} fen - Current position in FEN (unused by this strategy).
     * @param {string[]} legalMoves - Array of legal moves to choose from.
     * @param {number} [seed] - Optional seed for deterministic selection.
     * @returns {{move:string|null,evaluation:number,depth:number,nodes:number}}
     *   move: chosen move (null if no legal moves),
     *   evaluation: always 0 (no evaluation performed),
     *   depth: 0 (no search),
     *   nodes: 1 (single selection step).
     **/
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

    /**
     * Simple deterministic pseudo-random generator based on Math.sin.
     * Not cryptographically secure; intended only for reproducible tests.
     * @param {number} seed
     * @returns {number} Float in [0, 1).
     **/
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    /**
     * Returns the most recently selected move.
     * @returns {string|null}
     **/
    getBestMoveSoFar() {
        return this.bestMoveSoFar;
    }
}

module.exports = RandomStrategy;