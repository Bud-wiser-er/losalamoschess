// auth-routes.js
const express = require('express');
const router = express.Router();
const { 
    authenticateToken, 
    authorizeAction, 
    createAuthRateLimit, 
    sanitizeInput 
} = require('./auth-middleware');

/**
 * Authentication routes for the Los Alamos Chess platform
 * These routes integrate with Nastasha's frontend, Arno's database, and Ethan's WebSocket
 */
function createAuthRoutes(authService) {
    
    // Apply rate limiting to all auth routes
    router.use(createAuthRateLimit());
    router.use(sanitizeInput);

    /**
     * POST /auth/register
     * Register a new user account
     */
    router.post('/register', async (req, res) => {
        try {
            const { username, email, password } = req.body;

            // Validate required fields
            if (!username || !email || !password) {
                return res.status(400).json({
                    error: 'MISSING_FIELDS',
                    message: 'Username, email, and password are required'
                });
            }

            const result = await authService.registerUser({
                username,
                email,
                password
            });

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: result.user
            });

        } catch (error) {
            const statusCode = getErrorStatusCode(error.message);
            res.status(statusCode).json({
                error: error.message,
                message: getErrorMessage(error.message)
            });
        }
    });

    /**
     * POST /auth/login
     * Authenticate user and return JWT tokens
     */
    router.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: 'MISSING_CREDENTIALS',
                    message: 'Email and password are required'
                });
            }

            const result = await authService.loginUser(
                email, 
                password, 
                req.ip || req.connection.remoteAddress
            );

            // Set secure HTTP-only cookie for refresh token in production
            if (process.env.NODE_ENV === 'production') {
                res.cookie('refreshToken', result.tokens.refreshToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'strict',
                    maxAge: 60 * 60 * 1000 // 1 hour
                });
            }

            res.json({
                success: true,
                message: 'Login successful',
                user: result.user,
                accessToken: result.tokens.accessToken,
                expiresIn: result.tokens.expiresIn,
                // Include refresh token in response for development
                ...(process.env.NODE_ENV !== 'production' && { 
                    refreshToken: result.tokens.refreshToken 
                })
            });

        } catch (error) {
            const statusCode = getErrorStatusCode(error.message);
            res.status(statusCode).json({
                error: error.message,
                message: getErrorMessage(error.message)
            });
        }
    });

    /**
     * POST /auth/refresh
     * Refresh access token using refresh token
     */
    router.post('/refresh', async (req, res) => {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

            if (!refreshToken) {
                return res.status(401).json({
                    error: 'MISSING_REFRESH_TOKEN',
                    message: 'Refresh token is required'
                });
            }

            const result = await authService.refreshToken(refreshToken);

            res.json({
                success: true,
                accessToken: result.accessToken,
                expiresIn: result.expiresIn
            });

        } catch (error) {
            const statusCode = getErrorStatusCode(error.message);
            res.status(statusCode).json({
                error: error.message,
                message: getErrorMessage(error.message)
            });
        }
    });

    /**
     * POST /auth/logout
     * Logout user and invalidate tokens
     */
    router.post('/logout', authenticateToken(authService), async (req, res) => {
        try {
            await authService.logoutUser(req.user);

            // Clear refresh token cookie
            res.clearCookie('refreshToken');

            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            res.status(500).json({
                error: 'LOGOUT_ERROR',
                message: 'Failed to logout user'
            });
        }
    });

    /**
     * POST /auth/password-reset
     * Request password reset
     */
    // POST /auth/password-reset
    // Request password reset - sends code to email
    router.post('/password-reset', async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    error: 'MISSING_EMAIL',
                    message: 'Email is required'
                });
            }

            const result = await authService.sendPasswordReset(email);

            res.json(result);

        } catch (error) {
            console.error('Password reset error:', error);
            res.status(500).json({
                error: 'PASSWORD_RESET_ERROR',
                message: 'Failed to process password reset request'
            });
        }
    });

    // POST /auth/verify-reset-code
    // Verify the reset code sent to email
    router.post('/verify-reset-code', async (req, res) => {
        try {
            const { email, code, token } = req.body;

            if (!email || !code || !token) {
                return res.status(400).json({
                    error: 'MISSING_PARAMETERS',
                    message: 'Email, code, and token are required'
                });
            }

            const result = await authService.verifyResetCode(email, code, token);

            if (result.success) {
                res.json(result);
            } else {
                res.status(400).json(result);
            }

        } catch (error) {
            console.error('Reset code verification error:', error);
            res.status(500).json({
                error: 'VERIFICATION_ERROR',
                message: 'Failed to verify reset code'
            });
        }
    });

    // POST /auth/reset-password
    // Complete the password reset
    router.post('/reset-password', async (req, res) => {
        try {
            const { email, newPassword, resetToken } = req.body;

            if (!email || !newPassword || !resetToken) {
                return res.status(400).json({
                    error: 'MISSING_PARAMETERS',
                    message: 'Email, new password, and reset token are required'
                });
            }

            const result = await authService.resetPassword(email, newPassword, resetToken);

            if (result.success) {
                res.json(result);
            } else {
                res.status(400).json(result);
            }

        } catch (error) {
            console.error('Password reset completion error:', error);
            res.status(500).json({
                error: 'RESET_ERROR',
                message: 'Failed to reset password'
            });
        }
    });
    
    /**
     * GET /auth/me
     * Get current user profile (for frontend to verify auth status)
     */
    router.get('/me', authenticateToken(authService), async (req, res) => {
        res.json({
            success: true,
            user: req.user
        });
    });

    /**
     * POST /auth/validate
     * Validate a token (used by other services)
     */
    router.post('/validate', async (req, res) => {
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({
                    error: 'MISSING_TOKEN',
                    message: 'Token is required'
                });
            }

            const validation = await authService.validateToken(token);

            if (validation.valid) {
                res.json({
                    valid: true,
                    user: validation.user
                });
            } else {
                res.status(401).json({
                    valid: false,
                    error: validation.error
                });
            }

        } catch (error) {
            res.status(500).json({
                valid: false,
                error: 'VALIDATION_ERROR'
            });
        }
    });

    /**
     * Helper function to map error codes to HTTP status codes
     */
    function getErrorStatusCode(errorCode) {
        const statusMap = {
            'INVALID_EMAIL': 400,
            'WEAK_PASSWORD': 400,
            'EMAIL_EXISTS': 409,
            'INVALID_CREDENTIALS': 401,
            'TOO_MANY_ATTEMPTS': 429,
            'INVALID_REFRESH_TOKEN': 401,
            'REFRESH_TOKEN_EXPIRED': 401,
            'USER_NOT_FOUND': 404
        };
        return statusMap[errorCode] || 500;
    }

    /**
     * Helper function to provide user-friendly error messages
     */
    function getErrorMessage(errorCode) {
        const messageMap = {
            'INVALID_EMAIL': 'Please provide a valid email address',
            'WEAK_PASSWORD': 'Password must be at least 8 characters with uppercase, lowercase, and number',
            'EMAIL_EXISTS': 'An account with this email already exists',
            'INVALID_CREDENTIALS': 'Invalid email or password',
            'TOO_MANY_ATTEMPTS': 'Too many failed login attempts. Please try again in 15 minutes',
            'INVALID_REFRESH_TOKEN': 'Invalid refresh token. Please login again',
            'REFRESH_TOKEN_EXPIRED': 'Session expired. Please login again',
            'USER_NOT_FOUND': 'User account not found'
        };
        return messageMap[errorCode] || 'An unexpected error occurred';
    }

    return router;
}

module.exports = createAuthRoutes;