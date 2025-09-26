/*
 * Author: Byron Norval
 * Last Update: 21/09/2025
 * Title: AI Bot for Los Alamos Chess
 * Description: Main AI Bot class with L0-L3 difficulty levels
 * more comments added 26/09/2025 wihtout changes t acutal code
 * 
 */

const RulesEngine = require('../engine/index');
const BoardValidator = require('../engine/board-validator');
const RandomStrategy = require('./strategies/random');
const GreedyStrategy = require('./strategies/greedy');
const MinimaxStrategy = require('./strategies/minimax');
const EnhancedStrategy = require('./strategies/enhanced');

/**
 * AI bot façade that validates inputs, enumerates legal moves,
 * and delegates move selection to the chosen strategy (L0–L3).
 *
 * Responsibilities:
 *  - Validate request (FEN, level).
 *  - Validate/parse FEN and enumerate legal moves using the rules engine.
 *  - Run the selected strategy within a time cap (timeout safety).
 *  - Provide a sensible fallback on timeout (best-so-far or first legal move).
 *
 * Strategies:
 *  - L0: RandomStrategy     (0-ply)
 *  - L1: GreedyStrategy     (1-ply static with tactical bonuses)
 *  - L2: MinimaxStrategy    (depth set by constructor param, here 2)
 *  - L3: EnhancedStrategy   (depth 3 + ordering + TT; constructor may ignore 2nd arg)
 */
class AIBot {
    constructor() {
        this.rulesEngine = new RulesEngine();
        this.validator = new BoardValidator();
        this.strategies = {
            'L0': new RandomStrategy(this.rulesEngine),
            'L1': new GreedyStrategy(this.rulesEngine),
            'L2': new MinimaxStrategy(this.rulesEngine, 2),
            'L3': new EnhancedStrategy(this.rulesEngine, 3)
        };
    }

    /**
     * Main interface for generating bot moves
     * @param {Object} request - Bot request object
     * @param {string} request.fen - Current board position
     * @param {string} request.level - Difficulty level (L0-L3)
     * @param {number} request.msCap - Maximum time in milliseconds (default 5000)
     * @param {number} request.seed - Optional seed for reproducible randomness
     * @returns {Promise<Object>} Bot response with move and metadata
     */
    async generateMove(request) {
        const { fen, level, msCap = 5000, seed } = request;
        
        // Validate request parameters
        if (!fen || !level) {
            return {
                ok: false,
                error: 'INVALID_REQUEST',
                details: 'Missing required parameters: fen and level'
            };
        }
        
        if (!this.strategies[level]) {
            return {
                ok: false,
                error: 'INVALID_LEVEL',
                details: `Invalid difficulty level: ${level}. Use L0, L1, L2, or L3`
            };
        }
        
        // Validate FEN string before processing
        if (!this.validator.isValidFEN(fen)) {
            return {
                ok: false,
                error: 'INVALID_FEN',
                details: 'The provided FEN string is not valid for Los Alamos Chess'
            };
        }
        
        // Try to parse the FEN to ensure it's actually usable
        const board = this.rulesEngine.parseFEN(fen);
        if (!board) {
            return {
                ok: false,
                error: 'FEN_PARSE_ERROR',
                details: 'Failed to parse FEN string into board state'
            };
        }
        
        // Get legal moves
        const legalMoves = this.rulesEngine.getLegalMoves(fen);
        
        if (legalMoves.length === 0) {
            return {
                ok: false,
                error: 'NO_LEGAL_MOVES',
                details: 'No legal moves available in this position'
            };
        }
        
        // Execute strategy with timeout
        try {
            const startTime = Date.now();
            const strategy = this.strategies[level];
            
            const moveResult = await this.executeWithTimeout(
                () => strategy.findBestMove(fen, legalMoves, seed),
                msCap
            );
            
            const endTime = Date.now();
            
            return {
                ok: true,
                move: moveResult.move,
                evaluation: moveResult.evaluation,
                depth: moveResult.depth,
                nodes: moveResult.nodes,  // Fixed: was nodesSearched
                timeMs: endTime - startTime
            };
        } catch (error) {
            if (error.message === 'TIMEOUT') {
                // Return best move found so far
                const strategy = this.strategies[level];
                const fallbackMove = strategy.getBestMoveSoFar() || legalMoves[0];
                
                return {
                    ok: true,
                    move: fallbackMove,
                    evaluation: 0,
                    depth: 0,
                    timeout: true,
                    timeMs: msCap
                };
            }
            
            return {
                ok: false,
                error: 'INTERNAL_ERROR',
                details: error.message
            };
        }
    }

    /**
     * Utility: run a function with a hard timeout.
     * Resolves with the function’s result if it finishes in time; otherwise rejects with Error('TIMEOUT').
     *
     * @template T
     * @param {() => Promise<T> | T} func - Function to execute (may be sync or async).
     * @param {number} timeoutMs - Millisecond timeout budget.
     * @returns {Promise<T>}
     **/
    executeWithTimeout(func, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('TIMEOUT'));
            }, timeoutMs);
            
            Promise.resolve(func())
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }
}

module.exports = AIBot;