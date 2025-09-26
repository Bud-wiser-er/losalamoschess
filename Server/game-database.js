/**
 * GAME DATABASE INTEGRATION MODULE
 * 
 * Purpose: Handle database operations for chess game moves, user data, and game state
 * Integrates: PostgreSQL database, game moves, user authentication, move history
 * 
 * Input: Game moves, user actions, timer updates
 * Output: Updated database records, move validation, user data retrieval
 * 
 * File Location: /Server/game-database.js
 */

const { Pool } = require('pg');
const crypto = require('crypto');

class GameDatabaseManager {
    constructor(config) {
        this.pool = new Pool({
            user: config.DB_USER || 'postgres',
            host: config.DB_HOST || 'localhost',
            database: config.DB_NAME || 'losalamoschess',
            password: config.DB_PASSWORD || 'password',
            port: config.DB_PORT || 5432,
        });
        
        this.pool.on('error', (err) => {
            console.error('Database connection error:', err);
        });
    }

    /**
     * Create a new game in the database
     * @param {string} whitePlayerId - White player UUID
     * @param {string} blackPlayerId - Black player UUID (null for AI)
     * @param {number} timeControlMs - Time control in milliseconds
     * @returns {Object} Game creation result
     */
    async createGame(whitePlayerId, blackPlayerId = null, timeControlMs = 900000) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const gameId = crypto.randomUUID();
            const initialFen = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1'; // Los Alamos initial position
            
            const gameResult = await client.query(`
                INSERT INTO game (
                    id, fen, status, white_player_id, black_player_id, 
                    white_clock_ms, black_clock_ms, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                RETURNING *
            `, [gameId, initialFen, 'ACTIVE', whitePlayerId, blackPlayerId, timeControlMs, timeControlMs]);
            
            await client.query('COMMIT');
            
            console.log(`🎮 New game created: ${gameId}`);
            return {
                success: true,
                gameId: gameId,
                game: gameResult.rows[0]
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error creating game:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get game by ID with player information
     * @param {string} gameId - Game UUID
     * @returns {Object} Game data with players
     */
    async getGame(gameId) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT 
                    g.*,
                    wp.username as white_username,
                    wp.rating as white_rating,
                    bp.username as black_username,
                    bp.rating as black_rating
                FROM game g
                LEFT JOIN users wp ON g.white_player_id = wp.id
                LEFT JOIN users bp ON g.black_player_id = bp.id
                WHERE g.id = $1
            `, [gameId]);
            
            if (result.rows.length === 0) {
                return { success: false, error: 'Game not found' };
            }
            
            return {
                success: true,
                game: result.rows[0]
            };
            
        } catch (error) {
            console.error('❌ Error getting game:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Add a move to the database
     * @param {string} gameId - Game UUID
     * @param {number} ply - Move number (starts at 1)
     * @param {string} by - 'human' or 'bot'
     * @param {string} uci - UCI notation (e.g., 'e2e4')
     * @param {string} san - Standard Algebraic Notation (e.g., 'e4')
     * @param {Object} flags - Move flags (check, mate, capture, etc.)
     * @param {string} prevFen - FEN before move
     * @param {string} nextFen - FEN after move
     * @param {number} timeSpentMs - Time spent on move
     * @returns {Object} Move addition result
     */
    async addMove(gameId, ply, by, uci, san, flags = {}, prevFen, nextFen, timeSpentMs = 0) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Add the move
            await client.query(`
                INSERT INTO game_move (
                    game_id, ply, by, uci, san, flags, 
                    prev_fen, next_fen, server_ms_spent, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            `, [gameId, ply, by, uci, san, JSON.stringify(flags), prevFen, nextFen, timeSpentMs]);
            
            // Update game FEN and increment version
            await client.query(`
                UPDATE game 
                SET fen = $1, version = version + 1, updated_at = NOW()
                WHERE id = $2
            `, [nextFen, gameId]);
            
            await client.query('COMMIT');
            
            console.log(`📝 Move added: ${gameId} - ${ply}. ${san}`);
            return { success: true };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error adding move:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get move history for a game
     * @param {string} gameId - Game UUID
     * @returns {Object} Move history result
     */
    async getMoveHistory(gameId) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT * FROM game_move 
                WHERE game_id = $1 
                ORDER BY ply ASC
            `, [gameId]);
            
            return {
                success: true,
                moves: result.rows
            };
            
        } catch (error) {
            console.error('❌ Error getting move history:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Update game timers
     * @param {string} gameId - Game UUID
     * @param {number} whiteTimeMs - White player time remaining
     * @param {number} blackTimeMs - Black player time remaining
     * @returns {Object} Update result
     */
    async updateGameTimers(gameId, whiteTimeMs, blackTimeMs) {
        const client = await this.pool.connect();
        
        try {
            await client.query(`
                UPDATE game 
                SET white_clock_ms = $1, black_clock_ms = $2, updated_at = NOW()
                WHERE id = $3
            `, [whiteTimeMs, blackTimeMs, gameId]);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error updating timers:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * End a game and set winner
     * @param {string} gameId - Game UUID
     * @param {string} status - Final game status
     * @param {string} winnerId - Winner UUID (optional)
     * @returns {Object} End game result
     */
    async endGame(gameId, status, winnerId = null) {
        const client = await this.pool.connect();
        
        try {
            await client.query(`
                UPDATE game 
                SET status = $1, winner_id = $2, updated_at = NOW()
                WHERE id = $3
            `, [status, winnerId, gameId]);
            
            console.log(`🏁 Game ended: ${gameId} - Status: ${status}`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error ending game:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get user profile by ID
     * @param {string} userId - User UUID
     * @returns {Object} User profile result
     */
    async getUserProfile(userId) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT id, username, email, rating, games_played, games_won, created_at
                FROM users 
                WHERE id = $1
            `, [userId]);
            
            if (result.rows.length === 0) {
                return { success: false, error: 'User not found' };
            }
            
            return {
                success: true,
                user: result.rows[0]
            };
            
        } catch (error) {
            console.error('❌ Error getting user profile:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get user by username (for login)
     * @param {string} username - Username
     * @returns {Object} User result
     */
    async getUserByUsername(username) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT * FROM users WHERE username = $1
            `, [username]);
            
            if (result.rows.length === 0) {
                return { success: false, error: 'User not found' };
            }
            
            return {
                success: true,
                user: result.rows[0]
            };
            
        } catch (error) {
            console.error('❌ Error getting user by username:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Update user rating after game
     * @param {string} userId - User UUID
     * @param {number} newRating - New rating
     * @param {boolean} won - Whether user won the game
     * @returns {Object} Update result
     */
    async updateUserRating(userId, newRating, won) {
        const client = await this.pool.connect();
        
        try {
            await client.query(`
                UPDATE users 
                SET rating = $1, 
                    games_played = games_played + 1,
                    games_won = games_won + $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [newRating, won ? 1 : 0, userId]);
            
            console.log(`📊 Rating updated: ${userId} - New rating: ${newRating}`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error updating user rating:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Log security audit event
     * @param {string} action - Action performed
     * @param {string} userId - User UUID (optional)
     * @param {Object} metadata - Additional data
     * @param {string} ipAddress - IP address
     * @returns {Object} Log result
     */
    async logAuditEvent(action, userId = null, metadata = {}, ipAddress = null) {
        const client = await this.pool.connect();
        
        try {
            await client.query(`
                INSERT INTO audit_log (action, user_id, metadata, ip_address, timestamp)
                VALUES ($1, $2, $3, $4, NOW())
            `, [action, userId, JSON.stringify(metadata), ipAddress]);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error logging audit event:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Close database connection pool
     */
    async close() {
        await this.pool.end();
        console.log('🔒 Database connection pool closed');
    }
}

module.exports = GameDatabaseManager;