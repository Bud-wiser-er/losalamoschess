const BaseRepository = require('./BaseRepository');

class GameRepository extends BaseRepository {
    constructor(databaseService) {
        super(databaseService);
    }

    /**
     * Create a new game
     */
    async create(gameData) {
        return await this.db.createGame(gameData);
    }

    /**
     * Get game by ID with player information
     */
    async findById(gameId) {
        return await this.db.getGameState(gameId);
    }

    /**
     * Get basic game state (for Byron's rules engine)
     */
    async getGameState(gameId) {
        return await this.db.getGameState(gameId);
    }

    /**
     * Get game participants (for Elizabeth's authorization)
     */
    async getParticipants(gameId) {
        return await this.db.getGameParticipants(gameId);
    }

    /**
     * Save a move with game state update (optimistic locking)
     */
    async saveMove(gameId, moveData) {
        return await this.db.saveMove(gameId, moveData);
    }

    /**
     * Get all moves for a game
     */
    async getMoves(gameId, limit = 100) {
        return await this.db.getGameMoves(gameId, limit);
    }

    /**
     * Get move history in chronological order (for PGN export)
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
     * Find active games for a user
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

    /**
     * Find games waiting for an opponent
     */
    async findWaitingGames(excludeUserId = null) {
        let query = `
            SELECT g.*, u.username as creator_username
            FROM game g
            LEFT JOIN users u ON (g.white_player_id = u.id OR g.black_player_id = u.id)
            WHERE (g.white_player_id IS NULL OR g.black_player_id IS NULL)
            AND g.status = 'active'
        `;
        const params = [];

        if (excludeUserId) {
            query += ` AND g.white_player_id != $1 AND g.black_player_id != $1`;
            params.push(excludeUserId);
        }

        query += ` ORDER BY g.created_at ASC`;

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Join a game as a specific color
     */
    async joinGame(gameId, userId, color) {
        const colorColumn = color === 'white' ? 'white_player_id' : 'black_player_id';
        
        const query = `
            UPDATE game 
            SET ${colorColumn} = $1, updated_at = NOW()
            WHERE id = $2 
            AND ${colorColumn} IS NULL
            AND status = 'active'
            RETURNING *
        `;

        const result = await this.query(query, [userId, gameId]);
        if (result.rows.length === 0) {
            throw new Error('SEAT_TAKEN');
        }
        return result.rows[0];
    }

    /**
     * Update game status (mate, stalemate, draw)
     */
    async updateStatus(gameId, status, winnerId = null) {
        const query = `
            UPDATE game 
            SET status = $1, winner_id = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `;
        const result = await this.query(query, [status, winnerId, gameId]);
        return result.rows[0];
    }

    /**
     * Update game clocks
     */
    async updateClocks(gameId, whiteClockMs, blackClockMs) {
        const query = `
            UPDATE game 
            SET white_clock_ms = $1, black_clock_ms = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `;
        const result = await this.query(query, [whiteClockMs, blackClockMs, gameId]);
        return result.rows[0];
    }

    /**
     * Get recent games for the homepage
     */
    async getRecentGames(limit = 20) {
        const query = `
            SELECT g.id, g.status, g.created_at, g.updated_at, g.winner_id,
                   wu.username as white_username,
                   bu.username as black_username
            FROM game g
            LEFT JOIN users wu ON g.white_player_id = wu.id
            LEFT JOIN users bu ON g.black_player_id = bu.id
            WHERE g.status != 'active'
            ORDER BY g.updated_at DESC
            LIMIT $1
        `;
        const result = await this.query(query, [limit]);
        return result.rows;
    }

    /**
     * Get games by status
     */
    async findByStatus(status, limit = 50) {
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
     * Check if user can make a move (authorization helper)
     */
    async canUserMove(gameId, userId) {
        const query = `
            SELECT 
                to_move,
                white_player_id,
                black_player_id,
                status
            FROM game 
            WHERE id = $1
        `;
        const result = await this.query(query, [gameId]);
        
        if (result.rows.length === 0) {
            return { canMove: false, reason: 'GAME_NOT_FOUND' };
        }

        const game = result.rows[0];
        
        if (game.status !== 'active') {
            return { canMove: false, reason: 'GAME_NOT_ACTIVE' };
        }

        const isWhitePlayer = game.white_player_id === userId;
        const isBlackPlayer = game.black_player_id === userId;
        
        if (!isWhitePlayer && !isBlackPlayer) {
            return { canMove: false, reason: 'NOT_PARTICIPANT' };
        }

        const isUserTurn = (game.to_move === 'w' && isWhitePlayer) || 
                          (game.to_move === 'b' && isBlackPlayer);

        if (!isUserTurn) {
            return { canMove: false, reason: 'NOT_YOUR_TURN' };
        }

        return { canMove: true };
    }

    /**
     * Export game in PGN format
     */
    async exportPGN(gameId) {
        const game = await this.findById(gameId);
        if (!game) {
            throw new Error('Game not found');
        }

        const moves = await this.getMoveHistory(gameId);
        
        // PGN Headers
        const headers = [
            '[Event "Los Alamos Chess Game"]',
            `[Site "Los Alamos Chess Platform"]`,
            `[Date "${game.created_at.toISOString().split('T')[0]}"]`,
            `[Round "1"]`,
            `[White "${game.white_username || 'Unknown'}"]`,
            `[Black "${game.black_username || 'Unknown'}"]`,
            `[Variant "Los Alamos"]`,
            `[FEN "rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1"]`,
        ];

        // Result
        let result = '1/2-1/2'; // draw
        if (game.winner_id === game.white_player_id) result = '1-0';
        else if (game.winner_id === game.black_player_id) result = '0-1';
        
        headers.push(`[Result "${result}"]`);

        // Move text
        let moveText = '';
        for (let i = 0; i < moves.length; i++) {
            if (i % 2 === 0) {
                moveText += `${Math.floor(i / 2) + 1}. `;
            }
            moveText += `${moves[i].san} `;
        }
        moveText += result;

        return headers.join('\n') + '\n\n' + moveText;
    }

    /**
     * Get game statistics for analytics
     */
    async getGameStats() {
        const query = `
            SELECT 
                COUNT(*) as total_games,
                COUNT(*) FILTER (WHERE status = 'active') as active_games,
                COUNT(*) FILTER (WHERE status = 'mate') as checkmate_games,
                COUNT(*) FILTER (WHERE status = 'stalemate') as stalemate_games,
                COUNT(*) FILTER (WHERE status = 'draw') as draw_games,
                AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60) as avg_game_duration_minutes
            FROM game
            WHERE status != 'active' OR created_at > NOW() - INTERVAL '24 hours'
        `;
        const result = await this.query(query);
        return result.rows[0];
    }
}

module.exports = GameRepository;