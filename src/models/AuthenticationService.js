/**
 * AuthenticationService Model
 * Handles user authentication and authorization
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const EmailService = require('../services/EmailService');

class AuthenticationService {
    constructor(databaseService, config = {}) {
        this.db = databaseService;
        this.config = {
            jwtSecret: config.jwtSecret || process.env.JWT_SECRET,
            jwtRefreshSecret: config.jwtRefreshSecret || process.env.JWT_REFRESH_SECRET,
            jwtExpiresIn: config.jwtExpiresIn || '15m',
            refreshTokenExpiresIn: config.refreshTokenExpiresIn || '1h',
            bcryptRounds: config.bcryptRounds || 12,
            maxLoginAttempts: config.maxLoginAttempts || 10,
            lockoutTime: config.lockoutTime || 15 * 60 * 1000, // 15 minutes
            algorithm: process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256'
        };
        
        // Track failed login attempts
        this.loginAttempts = new Map();

        // Initialize email service
        this.emailService = new EmailService();
        this._initializeEmailService();
    }

    /**
     * Initialize email service
     */
    async _initializeEmailService() {
        try {
            await this.emailService.initialize();
        } catch (error) {
            console.log('⚠️  Email service initialization failed:', error.message);
        }
    }

    /**
     * Register a new user
     * @param {Object} userData - User data including email, password, username
     * @returns {Promise<Object>} - Success status and user info
     */
    async registerUser(userData) {
    try {
        const { email, password, username } = userData;
        
        // Input validation
        if (!this._validateEmail(email)) {
            throw new Error('INVALID_EMAIL');
        }
        
        if (!this._validatePassword(password)) {
            throw new Error('WEAK_PASSWORD');
        }

        if (!this._validateUsername(username)) {
            throw new Error('INVALID_USERNAME');
        }

        // Check if email already exists
        const existingUserByEmail = await this.db.findUserByEmail(email);
        if (existingUserByEmail) {
            throw new Error('EMAIL_EXISTS');
        }

        // Check if username already exists
        const existingUserByUsername = await this.db.findUserByUsername(username);
        if (existingUserByUsername) {
            throw new Error('USERNAME_EXISTS');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, this.config.bcryptRounds);
        
        // Create user
        const user = await this.db.createUser({
            username,
            email,
            passwordHash,
            isOnline: false,
            rating: 1200, // Default rating
            createdAt: new Date()
        });

        // Create audit log
        await this.db.createAuditLog({
            action: 'USER_REGISTERED',
            userId: user.id,
            metadata: { email, username },
            timestamp: new Date()
        });

        return {
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                rating: user.rating
            }
        };

    } catch (error) {
        await this.db.createAuditLog({
            action: 'REGISTRATION_FAILED',
            metadata: { email: userData.email, username: userData.username, error: error.message },
            timestamp: new Date()
        });
        throw error;
    }
}
// Generate a simple 6-digit reset code
    generateResetCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Store for in-memory demo (use database in production)
    resetCodes = new Map(); // email -> { code, token, expiry }

    // Verify reset code and return validated token
    async verifyResetCode(email, code, token) {
        try {
            // Check if code exists and matches
            const storedData = this.resetCodes.get(email);
            if (!storedData) {
                return {
                    success: false,
                    message: 'No reset code found for this email'
                };
            }

            // Check if code matches
            if (storedData.code !== code) {
                return {
                    success: false,
                    message: 'Invalid verification code'
                };
            }

            // Check if code expired (10 minutes)
            if (Date.now() > storedData.expiry) {
                this.resetCodes.delete(email);
                return {
                    success: false,
                    message: 'Verification code has expired'
                };
            }

            // Check if token matches
            if (storedData.token !== token) {
                return {
                    success: false,
                    message: 'Invalid reset token'
                };
            }

            return {
                success: true,
                message: 'Code verified successfully',
                resetToken: token
            };

        } catch (error) {
            console.error('Reset code verification error:', error);
            throw error;
        }
    }

    // Complete password reset
    async resetPassword(email, newPassword, resetToken) {
        try {
            // Validate new password
            if (!this._validatePassword(newPassword)) {
                return {
                    success: false,
                    message: 'Password must be at least 8 characters with uppercase, lowercase, and number'
                };
            }

            // Find user
            const user = await this.db.findUserByEmail(email);
            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            // Verify reset token is still valid in database
            if (user.resetToken !== resetToken) {
                return {
                    success: false,
                    message: 'Invalid or expired reset token'
                };
            }

            // Check token expiry
            if (!user.resetExpiry || Date.now() > user.resetExpiry.getTime()) {
                return {
                    success: false,
                    message: 'Reset token has expired'
                };
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 12);

            // Update user password and clear reset token
            await this.db.updateUser(user.id, {
                passwordHash: hashedPassword,
                resetToken: null,
                resetExpiry: null
            });

            // Clear stored reset code
            this.resetCodes.delete(email);

            // Log successful password reset
            await this.db.createAuditLog({
                action: 'PASSWORD_RESET_COMPLETED',
                userId: user.id,
                metadata: { email },
                timestamp: new Date()
            });

            return {
                success: true,
                message: 'Password reset successfully'
            };

        } catch (error) {
            console.error('Password reset error:', error);
            throw error;
        }
    }

    // Send password reset email with OTP code
    async sendPasswordReset(email) {
        try {
            const user = await this.db.findUserByEmail(email);
            if (!user) {
                // Don't reveal if email exists for security
                return {
                    success: true,
                    message: 'If email exists, reset code sent'
                };
            }

            // Generate reset token and code
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetCode = this.generateResetCode();
            const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            // Store in database
            await this.db.updateUser(user.id, {
                resetToken: resetToken,
                resetExpiry: resetExpiry
            });

            // Store code temporarily (10 minutes for OTP code)
            this.resetCodes.set(email, {
                code: resetCode,
                token: resetToken,
                expiry: Date.now() + 10 * 60 * 1000 // 10 minutes for code
            });

            await this.db.createAuditLog({
                action: 'PASSWORD_RESET_REQUESTED',
                userId: user.id,
                metadata: { email },
                timestamp: new Date()
            });

            // Send email with reset code
            try {
                await this.emailService.sendPasswordResetCode(email, resetCode, user.username);
                console.log(`✅ Password reset code sent to ${email}`);
            } catch (emailError) {
                console.error('Email sending failed, showing code in console:', emailError.message);
                console.log(`🔑 Demo: Reset code for ${email}: ${resetCode}`);
            }

            return {
                success: true,
                message: 'Reset code sent to your email',
                resetToken // Remove in production - only for demo
            };

        } catch (error) {
            console.error('Send password reset error:', error);
            throw error;
        }
    }

    _validateUsername(username) {
        // Username rules: 3-20 chars, alphanumeric + underscore, no spaces
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        return usernameRegex.test(username);
    }
    /**
     * Login user and issue JWT tokens
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} ipAddress - Client IP for security logging
     * @returns {Promise<Object>} - Tokens and user info
     */
    async loginUser(email, password, ipAddress = null) {
        try {
            // Check rate limiting
            if (this._isRateLimited(email)) {
                throw new Error('TOO_MANY_ATTEMPTS');
            }

            // Find user
            const user = await this.db.findUserByEmail(email);
            if (!user) {
                this._recordFailedAttempt(email);
                throw new Error('INVALID_CREDENTIALS');
            }

            // Verify password
            const isValid = await bcrypt.compare(password, user.passwordHash);
            if (!isValid) {
                this._recordFailedAttempt(email);
                throw new Error('INVALID_CREDENTIALS');
            }

            // Clear failed attempts on successful login
            this.loginAttempts.delete(email);

            // Generate tokens
            const { accessToken, refreshToken } = await this._generateTokens(user);

            // Update user status
            await this.db.updateUser(user.id, { 
                isOnline: true,
                refreshToken: refreshToken,
                tokenExpiry: new Date(Date.now() + this._parseTimeToMs(this.config.refreshTokenExpiresIn))
            });

            // Create audit log
            await this.db.createAuditLog({
                action: 'USER_LOGIN',
                userId: user.id,
                metadata: { email, ipAddress },
                timestamp: new Date()
            });

            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    rating: user.rating
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: this.config.jwtExpiresIn
                }
            };

        } catch (error) {
            await this.db.createAuditLog({
                action: 'LOGIN_FAILED',
                metadata: { email, error: error.message, ipAddress },
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Logout user and invalidate tokens
     * @param {Object} user - User object from token
     * @returns {Promise<Object>} - Success status
     */
    async logoutUser(user) {
        try {
            await this.db.updateUser(user.id, { 
                isOnline: false,
                refreshToken: null,
                tokenExpiry: null
            });

            await this.db.createAuditLog({
                action: 'USER_LOGOUT',
                userId: user.id,
                timestamp: new Date()
            });

            return { success: true };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     * @param {string} refreshToken - Valid refresh token
     * @returns {Promise<Object>} - New access token
     */
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, this.config.jwtRefreshSecret);
            
            // Find user and verify refresh token matches
            const user = await this.db.findUserById(decoded.sub);
            if (!user || user.refreshToken !== refreshToken) {
                throw new Error('INVALID_REFRESH_TOKEN');
            }

            // Check if refresh token is expired
            if (user.tokenExpiry && new Date() > user.tokenExpiry) {
                throw new Error('REFRESH_TOKEN_EXPIRED');
            }

            // Generate new access token
            const accessToken = this._signJWT({
                sub: user.id,
                name: user.username,
                roles: ['player'], // Default role
                seat: null // Will be set when joining a game
            }, this.config.jwtExpiresIn);

            return {
                success: true,
                accessToken,
                expiresIn: this.config.jwtExpiresIn
            };

        } catch (error) {
            await this.db.createAuditLog({
                action: 'TOKEN_REFRESH_FAILED',
                metadata: { error: error.message },
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Validate JWT token
     * @param {string} token - JWT token to validate
     * @returns {Promise<Object>} - Decoded token payload
     */
    async validateToken(token) {
        try {
            const decoded = jwt.verify(token, this.config.jwtSecret);
            
            // Verify user still exists and is active
            const user = await this.db.findUserById(decoded.sub);
            if (!user) {
                throw new Error('USER_NOT_FOUND');
            }

            return {
                valid: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    rating: user.rating,
                    roles: decoded.roles || ['player'],
                    seat: decoded.seat
                }
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Issue new JWT token (for seat assignment, etc.)
     * @param {Object} user - User object
     * @param {Object} additionalClaims - Additional claims to include
     * @returns {string} - New JWT token
     */
    issueJWT(user, additionalClaims = {}) {
        const payload = {
            sub: user.id,
            name: user.username,
            roles: ['player'],
            ...additionalClaims
        };

        return this._signJWT(payload, this.config.jwtExpiresIn);
    }


    /**
     * Authorize user for specific action/resource
     * @param {Object} user - User object from validated token
     * @param {string} resource - Resource being accessed
     * @param {string} action - Action being performed
     * @returns {boolean} - Authorization result
     */
    authorize(user, resource, action) {
        // RBAC implementation
        const userRoles = user.roles || ['player'];
        
        // Define role permissions
        const permissions = {
            'admin': ['*'], // Admin can do everything
            'player': ['game:join', 'game:move', 'game:view', 'profile:update'],
            'spectator': ['game:view']
        };

        // Check if user has required permission
        for (const role of userRoles) {
            const rolePermissions = permissions[role] || [];
            if (rolePermissions.includes('*') || rolePermissions.includes(`${resource}:${action}`)) {
                return true;
            }
        }

        // Log unauthorized access attempt
        this.db.createAuditLog({
            action: 'UNAUTHORIZED_ACCESS',
            userId: user.id,
            metadata: { resource, action, userRoles },
            timestamp: new Date()
        });

        return false;
    }

    // Private helper methods
    _generateTokens(user) {
        const accessToken = this._signJWT({
            sub: user.id,
            name: user.username,
            roles: ['player'],
            seat: null
        }, this.config.jwtExpiresIn);

        const refreshToken = jwt.sign(
            { sub: user.id, type: 'refresh' },
            this.config.jwtRefreshSecret,
            { expiresIn: this.config.refreshTokenExpiresIn }
        );

        return { accessToken, refreshToken };
    }

    _signJWT(payload, expiresIn) {
        const options = {
            issuer: 'losalamos-server',
            expiresIn: expiresIn,
            algorithm: this.config.algorithm
        };

        return jwt.sign(payload, this.config.jwtSecret, options);
    }

    _validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    _validatePassword(password) {
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }

    _isRateLimited(email) {
        const attempts = this.loginAttempts.get(email);
        if (!attempts) return false;

        const now = Date.now();
        if (attempts.count >= this.config.maxLoginAttempts) {
            if (now - attempts.lastAttempt < this.config.lockoutTime) {
                return true;
            } else {
                // Reset attempts after lockout period
                this.loginAttempts.delete(email);
                return false;
            }
        }
        return false;
    }

    _recordFailedAttempt(email) {
        const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
        attempts.count++;
        attempts.lastAttempt = Date.now();
        this.loginAttempts.set(email, attempts);
    }

    _parseTimeToMs(timeString) {
        const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
        const match = timeString.match(/^(\d+)([smhd])$/);
        if (!match) return 900000; // Default 15 minutes
        return parseInt(match[1]) * units[match[2]];
    }
}

module.exports = AuthenticationService;