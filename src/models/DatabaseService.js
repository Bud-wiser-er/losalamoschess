const db = require('../../database/connection');
const bcrypt = require('bcrypt');

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
            username, 
            email, 
            hashedPassword, 
            rating,
            isOnline
        ]);
        
        return this._convertUserFromDb(result.rows[0]);
    }

    async updateUser(id, updates) {
        // Convert AuthenticationService field names to database field names
        const dbUpdates = this._convertUserToDb(updates);
        
        const allowedFields = [
            'username', 'email', 'rating', 'is_online', 
            'refresh_token', 'token_expiry', 'reset_token', 'reset_expiry'
        ];
        
        const updateFields = [];
        const values = [];
        let paramCount = 1;

        for (const [field, value] of Object.entries(dbUpdates)) {
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
            RETURNING *
        `;

        const result = await this.connection.query(query, values);
        
        if (result.rows[0]) {
            return this._convertUserFromDb(result.rows[0]);
        }
        return null;
    }

    // ==================== AUDIT LOGGING ====================
    // Required by Elizabeth's AuthenticationService
    
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

    // ==================== GAME METHODS ====================
    // These support the GameRepository
    
    async getGameState(gameId) {
        const query = 'SELECT * FROM game WHERE id = $1';
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

    async createGame(gameData) {
        const { whitePlayerId, blackPlayerId, whiteClockMs, blackClockMs } = gameData;
        const query = `
            INSERT INTO game (
                white_player_id, black_player_id, white_clock_ms, black_clock_ms,
                current_fen, to_move, status, ply, version
            )
            VALUES ($1, $2, $3, $4, 'rnqkbnr/ppppppp/7/7/7/PPPPPPP/RNQKBNR w - - 0 1', 'w', 'active', 0, 1)
            RETURNING *
        `;
        
        const result = await this.connection.query(query, [
            whitePlayerId, blackPlayerId, whiteClockMs, blackClockMs
        ]);
        return result.rows[0];
    }

    async saveMove(gameId, moveResult) {
        // This will integrate with Byron's rules engine
        // For now, basic implementation with optimistic locking
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
            ORDER BY ply DESC 
            LIMIT $2
        `;
        const result = await this.connection.query(query, [gameId, limit]);
        return result.rows;
    }

    // ==================== FIELD CONVERSION HELPERS ====================
    // These convert between database snake_case and AuthenticationService camelCase
    
    _convertUserFromDb(dbUser) {
        if (!dbUser) return null;
        
        return {
            id: dbUser.id,
            username: dbUser.username,
            email: dbUser.email,
            passwordHash: dbUser.password_hash,  // Convert to camelCase
            rating: dbUser.rating,
            isOnline: dbUser.is_online,          // Convert to camelCase
            refreshToken: dbUser.refresh_token,  // Convert to camelCase
            tokenExpiry: dbUser.token_expiry,    // Convert to camelCase
            resetToken: dbUser.reset_token,      // Convert to camelCase
            resetExpiry: dbUser.reset_expiry,    // Convert to camelCase
            createdAt: dbUser.created_at,        // Convert to camelCase
            updatedAt: dbUser.updated_at         // Convert to camelCase
        };
    }
    
    _convertUserToDb(userUpdates) {
        const dbUpdates = {};
        
        // Map AuthenticationService field names to database field names
        const fieldMap = {
            'isOnline': 'is_online',
            'refreshToken': 'refresh_token', 
            'tokenExpiry': 'token_expiry',
            'resetToken': 'reset_token',
            'resetExpiry': 'reset_expiry'
        };
        
        for (const [key, value] of Object.entries(userUpdates)) {
            if (fieldMap[key]) {
                dbUpdates[fieldMap[key]] = value;
            } else {
                // Fields that don't need conversion (username, email, rating)
                dbUpdates[key] = value;
            }
        }
        
        return dbUpdates;
    }
}

module.exports = DatabaseService;