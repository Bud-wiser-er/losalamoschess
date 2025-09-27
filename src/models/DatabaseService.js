const db = require('../../database/connection');
const bcrypt = require('bcrypt');
const RulesEngineAdapter = require('../adapters/RulesEngineAdapter');

class DatabaseService {
    constructor() {
        this.connection = db;
    }

    // ==================== USER MANAGEMENT ====================
    // Updated to match Elizabeth's AuthenticationService interface expectations
    
    async findUserByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await this.connection.query(query, [email]);
        
        // Convert database fields to match AuthenticationService expectations
        if (result.rows[0]) {
            return this._convertUserFromDb(result.rows[0]);
        }
        return null;
    }

    async findUserByUsername(username) {
        const query = 'SELECT * FROM users WHERE username = $1';
        const result = await this.connection.query(query, [username]);
        
        if (result.rows[0]) {
            return this._convertUserFromDb(result.rows[0]);
        }
        return null;
    }

    async findUserById(id) {
        const query = 'SELECT * FROM users WHERE id = $1';
        const result = await this.connection.query(query, [id]);
        
        if (result.rows[0]) {
            return this._convertUserFromDb(result.rows[0]);
        }
        return null;
    }

    async createUser(userData) {
        // Handle both AuthenticationService format and direct format
        const { username, email, password, passwordHash, rating = 1200, isOnline = false } = userData;
        
        // Use provided passwordHash, or hash the password
        let hashedPassword;
        if (passwordHash) {
            hashedPassword = passwordHash;
        } else if (password) {
            hashedPassword = await bcrypt.hash(password, 12);
        } else {
            throw new Error('Password or passwordHash required');
        }
        
        const query = `
            INSERT INTO users (username, email, password_hash, rating, is_online)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        
        const result = await this.connection.query(query, [
            username, email, hashedPassword, rating, isOnline
        ]);
        
        return this._convertUserFromDb(result.rows[0]);
    }

    async updateUser(id, userData) {
        // Update user data while preserving existing functionality
        const { username, email, passwordHash, rating, isOnline, refreshToken, tokenExpiry, resetToken, resetExpiry } = userData;
        
        // Build dynamic update query
        const fields = [];
        const values = [];
        let paramCount = 1;
        
        if (username !== undefined) {
            fields.push(`username = $${paramCount++}`);
            values.push(username);
        }
        if (email !== undefined) {
            fields.push(`email = $${paramCount++}`);
            values.push(email);
        }
        if (passwordHash !== undefined) {
            fields.push(`password_hash = $${paramCount++}`);
            values.push(passwordHash);
        }
        if (rating !== undefined) {
            fields.push(`rating = $${paramCount++}`);
            values.push(rating);
        }
        if (isOnline !== undefined) {
            fields.push(`is_online = $${paramCount++}`);
            values.push(isOnline);
        }
        if (refreshToken !== undefined) {
            fields.push(`refresh_token = $${paramCount++}`);
            values.push(refreshToken);
        }
        if (tokenExpiry !== undefined) {
            fields.push(`token_expiry = $${paramCount++}`);
            values.push(tokenExpiry);
        }
        if (resetToken !== undefined) {
            fields.push(`reset_token = $${paramCount++}`);
            values.push(resetToken);
        }
        if (resetExpiry !== undefined) {
            fields.push(`reset_expiry = $${paramCount++}`);
            values.push(resetExpiry);
        }
        
        if (fields.length === 0) {
            throw new Error('No fields to update');
        }
        
        fields.push(`updated_at = NOW()`);
        values.push(id);
        
        const query = `
            UPDATE users 
            SET ${fields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;
        
        const result = await this.connection.query(query, values);
        return result.rows[0] ? this._convertUserFromDb(result.rows[0]) : null;
    }

    // ==================== AUDIT LOGGING ====================
    
    async createAuditLog(logData) {
        const { action, userId, metadata, ipAddress } = logData;
        
        const query = `
            INSERT INTO audit_log (action, user_id, metadata, ip_address, timestamp)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        
        const result = await this.connection.query(query, [
            action, 
            userId, 
            JSON.stringify(metadata), 
            ipAddress, 
            new Date()
        ]);
        return result.rows[0];
    }

    // ==================== HEALTH CHECK ====================
    
    async healthCheck() {
        try {
            const result = await this.connection.query('SELECT 1 as health');
            return { status: 'healthy', timestamp: new Date().toISOString() };
        } catch (error) {
            return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
        }
    }

    // ==================== ORIGINAL GAME METHODS ====================
    // Preserving your existing functionality
    
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
            SELECT white_player_id, black_player_id, to_move 
            FROM game 
            WHERE id = $1
        `;
        const result = await this.connection.query(query, [gameId]);
        return result.rows[0] || null;
    }

    async createGame(gameData) {
        const { whitePlayerId, blackPlayerId, whiteClockMs, blackClockMs } = gameData;
        const query = `
            INSERT INTO game (
                white_player_id, black_player_id, white_clock_ms, black_clock_ms,
                current_fen, to_move, status, ply, version
            )
            VALUES ($1, $2, $3, $4, 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'w', 'active', 0, 1)
            RETURNING *
        `;
        
        const result = await this.connection.query(query, [
            whitePlayerId, blackPlayerId, whiteClockMs, blackClockMs
        ]);
        return result.rows[0];
    }

    async saveMove(gameId, moveResult) {
        // This maintains your original implementation with optimistic locking
        const client = await this.connection.connect();
        try {
            await client.query('BEGIN');
            
            // Update game state with optimistic locking
            const updateGame = `
                UPDATE game 
                SET current_fen = $2, to_move = $3, ply = ply + 1, 
                    version = version + 1, updated_at = NOW()
                WHERE id = $1 AND version = $4
                RETURNING *
            `;
            
            const gameResult = await client.query(updateGame, [
                gameId, moveResult.newFen, moveResult.nextPlayer, moveResult.currentVersion
            ]);
            
            if (gameResult.rows.length === 0) {
                throw new Error('OPTIMISTIC_LOCK_FAILED');
            }
            
            // Insert move record
            const insertMove = `
                INSERT INTO game_move (game_id, ply, by, uci, san, flags, prev_fen, next_fen, server_ms_spent)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;
            
            const moveDbResult = await client.query(insertMove, [
                gameId, moveResult.ply, 'human', moveResult.uci, moveResult.san,
                JSON.stringify(moveResult.flags), moveResult.prevFen, moveResult.newFen,
                moveResult.serverMsSpent
            ]);
            
            await client.query('COMMIT');
            return { game: gameResult.rows[0], move: moveDbResult.rows[0] };
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getGameMoves(gameId, limit = 100) {
        const query = `
            SELECT * FROM game_move 
            WHERE game_id = $1 
            ORDER BY ply ASC 
            LIMIT $2
        `;
        
        const result = await this.connection.query(query, [gameId, limit]);
        return result.rows;
    }

    // ==================== NEW: BYRON'S RULES ENGINE INTEGRATION ====================
    // These are NEW methods that ADD Byron's integration without removing existing functionality
    
    /**
     * Get game state formatted for Byron's rules engine
     */
    async getGameStateForRulesEngine(gameId) {
        const gameState = await this.getGameState(gameId);
        if (!gameState) return null;
        
        return RulesEngineAdapter.dbGameToBoardObject(gameState);
    }

    /**
     * Save a validated move from Byron's rules engine with optimistic locking
     */
    async saveValidatedMove(gameId, moveResult, uci, by = 'human', serverMs = 0) {
        const client = await this.connection.connect();
        
        try {
            await client.query('BEGIN');

            // Get current game state with version for optimistic locking
            const gameQuery = 'SELECT * FROM game WHERE id = $1';
            const gameResult = await client.query(gameQuery, [gameId]);
            
            if (gameResult.rows.length === 0) {
                throw new Error('GAME_NOT_FOUND');
            }

            const currentGame = gameResult.rows[0];

            // Transform move result to database formats
            const gameUpdate = RulesEngineAdapter.moveResultToDbUpdate(
                moveResult, uci, currentGame
            );
            
            const moveRecord = RulesEngineAdapter.moveResultToDbMove(
                gameId, moveResult, uci, currentGame, by
            );

            if (!gameUpdate || !moveRecord) {
                throw new Error('MOVE_TRANSFORMATION_FAILED');
            }

            // Update game state with optimistic locking
            const updateGameQuery = `
                UPDATE game 
                SET current_fen = $1, to_move = $2, status = $3, ply = $4,
                    version = $5, updated_at = NOW()
                WHERE id = $6 AND version = $7
                RETURNING *
            `;

            const updateResult = await client.query(updateGameQuery, [
                gameUpdate.current_fen,
                gameUpdate.to_move,
                gameUpdate.status,
                gameUpdate.ply,
                gameUpdate.version,
                gameId,
                currentGame.version // Optimistic lock check
            ]);

            if (updateResult.rows.length === 0) {
                throw new Error('VERSION_CONFLICT');
            }

            // Insert move record
            const insertMoveQuery = `
                INSERT INTO game_move (
                    game_id, ply, by, uci, san, flags,
                    prev_fen, next_fen, server_ms_spent
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const moveInsertResult = await client.query(insertMoveQuery, [
                moveRecord.game_id,
                moveRecord.ply,
                moveRecord.by,
                moveRecord.uci,
                moveRecord.san,
                moveRecord.flags,
                moveRecord.prev_fen,
                moveRecord.next_fen,
                serverMs
            ]);

            // Add audit log entry
            await this._addAuditLog(client, 'MOVE_MADE', null, {
                gameId: gameId,
                uci: uci,
                ply: moveRecord.ply,
                status: gameUpdate.status
            });

            await client.query('COMMIT');

            return {
                game: updateResult.rows[0],
                move: moveInsertResult.rows[0],
                moveResult: moveResult
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get move history for PGN export
     */
    async getMoveHistoryForPGN(gameId) {
        const query = `
            SELECT ply, uci, san, flags, created_at
            FROM game_move
            WHERE game_id = $1
            ORDER BY ply ASC
        `;
        
        const result = await this.connection.query(query, [gameId]);
        return result.rows;
    }

    // ==================== IDEMPOTENCY SUPPORT ====================
    // These are NEW methods for API reliability
    
    async getIdempotentResponse(key) {
        const query = 'SELECT response FROM idempotency WHERE key = $1';
        const result = await this.connection.query(query, [key]);
        
        if (result.rows[0]) {
            return JSON.parse(result.rows[0].response);
        }
        return null;
    }

    async saveIdempotentResponse(key, gameId, response) {
        const query = `
            INSERT INTO idempotency (key, game_id, response)
            VALUES ($1, $2, $3)
            ON CONFLICT (key) DO NOTHING
        `;
        
        await this.connection.query(query, [key, gameId, JSON.stringify(response)]);
    }

    // ==================== NEW: USER AUTHORIZATION HELPERS ====================
    
    /**
     * Check if user can make a move in the game
     */
    async canUserMakeMove(gameId, userId) {
        if (!userId) {
            return { canMove: false, reason: 'NOT_AUTHENTICATED' };
        }

        const participants = await this.getGameParticipants(gameId);
        if (!participants) {
            return { canMove: false, reason: 'GAME_NOT_FOUND' };
        }

        const isParticipant = participants.white_player_id === userId || 
                             participants.black_player_id === userId;
        
        if (!isParticipant) {
            return { canMove: false, reason: 'NOT_PARTICIPANT' };
        }

        // Check if it's the user's turn
        const isWhiteToMove = participants.to_move === 'w';
        const isUsersTurn = (isWhiteToMove && participants.white_player_id === userId) ||
                           (!isWhiteToMove && participants.black_player_id === userId);

        if (!isUsersTurn) {
            return { canMove: false, reason: 'NOT_YOUR_TURN' };
        }

        return { canMove: true };
    }

    // ==================== HELPER METHODS ====================
    
    /**
     * Convert database user to application format (PRESERVED from original)
     */
    _convertUserFromDb(dbUser) {
        if (!dbUser) return null;
        
        return {
            id: dbUser.id,
            username: dbUser.username,
            email: dbUser.email,
            passwordHash: dbUser.password_hash,
            rating: dbUser.rating,
            isOnline: dbUser.is_online,
            refreshToken: dbUser.refresh_token,
            tokenExpiry: dbUser.token_expiry,
            resetToken: dbUser.reset_token,
            resetExpiry: dbUser.reset_expiry,
            createdAt: dbUser.created_at,
            updatedAt: dbUser.updated_at
        };
    }

    /**
     * Add audit log entry (PRESERVED from original, enhanced for transactions)
     */
    async _addAuditLog(client, action, userId, metadata) {
        const query = `
            INSERT INTO audit_log (action, user_id, metadata, timestamp)
            VALUES ($1, $2, $3, NOW())
        `;
        
        await client.query(query, [
            action, 
            userId, 
            JSON.stringify(metadata)
        ]);
    }
}

module.exports = DatabaseService;