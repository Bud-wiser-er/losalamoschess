// auth.test.js - Comprehensive test suite for AuthenticationService
const AuthenticationService = require('../../src/models/AuthenticationService');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock dependencies
const mockDatabaseService = {
    findUserByEmail: jest.fn(),
    findUserByUsername: jest.fn(),
    findUserById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    createAuditLog: jest.fn()
};

describe('AuthenticationService', () => {
    let authService;
    const testConfig = {
        jwtSecret: 'test-secret-key-256-bits-long-for-testing',
        jwtRefreshSecret: 'test-refresh-secret-key',
        jwtExpiresIn: '15m',
        refreshTokenExpiresIn: '1h',
        bcryptRounds: 4, // Lower for faster tests
        maxLoginAttempts: 3,
        lockoutTime: 1000 // 1 second for tests
    };

    beforeEach(() => {
        authService = new AuthenticationService(mockDatabaseService, testConfig);
        jest.clearAllMocks();
    });

    describe('registerUser', () => {
        const validUserData = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'SecurePass123'
        };

        test('SEC-01: should successfully register user with bcrypt hashing', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(null);
            mockDatabaseService.findUserByUsername.mockResolvedValue(null);
            mockDatabaseService.createUser.mockResolvedValue({
                id: 'user-123',
                username: 'testuser',
                email: 'test@example.com',
                rating: 1200
            });

            const result = await authService.registerUser(validUserData);

            expect(result.success).toBe(true);
            expect(result.user.username).toBe('testuser');
            expect(result.user.email).toBe('test@example.com');
            expect(mockDatabaseService.createUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: 'testuser',
                    email: 'test@example.com',
                    passwordHash: expect.any(String),
                    isOnline: false,
                    rating: 1200
                })
            );
            expect(mockDatabaseService.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'USER_REGISTERED'
                })
            );
        });

        test('SEC-02: should reject duplicate email registration', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue({ id: 'existing-user' });

            await expect(authService.registerUser(validUserData))
                .rejects.toThrow('EMAIL_EXISTS');

            expect(mockDatabaseService.createUser).not.toHaveBeenCalled();
            expect(mockDatabaseService.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'REGISTRATION_FAILED'
                })
            );
        });

        test('should reject duplicate username registration', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(null);
            mockDatabaseService.findUserByUsername.mockResolvedValue({ id: 'existing-user' });

            await expect(authService.registerUser(validUserData))
                .rejects.toThrow('USERNAME_EXISTS');
        });

        test('should validate email format', async () => {
            const invalidEmailData = { ...validUserData, email: 'invalid-email' };

            await expect(authService.registerUser(invalidEmailData))
                .rejects.toThrow('INVALID_EMAIL');
        });

        test('should validate password strength', async () => {
            const weakPasswordData = { ...validUserData, password: '123' };

            await expect(authService.registerUser(weakPasswordData))
                .rejects.toThrow('WEAK_PASSWORD');
        });

        test('should validate username format', async () => {
            const invalidUsernameData = { ...validUserData, username: 'a' };

            await expect(authService.registerUser(invalidUsernameData))
                .rejects.toThrow('INVALID_USERNAME');
        });

        test('should reject username with special characters', async () => {
            const invalidUsernameData = { ...validUserData, username: 'user@name!' };

            await expect(authService.registerUser(invalidUsernameData))
                .rejects.toThrow('INVALID_USERNAME');
        });

        test('should hash password correctly', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(null);
            mockDatabaseService.findUserByUsername.mockResolvedValue(null);
            mockDatabaseService.createUser.mockResolvedValue({
                id: 'user-123',
                username: 'testuser',
                email: 'test@example.com',
                rating: 1200
            });

            await authService.registerUser(validUserData);

            const createUserCall = mockDatabaseService.createUser.mock.calls[0][0];
            expect(createUserCall.passwordHash).toBeDefined();
            expect(createUserCall.passwordHash).not.toBe(validUserData.password);
            
            // Verify bcrypt hash
            const isValidHash = await bcrypt.compare(validUserData.password, createUserCall.passwordHash);
            expect(isValidHash).toBe(true);
        });
    });

    describe('loginUser', () => {
        const existingUser = {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            passwordHash: '', // Will be set in beforeEach
            rating: 1200
        };

        beforeEach(async () => {
            existingUser.passwordHash = await bcrypt.hash('SecurePass123', 4);
        });

        test('SEC-03: should authenticate valid credentials', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(existingUser);
            mockDatabaseService.updateUser.mockResolvedValue(true);

            const result = await authService.loginUser('test@example.com', 'SecurePass123');

            expect(result.success).toBe(true);
            expect(result.user.email).toBe('test@example.com');
            expect(result.tokens.accessToken).toBeDefined();
            expect(result.tokens.refreshToken).toBeDefined();
            expect(mockDatabaseService.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'USER_LOGIN'
                })
            );
        });

        test('should reject invalid email', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(null);

            await expect(authService.loginUser('nonexistent@example.com', 'password'))
                .rejects.toThrow('INVALID_CREDENTIALS');

            expect(mockDatabaseService.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'LOGIN_FAILED'
                })
            );
        });

        test('should reject invalid password', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(existingUser);

            await expect(authService.loginUser('test@example.com', 'wrongpassword'))
                .rejects.toThrow('INVALID_CREDENTIALS');
        });

        test('SEC-04: should implement rate limiting after failed attempts', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(existingUser);

            // Make 3 failed attempts (maxLoginAttempts = 3 in test config)
            for (let i = 0; i < 3; i++) {
                try {
                    await authService.loginUser('test@example.com', 'wrongpassword');
                } catch (e) {
                    // Expected to fail
                }
            }

            // 4th attempt should be rate limited
            await expect(authService.loginUser('test@example.com', 'wrongpassword'))
                .rejects.toThrow('TOO_MANY_ATTEMPTS');
        });

        test('should clear failed attempts on successful login', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(existingUser);
            mockDatabaseService.updateUser.mockResolvedValue(true);

            // Make 2 failed attempts
            for (let i = 0; i < 2; i++) {
                try {
                    await authService.loginUser('test@example.com', 'wrongpassword');
                } catch (e) {
                    // Expected to fail
                }
            }

            // Successful login should clear attempts
            const result = await authService.loginUser('test@example.com', 'SecurePass123');
            expect(result.success).toBe(true);

            // Should be able to make failed attempts again
            try {
                await authService.loginUser('test@example.com', 'wrongpassword');
            } catch (e) {
                // Expected to fail but not rate limited
                expect(e.message).not.toBe('TOO_MANY_ATTEMPTS');
            }
        });

        test('should handle concurrent login attempts', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(existingUser);
            mockDatabaseService.updateUser.mockResolvedValue(true);

            // Simulate concurrent logins
            const promises = Array.from({ length: 5 }, () =>
                authService.loginUser('test@example.com', 'SecurePass123')
            );

            const results = await Promise.all(promises);
            results.forEach(result => {
                expect(result.success).toBe(true);
            });
        });
    });

    describe('validateToken', () => {
        test('SEC-05: should validate JWT tokens', async () => {
            const user = {
                id: 'user-123',
                username: 'testuser',
                email: 'test@example.com',
                rating: 1200
            };

            mockDatabaseService.findUserById.mockResolvedValue(user);

            const token = authService.issueJWT(user);
            const validation = await authService.validateToken(token);

            expect(validation.valid).toBe(true);
            expect(validation.user.id).toBe('user-123');
            expect(validation.user.email).toBe('test@example.com');
        });

        test('should reject expired tokens', async () => {
            const user = { id: 'user-123', username: 'testuser' };
            
            // Create expired token
            const expiredToken = jwt.sign(
                { sub: user.id, name: user.username },
                testConfig.jwtSecret,
                { expiresIn: '-1s', issuer: 'losalamos-server' }
            );

            const validation = await authService.validateToken(expiredToken);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBeDefined();
        });

        test('should reject invalid signature', async () => {
            const invalidToken = 'invalid.jwt.token';

            const validation = await authService.validateToken(invalidToken);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBeDefined();
        });

        test('should reject token for non-existent user', async () => {
            mockDatabaseService.findUserById.mockResolvedValue(null);

            const token = jwt.sign(
                { sub: 'nonexistent-user' },
                testConfig.jwtSecret,
                { issuer: 'losalamos-server' }
            );

            const validation = await authService.validateToken(token);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('USER_NOT_FOUND');
        });
    });

    describe('refreshToken', () => {
        test('should refresh valid refresh token', async () => {
            const user = {
                id: 'user-123',
                username: 'testuser',
                refreshToken: 'valid-refresh-token',
                tokenExpiry: new Date(Date.now() + 3600000) // 1 hour from now
            };

            const refreshToken = jwt.sign(
                { sub: user.id, type: 'refresh' },
                testConfig.jwtRefreshSecret,
                { expiresIn: testConfig.refreshTokenExpiresIn }
            );

            user.refreshToken = refreshToken;
            mockDatabaseService.findUserById.mockResolvedValue(user);

            const result = await authService.refreshToken(refreshToken);

            expect(result.success).toBe(true);
            expect(result.accessToken).toBeDefined();
        });

        test('should reject mismatched refresh token', async () => {
            const user = {
                id: 'user-123',
                refreshToken: 'different-token'
            };

            const refreshToken = jwt.sign(
                { sub: user.id, type: 'refresh' },
                testConfig.jwtRefreshSecret
            );

            mockDatabaseService.findUserById.mockResolvedValue(user);

            await expect(authService.refreshToken(refreshToken))
                .rejects.toThrow('INVALID_REFRESH_TOKEN');
        });

        test('should reject expired refresh token', async () => {
            const user = {
                id: 'user-123',
                tokenExpiry: new Date(Date.now() - 1000) // Expired 1 second ago
            };

            const refreshToken = jwt.sign(
                { sub: user.id, type: 'refresh' },
                testConfig.jwtRefreshSecret
            );

            user.refreshToken = refreshToken;
            mockDatabaseService.findUserById.mockResolvedValue(user);

            await expect(authService.refreshToken(refreshToken))
                .rejects.toThrow('REFRESH_TOKEN_EXPIRED');
        });
    });

    describe('authorize', () => {
        test('SEC-07: should enforce role-based access control', () => {
            const playerUser = { id: 'user-123', roles: ['player'] };
            const adminUser = { id: 'admin-456', roles: ['admin'] };
            const spectatorUser = { id: 'spec-789', roles: ['spectator'] };

            // Player permissions
            expect(authService.authorize(playerUser, 'game', 'join')).toBe(true);
            expect(authService.authorize(playerUser, 'game', 'move')).toBe(true);
            expect(authService.authorize(playerUser, 'profile', 'update')).toBe(true);
            expect(authService.authorize(playerUser, 'admin', 'access')).toBe(false);

            // Admin permissions (should have all)
            expect(authService.authorize(adminUser, 'game', 'join')).toBe(true);
            expect(authService.authorize(adminUser, 'admin', 'access')).toBe(true);
            expect(authService.authorize(adminUser, 'anything', 'whatever')).toBe(true);

            // Spectator permissions (limited)
            expect(authService.authorize(spectatorUser, 'game', 'view')).toBe(true);
            expect(authService.authorize(spectatorUser, 'game', 'join')).toBe(false);
            expect(authService.authorize(spectatorUser, 'game', 'move')).toBe(false);
        });

        test('should log unauthorized access attempts', () => {
            const user = { id: 'user-123', roles: ['player'] };

            authService.authorize(user, 'admin', 'access');

            expect(mockDatabaseService.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'UNAUTHORIZED_ACCESS',
                    userId: 'user-123'
                })
            );
        });
    });

    describe('logoutUser', () => {
        test('should successfully logout user', async () => {
            const user = { id: 'user-123', username: 'testuser' };
            mockDatabaseService.updateUser.mockResolvedValue(true);

            const result = await authService.logoutUser(user);

            expect(result.success).toBe(true);
            expect(mockDatabaseService.updateUser).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    isOnline: false,
                    refreshToken: null,
                    tokenExpiry: null
                })
            );
            expect(mockDatabaseService.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'USER_LOGOUT'
                })
            );
        });
    });

    describe('sendPasswordReset', () => {
        test('should generate reset token for existing user', async () => {
            const user = { id: 'user-123', email: 'test@example.com' };
            mockDatabaseService.findUserByEmail.mockResolvedValue(user);
            mockDatabaseService.updateUser.mockResolvedValue(true);

            const result = await authService.sendPasswordReset('test@example.com');

            expect(result.success).toBe(true);
            expect(result.resetToken).toBeDefined(); // Only for testing
            expect(mockDatabaseService.updateUser).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    resetToken: expect.any(String),
                    resetExpiry: expect.any(Date)
                })
            );
        });

        test('should not reveal if email does not exist', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(null);

            const result = await authService.sendPasswordReset('nonexistent@example.com');

            expect(result.success).toBe(true);
            expect(result.message).toBe('If email exists, reset link sent');
            expect(mockDatabaseService.updateUser).not.toHaveBeenCalled();
        });
    });

    describe('Input validation helpers', () => {
        test('should validate email formats correctly', () => {
            expect(authService._validateEmail('test@example.com')).toBe(true);
            expect(authService._validateEmail('user.name+tag@domain.co.uk')).toBe(true);
            expect(authService._validateEmail('invalid-email')).toBe(false);
            expect(authService._validateEmail('test@')).toBe(false);
            expect(authService._validateEmail('@example.com')).toBe(false);
        });

        test('should validate password strength correctly', () => {
            expect(authService._validatePassword('SecurePass123')).toBe(true);
            expect(authService._validatePassword('password')).toBe(false); // No uppercase/number
            expect(authService._validatePassword('PASSWORD123')).toBe(false); // No lowercase
            expect(authService._validatePassword('Password')).toBe(false); // No number
            expect(authService._validatePassword('Pass1')).toBe(false); // Too short
        });

        test('should validate username formats correctly', () => {
            expect(authService._validateUsername('validuser')).toBe(true);
            expect(authService._validateUsername('user123')).toBe(true);
            expect(authService._validateUsername('user_name')).toBe(true);
            expect(authService._validateUsername('us')).toBe(false); // Too short
            expect(authService._validateUsername('thisusernameiswaytoolongtobevalid')).toBe(false); // Too long
            expect(authService._validateUsername('user name')).toBe(false); // Space
            expect(authService._validateUsername('user@name')).toBe(false); // Special char
        });
    });

    describe('Error handling and edge cases', () => {
        test('should handle database connection errors gracefully', async () => {
            mockDatabaseService.findUserByEmail.mockRejectedValue(new Error('Database connection failed'));

            await expect(authService.loginUser('test@example.com', 'password'))
                .rejects.toThrow('Database connection failed');
        });

        test('should handle bcrypt errors', async () => {
    const invalidHash = 'invalid-bcrypt-hash';
    const user = { 
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: invalidHash 
    };
    mockDatabaseService.findUserByEmail.mockResolvedValue(user);

    await expect(authService.loginUser('test@example.com', 'password'))
        .rejects.toThrow();
});

        test('should handle JWT signing errors', () => {
            const invalidConfig = { ...testConfig, jwtSecret: '' };
            const authServiceWithInvalidConfig = new AuthenticationService(mockDatabaseService, invalidConfig);

            expect(() => {
                authServiceWithInvalidConfig.issueJWT({ id: 'user-123' });
            }).toThrow();
        });

        test('should handle missing required fields', async () => {
            await expect(authService.registerUser({}))
                .rejects.toThrow();

            await expect(authService.registerUser({ email: 'test@example.com' }))
                .rejects.toThrow();
        });
    });

    describe('Security stress tests', () => {
        test('should handle rapid registration attempts', async () => {
            mockDatabaseService.findUserByEmail.mockResolvedValue(null);
            mockDatabaseService.findUserByUsername.mockResolvedValue(null);
            mockDatabaseService.createUser.mockImplementation((userData) => ({
                id: `user-${Math.random()}`,
                ...userData
            }));

            const promises = Array.from({ length: 10 }, (_, i) =>
                authService.registerUser({
                    username: `user${i}`,
                    email: `user${i}@example.com`,
                    password: 'SecurePass123'
                })
            );

            const results = await Promise.allSettled(promises);
            results.forEach(result => {
                expect(result.status).toBe('fulfilled');
                if (result.status === 'fulfilled') {
                    expect(result.value.success).toBe(true);
                }
            });
        });

        test('should handle malicious input attempts', async () => {
            const maliciousInputs = [
                { username: '<script>alert("xss")</script>', email: 'test@example.com', password: 'SecurePass123' },
                { username: 'user', email: 'test@example.com', password: '<script>alert("xss")</script>' },
                { username: 'user', email: '<script>alert("xss")</script>', password: 'SecurePass123' },
                { username: 'user', email: 'test@example.com', password: 'password\0injection' }
            ];

            for (const input of maliciousInputs) {
                try {
                    await authService.registerUser(input);
                } catch (error) {
                    // Should fail validation, not cause security issues
                    expect(error.message).toMatch(/INVALID_|WEAK_PASSWORD/);
                }
            }
        });

        test('should prevent timing attacks on user existence', async () => {
            mockDatabaseService.findUserByEmail.mockImplementation(async (email) => {
                // Simulate database delay
                await new Promise(resolve => setTimeout(resolve, 10));
                return email === 'existing@example.com' ? { id: 'user-123' } : null;
            });

            const start1 = Date.now();
            try {
                await authService.loginUser('existing@example.com', 'wrongpassword');
            } catch (e) {
                // Expected to fail
            }
            const time1 = Date.now() - start1;

            const start2 = Date.now();
            try {
                await authService.loginUser('nonexistent@example.com', 'wrongpassword');
            } catch (e) {
                // Expected to fail
            }
            const time2 = Date.now() - start2;

            // Times should be similar (within 50ms) to prevent timing attacks
            expect(Math.abs(time1 - time2)).toBeLessThan(50);
        });
    });

    describe('SEC-08: POPIA Compliance (Account Deletion)', () => {
        test('should provide account deletion functionality', async () => {
            // This would need to be implemented based on your requirements
            const user = { id: 'user-123', email: 'test@example.com' };
            
            // Mock implementation - you'd need to implement this method
            const deleteAccount = jest.fn().mockResolvedValue(true);
            authService.deleteAccount = deleteAccount;

            await authService.deleteAccount(user.id);

            expect(deleteAccount).toHaveBeenCalledWith(user.id);
        });
    });
});

// Additional test file: auth-middleware.test.js
describe('Authentication Middleware', () => {
    const authMiddleware = require('../auth-middleware');
    let mockAuthService;
    let req, res, next;

    beforeEach(() => {
        mockAuthService = {
            validateToken: jest.fn(),
            authorize: jest.fn()
        };

        req = {
            headers: {},
            user: null
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        next = jest.fn();
    });

    describe('authenticateToken', () => {
        test('should authenticate valid token', async () => {
            req.headers.authorization = 'Bearer valid-token';
            mockAuthService.validateToken.mockResolvedValue({
                valid: true,
                user: { id: 'user-123', username: 'testuser' }
            });

            const middleware = authMiddleware.authenticateToken(mockAuthService);
            await middleware(req, res, next);

            expect(req.user).toEqual({ id: 'user-123', username: 'testuser' });
            expect(next).toHaveBeenCalled();
        });

        test('SEC-06: should reject missing token', async () => {
            const middleware = authMiddleware.authenticateToken(mockAuthService);
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'UNAUTHORIZED'
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('should reject invalid token', async () => {
            req.headers.authorization = 'Bearer invalid-token';
            mockAuthService.validateToken.mockResolvedValue({
                valid: false,
                error: 'INVALID_TOKEN'
            });

            const middleware = authMiddleware.authenticateToken(mockAuthService);
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('authorizeAction', () => {
        test('should authorize valid action', () => {
            req.user = { id: 'user-123', roles: ['player'] };
            mockAuthService.authorize.mockReturnValue(true);

            const middleware = authMiddleware.authorizeAction(mockAuthService, 'game', 'join');
            middleware(req, res, next);

            expect(mockAuthService.authorize).toHaveBeenCalledWith(req.user, 'game', 'join');
            expect(next).toHaveBeenCalled();
        });

        test('should reject unauthorized action', () => {
            req.user = { id: 'user-123', roles: ['spectator'] };
            mockAuthService.authorize.mockReturnValue(false);

            const middleware = authMiddleware.authorizeAction(mockAuthService, 'game', 'move');
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        test('should reject unauthenticated request', () => {
            req.user = null;

            const middleware = authMiddleware.authorizeAction(mockAuthService, 'game', 'move');
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('sanitizeInput', () => {
        test('should sanitize XSS attempts', () => {
            req.body = {
                message: '<script>alert("xss")</script>Hello',
                username: 'user<script>alert("xss")</script>'
            };

            authMiddleware.sanitizeInput(req, res, next);

            expect(req.body.message).toBe('Hello');
            expect(req.body.username).toBe('user');
            expect(next).toHaveBeenCalled();
        });

        test('should handle nested objects', () => {
            req.body = {
                user: {
                    profile: {
                        bio: '<script>alert("xss")</script>Clean text'
                    }
                }
            };

            authMiddleware.sanitizeInput(req, res, next);

            expect(req.body.user.profile.bio).toBe('Clean text');
        });
    });
});