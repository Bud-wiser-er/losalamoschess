const db = require('../../database/connection');
const bcrypt = require('bcrypt');

class DatabaseService {
    constructor() {
        this.connection = db;
    }

    // ==================== USER MANAGEMENT ====================
    
    async findUserByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await this.connection.query(query, [email]);
        return result.rows[0] || null;
    }

    async findUserByUsername(username) {
        const query = 'SELECT * FROM users WHERE username = $1';
        const result = await this.connection.query(query, [username]);
        return result.rows[0] || null;
    }

    async findUserById(id) {
        const query = 'SELECT * FROM users WHERE id = $1';
        const result = await this.connection.query(query, [id]);
        return result.rows[0] || null;
    }

    async createUser(userData) {
        const { username, email, password, rating = 1200 } = userData;
        const passwordHash = await bcrypt.hash(password, 12);
        
        const query = `
            INSERT INTO users (username, email, password_hash, rating)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, rating, created_at
        `;
        
        const result = await this.connection.query(query, [username, email, passwordHash, rating]);
        return result.rows[0];
    }

    async updateUser(id, updates) {
        const allowedFields = ['username', 'email', 'rating', 'is_online', 'refresh_token', 'token_expiry', 'reset_token', 'reset_expiry'];
        const updateFields = [];
        const values = [];
        let paramCount = 1;

        for (const [field, value] of Object.entries(updates)) {
            if (allowedFields.includes(field)) {
                updateFields.push(`${field} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (updateFields.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id); // Add ID for WHERE clause
        const query = `
            UPDATE users 
            SET ${updateFields.join(', ')}, updated_at = NOW()
            WHERE id = $${paramCount}
            RETURNING id, username, email, rating, is_online, updated_at
        `;

        const result = await this.connection.query(query, values);
        return result.rows[0];
    }

    // ==================== GAME MANAGEMENT ====================

    async createGame(gameData) {
        const { 
            whitePlayerId = null, 
            blackPlayerId = null, 
            initialFen = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
            whiteClockMs = 300000,
            blackClockMs = 300000
        } = gameData;

        const query = `
            INSERT INTO game (current_fen, white_player_id, black_player_id, white_clock_ms, black_clock_ms)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const result = await this.connection.query(query, [
            initialFen, whitePlayerId, blackPlayerId, whiteClockMs, blackClockMs
        ]);
        return result.rows[0];
    }

    async getGameById(gameId) {
        const query = 'SELECT * FROM game WHERE id = $1';
        const result = await this.connection.query(query, [gameId]);
        return result.rows[0] || null;
    }

    async getGameState(gameId) {
        const query = `
            SELECT g.*, 
                   wu.username as white_username,
                   bu.username as black_username
            FROM game g
            LEFT JOIN users wu ON g.white_player_id = wu.id
            LEFT JOIN users bu ON g.black_player_id = bu.id
            WHERE g.id = $1
        `;
        const result = await this.connection.query(query, [gameId]);
        return result.rows[0] || null;
    }

    async getGameParticipants(gameId) {
        const query = `
            SELECT white_player_id, black_player_id 
            FROM game 
            WHERE id = $1
        `;
        const result = await this.connection.query(query, [gameId]);
        return result.rows[0] || null;
    }

    async saveMove(gameId, moveData) {
        return await this.connection.withTransaction(async (client) => {
            const { 
                ply, by, uci, san, flags, prevFen, nextFen, serverMsSpent,
                newClockWhite, newClockBlack, newStatus, newToMove 
            } = moveData;

            // First, get current version for optimistic locking
            const gameQuery = 'SELECT version FROM game WHERE id = $1 FOR UPDATE';
            const gameResult = await client.query(gameQuery, [gameId]);
            
            if (gameResult.rows.length === 0) {
                throw new Error('Game not found');
            }

            const currentVersion = gameResult.rows[0].version;

            // Insert the move
            const moveQuery = `
                INSERT INTO game_move (game_id, ply, by, uci, san, flags, prev_fen, next_fen, server_ms_spent)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const moveResult = await client.query(moveQuery, [
                gameId, ply, by, uci, san, JSON.stringify(flags), prevFen, nextFen, serverMsSpent
            ]);

            // Update the game state
            const updateGameQuery = `
                UPDATE game 
                SET current_fen = $1, 
                    to_move = $2, 
                    status = $3, 
                    ply = $4,
                    white_clock_ms = $5,
                    black_clock_ms = $6,
                    version = version + 1,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING *
            `;

            const updateResult = await client.query(updateGameQuery, [
                nextFen, newToMove, newStatus, ply, newClockWhite, newClockBlack, gameId
            ]);

            return {
                move: moveResult.rows[0],
                game: updateResult.rows[0],
                previousVersion: currentVersion
            };
        });
    }

    async getGameMoves(gameId, limit = 50) {
        const query = `
            SELECT * FROM game_move 
            WHERE game_id = $1 
            ORDER BY ply DESC 
            LIMIT $2
        `;
        const result = await this.connection.query(query, [gameId, limit]);
        return result.rows;
    }

    // ==================== BOT AUDIT ====================

    async saveBotRun(gameId, ply, request, reply) {
        const query = `
            INSERT INTO bot_run (game_id, ply, request, reply)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const result = await this.connection.query(query, [
            gameId, ply, JSON.stringify(request), JSON.stringify(reply)
        ]);
        return result.rows[0];
    }

    // ==================== AUDIT LOGGING ====================

    async createAuditLog(logData) {
        const { action, userId = null, metadata = {}, ipAddress = null } = logData;
        const query = `
            INSERT INTO audit_log (action, user_id, metadata, ip_address)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const result = await this.connection.query(query, [
            action, userId, JSON.stringify(metadata), ipAddress
        ]);
        return result.rows[0];
    }

    // ==================== IDEMPOTENCY ====================

    async getIdempotentResponse(key) {
        const query = 'SELECT response FROM idempotency WHERE key = $1 AND created_at > NOW() - INTERVAL \'10 minutes\'';
        const result = await this.connection.query(query, [key]);
        return result.rows[0]?.response || null;
    }

    async saveIdempotentResponse(key, gameId, response) {
        const query = `
            INSERT INTO idempotency (key, game_id, response)
            VALUES ($1, $2, $3)
            ON CONFLICT (key) DO NOTHING
            RETURNING *
        `;
        const result = await this.connection.query(query, [key, gameId, JSON.stringify(response)]);
        return result.rows[0];
    }

    // ==================== FRIENDS SYSTEM ====================

    async sendFriendRequest(userId, friendId) {
        const query = `
            INSERT INTO friend (user_id, friend_id, status)
            VALUES ($1, $2, 'pending')
            ON CONFLICT (user_id, friend_id) 
            DO UPDATE SET status = 'pending', updated_at = NOW()
            RETURNING *
        `;
        const result = await this.connection.query(query, [userId, friendId]);
        return result.rows[0];
    }

    async acceptFriendRequest(userId, friendId) {
        return await this.connection.withTransaction(async (client) => {
            // Accept the incoming request
            const acceptQuery = `
                UPDATE friend 
                SET status = 'accepted', updated_at = NOW()
                WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
                RETURNING *
            `;
            const acceptResult = await client.query(acceptQuery, [friendId, userId]);

            // Create reciprocal friendship
            const reciprocalQuery = `
                INSERT INTO friend (user_id, friend_id, status)
                VALUES ($1, $2, 'accepted')
                ON CONFLICT (user_id, friend_id) 
                DO UPDATE SET status = 'accepted', updated_at = NOW()
            `;
            await client.query(reciprocalQuery, [userId, friendId]);

            return acceptResult.rows[0];
        });
    }

    async getFriends(userId) {
        const query = `
            SELECT f.*, u.username, u.email, u.rating, u.is_online
            FROM friend f
            JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = $1 AND f.status = 'accepted'
            ORDER BY u.username
        `;
        const result = await this.connection.query(query, [userId]);
        return result.rows;
    }

    // ==================== TOURNAMENTS ====================

    async createTournament(tournamentData) {
        const { name, description, format = 'swiss', maxParticipants = 16, startTime, createdBy } = tournamentData;
        const query = `
            INSERT INTO tournament (name, description, format, max_participants, start_time, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const result = await this.connection.query(query, [
            name, description, format, maxParticipants, startTime, createdBy
        ]);
        return result.rows[0];
    }

    async joinTournament(tournamentId, userId) {
        const query = `
            INSERT INTO tournament_participant (tournament_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (tournament_id, user_id) DO NOTHING
            RETURNING *
        `;
        const result = await this.connection.query(query, [tournamentId, userId]);
        return result.rows[0];
    }

    // ==================== UTILITY ====================

    async healthCheck() {
        try {
            const result = await this.connection.query('SELECT NOW() as current_time');
            return { status: 'healthy', timestamp: result.rows[0].current_time };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

module.exports = DatabaseService;