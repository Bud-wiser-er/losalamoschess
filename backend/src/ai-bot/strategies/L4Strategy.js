/*
 * L4 - Fairy-Stockfish Strategy
 * Expert level using external engine with ELO-based strength
 * Author: Byron Norval
 * Last Update: 26/09/2025
 */

const { Engine } = require('node-uci');
const path = require('path');

// Singleton engine instance to avoid memory leaks
let engineInstance = null;

class L4Strategy {
    constructor(rulesEngine) {
        this.rulesEngine = rulesEngine;
        this.enginePath = path.join(__dirname, '..', '..', '..', 'bin', 'fairy-stockfish.exe');
        this.currentElo = null;
        this.bestMoveSoFar = null;
    }

    /**
     * Initialize Fairy-Stockfish engine (singleton pattern)
     * @param {number} elo - Target ELO strength (1000-3000)
     */
    async initializeEngine(elo = 2000) {
        try {
            if (!engineInstance) {
                engineInstance = new Engine(this.enginePath);
                await engineInstance.init();
                await engineInstance.setoption('UCI_Variant', 'losalamos');
                await engineInstance.isready();
            }
            
            this.engine = engineInstance;

            // Update ELO if different
            if (this.currentElo !== elo) {
                const clampedElo = Math.max(1000, Math.min(3000, elo));
                await this.engine.setoption('UCI_LimitStrength', 'true');
                await this.engine.setoption('UCI_Elo', String(clampedElo));
                this.currentElo = clampedElo;
                await this.engine.isready();
            }

            return true;
        } catch (error) {
            console.error('Failed to initialize Fairy-Stockfish:', error.message);
            return false;
        }
    }

    /**
     * Main interface matching L0-L3 pattern
     * @param {string} fen - Current board position
     * @param {string[]} legalMoves - Array of legal UCI moves
     * @param {number} seed - Optional seed (used for ELO in L4)
     * @returns {Object} Move result with evaluation and metadata
     */
    async findBestMove(fen, legalMoves, seed) {
        // In L4, we use 'seed' parameter as ELO rating for consistency with bot interface
        const elo = seed || 2000;

        // Fallback if no legal moves
        if (!legalMoves || legalMoves.length === 0) {
            return {
                move: null,
                evaluation: 0,
                depth: 0,
                nodes: 0
            };
        }

        // Only one move - return it immediately
        if (legalMoves.length === 1) {
            this.bestMoveSoFar = legalMoves[0];
            return {
                move: legalMoves[0],
                evaluation: 0,
                depth: 0,
                nodes: 1
            };
        }

        // Initialize engine
        const initialized = await this.initializeEngine(elo);
        if (!initialized) {
            // Fallback to random if engine fails
            return this.fallbackRandom(legalMoves);
        }

        try {
            // Set position
            await this.engine.position(fen);

            // Search for best move
            const result = await this.engine.go({ 
                movetime: 2000  // 2 seconds search
            });

            const bestMove = result.bestmove;

            // Validate move is in legal moves list
            if (legalMoves.includes(bestMove)) {
                this.bestMoveSoFar = bestMove;

                const lastInfo = result.info?.[result.info.length - 1] || {};
                
                return {
                    move: bestMove,
                    evaluation: (lastInfo.score?.value || 0) / 100.0, // Centipawns to pawns
                    depth: lastInfo.depth || 0,
                    nodes: lastInfo.nodes || 0,
                    elo: this.currentElo
                };
            }

            // Engine suggested illegal move - fallback
            console.warn('Fairy-Stockfish suggested illegal move:', bestMove);
            return this.fallbackRandom(legalMoves);

        } catch (error) {
            console.error('Fairy-Stockfish search error:', error.message);
            return this.fallbackRandom(legalMoves);
        }
    }

    /**
     * Fallback to random move if engine fails
     * @param {string[]} legalMoves 
     */
    fallbackRandom(legalMoves) {
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        this.bestMoveSoFar = randomMove;
        return {
            move: randomMove,
            evaluation: 0,
            depth: 0,
            nodes: 1,
            fallback: true
        };
    }

    /**
     * Get best move found so far (required by bot interface)
     */
    getBestMoveSoFar() {
        return this.bestMoveSoFar;
    }

    /**
     * Cleanup engine on shutdown
     */
    async cleanup() {
        if (engineInstance) {
            try {
                await engineInstance.quit();
                engineInstance = null;
            } catch (error) {
                console.error('Error closing Fairy-Stockfish:', error);
            }
        }
    }
}

module.exports = L4Strategy;