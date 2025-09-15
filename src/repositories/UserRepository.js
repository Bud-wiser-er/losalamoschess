const BaseRepository = require('./BaseRepository');
const bcrypt = require('bcrypt');

class UserRepository extends BaseRepository {
    constructor(databaseService) {
        super(databaseService);
    }

    /**
     * Find user by email
     */
    async findByEmail(email) {
        return await this.db.findUserByEmail(email);
    }

    /**
     * Find user by username
     */
    async findByUsername(username) {
        return await this.db.findUserByUsername(username);
    }

    /**
     * Create a new user with hashed password
     */
    async create(userData) {
        const { username, email, password, rating = 1200 } = userData;
        
        // Check for existing email or username
        const existingEmail = await this.findByEmail(email);
        if (existingEmail) {
            throw new Error('EMAIL_EXISTS');
        }

        const existingUsername = await this.findByUsername(username);
        if (existingUsername) {
            throw new Error('USERNAME_EXISTS');
        }

        return await this.db.createUser({ username, email, password, rating });
    }

    /**
     * Authenticate user with email and password
     */
    async authenticate(email, password) {
        const user = await this.findByEmail(email);
        if (!user) {
            return null;
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return null;
        }

        // Don't return password hash
        const { password_hash, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    /**
     * Update user profile
     */
    async updateProfile(userId, updates) {
        // Filter out sensitive fields that shouldn't be updated through this method
        const allowedUpdates = {};
        const allowedFields = ['username', 'email', 'rating'];
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                allowedUpdates[field] = updates[field];
            }
        }

        if (Object.keys(allowedUpdates).length === 0) {
            throw new Error('No valid fields to update');
        }

        // Check for username/email uniqueness if being updated
        if (allowedUpdates.username) {
            const existing = await this.findByUsername(allowedUpdates.username);
            if (existing && existing.id !== userId) {
                throw new Error('USERNAME_EXISTS');
            }
        }

        if (allowedUpdates.email) {
            const existing = await this.findByEmail(allowedUpdates.email);
            if (existing && existing.id !== userId) {
                throw new Error('EMAIL_EXISTS');
            }
        }

        return await this.db.updateUser(userId, allowedUpdates);
    }

    /**
     * Update user's online status
     */
    async setOnlineStatus(userId, isOnline) {
        return await this.db.updateUser(userId, { is_online: isOnline });
    }

    /**
     * Store refresh token
     */
    async updateRefreshToken(userId, refreshToken, expiresAt) {
        return await this.db.updateUser(userId, {
            refresh_token: refreshToken,
            token_expiry: expiresAt
        });
    }

    /**
     * Clear refresh token (logout)
     */
    async clearRefreshToken(userId) {
        return await this.db.updateUser(userId, {
            refresh_token: null,
            token_expiry: null
        });
    }

    /**
     * Set password reset token
     */
    async setPasswordResetToken(userId, resetToken, expiresAt) {
        return await this.db.updateUser(userId, {
            reset_token: resetToken,
            reset_expiry: expiresAt
        });
    }

    /**
     * Update password using reset token
     */
    async updatePasswordWithResetToken(resetToken, newPassword) {
        const user = await this.query(
            'SELECT id FROM users WHERE reset_token = $1 AND reset_expiry > NOW()',
            [resetToken]
        );

        if (user.rows.length === 0) {
            throw new Error('INVALID_RESET_TOKEN');
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        
        return await this.db.updateUser(user.rows[0].id, {
            password_hash: passwordHash,
            reset_token: null,
            reset_expiry: null
        });
    }

    /**
     * Get user's game history
     */
    async getGameHistory(userId, limit = 10, offset = 0) {
        const query = `
            SELECT g.id, g.status, g.created_at, g.updated_at, g.winner_id,
                   CASE WHEN g.white_player_id = $1 THEN 'white' ELSE 'black' END as user_color,
                   wu.username as white_username,
                   bu.username as black_username,
                   CASE 
                       WHEN g.winner_id = $1 THEN 'win'
                       WHEN g.winner_id IS NULL THEN 'draw'
                       ELSE 'loss'
                   END as result
            FROM game g
            LEFT JOIN users wu ON g.white_player_id = wu.id
            LEFT JOIN users bu ON g.black_player_id = bu.id
            WHERE g.white_player_id = $1 OR g.black_player_id = $1
            ORDER BY g.updated_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await this.query(query, [userId, limit, offset]);
        return result.rows;
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId) {
        const query = `
            SELECT 
                COUNT(*) as total_games,
                COUNT(*) FILTER (WHERE winner_id = $1) as wins,
                COUNT(*) FILTER (WHERE winner_id IS NULL AND status != 'active') as draws,
                COUNT(*) FILTER (WHERE winner_id IS NOT NULL AND winner_id != $1) as losses
            FROM game
            WHERE (white_player_id = $1 OR black_player_id = $1) 
            AND status != 'active'
        `;

        const result = await this.query(query, [userId]);
        const stats = result.rows[0];
        
        return {
            totalGames: parseInt(stats.total_games),
            wins: parseInt(stats.wins),
            draws: parseInt(stats.draws),
            losses: parseInt(stats.losses),
            winRate: stats.total_games > 0 ? (stats.wins / stats.total_games * 100).toFixed(1) : 0
        };
    }

    /**
     * Search users by username (for friend requests)
     */
    async searchByUsername(searchTerm, limit = 10, excludeUserId = null) {
        let query = `
            SELECT id, username, email, rating, is_online
            FROM users 
            WHERE username ILIKE $1
        `;
        const params = [`%${searchTerm}%`];

        if (excludeUserId) {
            query += ` AND id != $2`;
            params.push(excludeUserId);
        }

        query += ` ORDER BY username LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Get online users
     */
    async getOnlineUsers(limit = 50) {
        const query = `
            SELECT id, username, rating, updated_at
            FROM users 
            WHERE is_online = true
            ORDER BY updated_at DESC
            LIMIT $1
        `;

        const result = await this.query(query, [limit]);
        return result.rows;
    }

    /**
     * Update user rating after game
     */
    async updateRating(userId, newRating) {
        return await this.db.updateUser(userId, { rating: Math.round(newRating) });
    }
}

module.exports = UserRepository;