const BaseRepository = require('./BaseRepository');
const RulesEngineAdapter = require('../adapters/RulesEngineAdapter');

class GameRepository extends BaseRepository {
    constructor(databaseService, rulesEngine = null) {
        super(databaseService);
        this.rulesEngine = rulesEngine;
    }

    /**
     * Set the rules engine instance (for dependency injection)
     */
    setRulesEngine(rulesEngine) {
        this.rulesEngine = rulesEngine;
    }

    // ==================== ORIGINAL METHODS (PRESERVED) ====================
    
    /**
     * Create a new game (ORIGINAL)
     */
    async create(gameData) {
        return await this.db.createGame(gameData);
    }

    /**
     * Get game by ID with player information (ORIGINAL)
     */
    async findById(gameId) {
        return await this.db.getGameState(gameId);
    }

    /**
     * Get basic game state (ORIGINAL - for Byron's rules engine)
     */
    async getGameState(gameId) {
        return await this.db.getGameState(gameId);
    }

    /**
     * Get game participants (ORIGINAL - for Elizabeth's authorization)
     */
    async getParticipants(gameId) {
        return await this.db.getGameParticipants(gameId);
    }

    /**
     * Save a move with game state update (ORIGINAL - optimistic locking)
     */
    async saveMove(gameId, moveData) {
        return await this.db.saveMove(gameId, moveData);
    }

    /**
     * Get all moves for a game (ORIGINAL)
     */
    async getMoves(gameId, limit = 100) {
        return await this.db.getGameMoves(gameId, limit);
    }

    /**
     * Get move history in chronological order (ORIGINAL - for PGN export)
     */
    async getMoveHistory(gameId) {
        const query = `
            SELECT ply, uci, san, flags, created_at
            FROM game_move 
            WHERE game_id = $1 
            ORDER BY ply ASC
        `;
        const result = await this.query(query, [gameId]);
        return result.rows;
    }

    /**
     * Find active games for a user (ORIGINAL)
     */
    async findActiveGamesForUser(userId) {
        const query = `
            SELECT g.*, 
                   wu.username as white_username,
                   bu.username as black_username
            FROM game g
            LEFT JOIN users wu ON g.white_player_id = wu.id
            LEFT JOIN users bu ON g.black_player_id = bu.id
            WHERE (g.white_player_id = $1 OR g.black_player_id = $1)
            AND g.status = 'active'
            ORDER BY g.updated_at DESC
        `;
        
        const result = await this.query(query, [userId]);
        return result.rows;
    }

    // ==================== ORIGINAL METHODS YOU HAD IN YOUR ROUTES ====================
    // These were referenced in your games.js routes, so preserving them

    /**
     * Find games waiting for opponents (ORIGINAL from your routes)
     */
    async findWaitingGames(excludeUserId = null) {
        let query = `
            SELECT g.*, 
                   wu.username as white_username,
                   bu.username as black_username
            FROM game g
            LEFT JOIN users wu ON g.white_player_id = wu.id
            LEFT JOIN users bu ON g.black_player_id = bu.id
            WHERE g.status = 'active' 
            AND (g.white_player_id IS NULL OR g.black_player_id IS NULL)
        `;
        
        const params = [];
        if (excludeUserId) {
            query += ' AND g.white_player_id != $1 AND (g.black_player_id IS NULL OR g.black_player_id != $1)';
            params.push(excludeUserId);
        }
        
        query += ' ORDER BY g.created_at DESC';
        
        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Find games by status (ORIGINAL from your routes)
     */
    async findByStatus(status, limit = 20) {
        const query = `
            SELECT g.*, 
                   wu.username as white_username,
                   bu.username as black_username
            FROM game g
            LEFT JOIN users wu ON g.white_player_id = wu.id
            LEFT JOIN users bu ON g.black_player_id = bu.id
            WHERE g.status = $1
            ORDER BY g.updated_at DESC
            LIMIT $2
        `;
        
        const result = await this.query(query, [status, limit]);
        return result.rows;
    }

    /**
     * Get recent games (ORIGINAL from your routes)
     */
    async getRecentGames(limit = 20) {
        const query = `
            SELECT g.*, 
                   wu.username as white_username,
                   bu.username as black_username
            FROM game g
            LEFT JOIN users wu ON g.white_player_id = wu.id
            LEFT JOIN users bu ON g.black_player_id = bu.id
            ORDER BY g.updated_at DESC
            LIMIT $1
        `;
        
        const result = await this.query(query, [limit]);
        return result.rows;
    }

    /**
     * Join a game as a player (ORIGINAL from your routes)
     */
    async joinGame(gameId, userId, color = null) {
        const game = await this.findById(gameId);
        if (!game) {
            throw new Error('GAME_NOT_FOUND');
        }

        if (game.status !== 'active') {
            throw new Error('GAME_NOT_JOINABLE');
        }

        // Determine which color to assign
        let updateField;
        if (color === 'white' && !game.white_player_id) {
            updateField = 'white_player_id';
        } else if (color === 'black' && !game.black_player_id) {
            updateField = 'black_player_id';
        } else if (!game.white_player_id) {
            updateField = 'white_player_id';
        } else if (!game.black_player_id) {
            updateField = 'black_player_id';
        } else {
            throw new Error('SEAT_TAKEN'); // Preserving your original error message
        }

        const query = `
            UPDATE game 
            SET ${updateField} = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `;

        const result = await this.query(query, [userId, gameId]);
        return result.rows[0];
    }

    /**
     * Export game to PGN format (ORIGINAL from your routes)
     */
    async exportPGN(gameId) {
        const gameState = await this.db.getGameState(gameId);
        if (!gameState) {
            throw new Error('Game not found'); // Preserving your original error message
        }

        const moves = await this.getMoveHistory(gameId);
        
        // Build PGN header (keeping your original format)
        let pgn = '[Event "Los Alamos Chess Game"]\n';
        pgn += `[Date "${gameState.created_at.toISOString().split('T')[0]}"]\n`;
        pgn += `[White "${gameState.white_username || 'Unknown'}"]\n`;
        pgn += `[Black "${gameState.black_username || 'Unknown'}"]\n`;
        pgn += '[Variant "Los Alamos"]\n';
        pgn += `[FEN "${moves[0]?.prev_fen || 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1'}"]\n`;
        
        // Determine result
        let result = '*';
        if (gameState.status === 'mate') {
            result = gameState.to_move === 'w' ? '0-1' : '1-0';
        } else if (gameState.status === 'draw' || gameState.status === 'stalemate') {
            result = '1/2-1/2';
        }
        pgn += `[Result "${result}"]\n\n`;

        // Build move list
        let moveText = '';
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            if (i % 2 === 0) {
                moveText += `${Math.floor(i / 2) + 1}. `;
            }
            moveText += move.san + ' ';
        }
        
        pgn += moveText.trim();
        if (result !== '*') {
            pgn += ' ' + result;
        }

        return pgn;
    }

    // ==================== NEW: BYRON'S RULES ENGINE INTEGRATION ====================
    // These are NEW methods that ADD Byron's integration without removing existing functionality

    /**
     * Get game state formatted for rules engine (NEW)
     */
    async getGameStateForRulesEngine(gameId) {
        return await this.db.getGameStateForRulesEngine(gameId);
    }

    /**
     * Check if user can make a move (NEW - authorization check)
     */
    async canUserMove(gameId, userId) {
        return await this.db.canUserMakeMove(gameId, userId);
    }

    /**
     * Make a move using Byron's rules engine (NEW - main integration point)
     */
    async makeMove(gameId, uci, userId = null, options = {}) {
        if (!this.rulesEngine) {
            throw new Error('Rules engine not available');
        }

        // Step 1: Get current game state
        const gameState = await this.db.getGameState(gameId);
        if (!gameState) {
            throw new Error('GAME_NOT_FOUND');
        }

        // Step 2: Pre-move validation
        const consistency = RulesEngineAdapter.validateMoveConsistency(gameState, uci);
        if (!consistency.valid) {
            throw new Error(consistency.error);
        }

        // Step 3: Authorization check (if user provided)
        if (userId) {
            const authCheck = await this.canUserMove(gameId, userId);
            if (!authCheck.canMove) {
                throw new Error(authCheck.reason);
            }
        }

        // Step 4: Validate move with Byron's rules engine
        const currentFEN = gameState.current_fen;
        const validation = this.rulesEngine.validateMove(currentFEN, uci);
        
        if (!validation.valid) {
            throw new Error(validation.error || 'INVALID_MOVE');
        }

        // Step 5: Apply move with rules engine
        const moveResult = this.rulesEngine.applyMove(currentFEN, uci);
        
        if (!moveResult || !moveResult.fen) {
            throw new Error('MOVE_APPLICATION_FAILED');
        }

        // Step 6: Save to database
        const by = options.by || 'human';
        const serverMs = options.serverMs || 0;
        
        const dbResult = await this.db.saveValidatedMove(
            gameId, moveResult, uci, by, serverMs
        );

        // Step 7: Return comprehensive result
        return {
            success: true,
            game: dbResult.game,
            move: dbResult.move,
            validation: validation,
            moveResult: moveResult,
            flags: {
                check: moveResult.flags.check || false,
                checkmate: moveResult.flags.checkmate || false,
                stalemate: moveResult.flags.stalemate || false,
                capture: validation.flags.capture || false,
                promotion: validation.flags.promotion || false
            }
        };
    }

    /**
     * Get all legal moves for current position (NEW - using rules engine)
     */
    async getLegalMoves(gameId) {
        if (!this.rulesEngine) {
            throw new Error('Rules engine not available');
        }

        const gameState = await this.db.getGameState(gameId);
        if (!gameState) {
            throw new Error('GAME_NOT_FOUND');
        }

        return this.rulesEngine.getLegalMoves(gameState.current_fen);
    }

    /**
     * Validate a move without applying it (NEW)
     */
    async validateMove(gameId, uci, userId = null) {
        if (!this.rulesEngine) {
            throw new Error('Rules engine not available');
        }

        const gameState = await this.db.getGameState(gameId);
        if (!gameState) {
            return { valid: false, error: 'GAME_NOT_FOUND' };
        }

        // Authorization check if user provided
        if (userId) {
            const authCheck = await this.canUserMove(gameId, userId);
            if (!authCheck.canMove) {
                return { valid: false, error: authCheck.reason };
            }
        }

        // Consistency check
        const consistency = RulesEngineAdapter.validateMoveConsistency(gameState, uci);
        if (!consistency.valid) {
            return { valid: false, error: consistency.error };
        }

        // Rules engine validation
        return this.rulesEngine.validateMove(gameState.current_fen, uci);
    }

    /**
     * Get game status and position analysis (NEW)
     */
    async getGameAnalysis(gameId) {
        if (!this.rulesEngine) {
            throw new Error('Rules engine not available');
        }

        const gameState = await this.db.getGameState(gameId);
        if (!gameState) {
            throw new Error('GAME_NOT_FOUND');
        }

        const legalMoves = this.rulesEngine.getLegalMoves(gameState.current_fen);
        
        return {
            gameId: gameId,
            currentFEN: gameState.current_fen,
            status: gameState.status,
            toMove: gameState.to_move,
            ply: gameState.ply,
            legalMovesCount: legalMoves.length,
            isActive: gameState.status === 'active'
        };
    }

    /**
     * Check if a game needs cleanup (NEW - abandoned games, etc.)
     */
    async checkGameCleanup(gameId) {
        const query = `
            SELECT id, status, updated_at,
                   white_player_id, black_player_id
            FROM game 
            WHERE id = $1
        `;
        
        const result = await this.query(query, [gameId]);
        if (result.rows.length === 0) return null;
        
        const game = result.rows[0];
        const hoursSinceUpdate = (Date.now() - game.updated_at.getTime()) / (1000 * 60 * 60);
        
        return {
            gameId: gameId,
            status: game.status,
            hoursSinceUpdate: hoursSinceUpdate,
            needsCleanup: game.status === 'active' && hoursSinceUpdate > 24,
            isAbandoned: !game.white_player_id || !game.black_player_id
        };
    }
}

module.exports = GameRepository;