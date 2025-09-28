/**
 * SECURITY LAYER INTEGRATION TESTS
 *
 * Purpose: Test Byron's backend working with Elizabeth's authentication system
 * File Location: /backend/unit-tests/integration-tests/test-security-integration.js
 *
 * Tests:
 * 1. Move validation works with JWT tokens
 * 2. AI bot requests with authentication
 * 3. Rate limiting with AI bot requests
 * 4. Security validator integration with Rules Engine
 * 5. Session management with game states
 * 6. Authorization for move execution
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Import Byron's backend components
const RulesEngine = require('../../src/engine/index');
const AIBot = require('../../src/ai-bot/index');

// Mock Authentication Service (based on Elizabeth's structure)
class MockAuthenticationService {
    constructor() {
        this.users = new Map();
        this.sessions = new Map();
        this.config = {
            jwtSecret: 'test-secret-key',
            jwtExpiresIn: '15m',
            bcryptRounds: 12
        };

        // Create test users
        this.createTestUsers();
    }

    createTestUsers() {
        this.users.set(1, {
            id: 1,
            username: 'testPlayer1',
            email: 'player1@test.com',
            passwordHash: '$2b$12$hashedpassword1',
            rating: 1200,
            isActive: true
        });

        this.users.set(2, {
            id: 2,
            username: 'testPlayer2',
            email: 'player2@test.com',
            passwordHash: '$2b$12$hashedpassword2',
            rating: 1300,
            isActive: true
        });
    }

    // Generate JWT token for testing
    generateToken(userId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const payload = {
            id: user.id,
            username: user.username,
            email: user.email,
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, this.config.jwtSecret, {
            expiresIn: this.config.jwtExpiresIn
        });
    }

    // Verify JWT token
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.config.jwtSecret);
            const user = this.users.get(decoded.id);
            return user && user.isActive ? decoded : null;
        } catch (error) {
            return null;
        }
    }

    // Create session
    createSession(userId, gameId) {
        const sessionId = crypto.randomUUID();
        this.sessions.set(sessionId, {
            userId,
            gameId,
            createdAt: Date.now(),
            isActive: true
        });
        return sessionId;
    }
}

// Mock Security Move Validator (based on enhanced-move-validator.js)
class MockSecurityMoveValidator {
    constructor() {
        this.moveHistory = new Map();
        this.gameStates = new Map();
        this.playerSessions = new Map();
        this.rateLimits = new Map(); // userId -> { count, resetTime }

        // Initialize Rules Engine
        this.rulesEngine = new RulesEngine();
        this.aiBot = new AIBot();

        console.log('🔒 Mock Security Move Validator initialized');
    }

    // Validate move with security checks
    async validateMoveSecure(userId, gameId, move, token) {
        try {
            // 1. Authentication check
            const authService = new MockAuthenticationService();
            const user = authService.verifyToken(token);

            if (!user) {
                return {
                    success: false,
                    error: 'AUTHENTICATION_FAILED',
                    message: 'Invalid or expired token'
                };
            }

            // 2. Authorization check
            const gameSession = this.playerSessions.get(gameId);
            if (!gameSession || (gameSession.white !== userId && gameSession.black !== userId)) {
                return {
                    success: false,
                    error: 'AUTHORIZATION_FAILED',
                    message: 'User not authorized for this game'
                };
            }

            // 3. Rate limiting check
            if (!this.checkRateLimit(userId)) {
                return {
                    success: false,
                    error: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many move requests'
                };
            }

            // 4. Get current game state
            const gameState = this.gameStates.get(gameId);
            if (!gameState) {
                return {
                    success: false,
                    error: 'GAME_NOT_FOUND',
                    message: 'Game state not found'
                };
            }

            // 5. Validate turn
            const isWhiteTurn = gameState.currentFEN.split(' ')[1] === 'w';
            const isUserWhite = gameSession.white === userId;

            if ((isWhiteTurn && !isUserWhite) || (!isWhiteTurn && isUserWhite)) {
                return {
                    success: false,
                    error: 'NOT_YOUR_TURN',
                    message: 'It is not your turn'
                };
            }

            // 6. Rules Engine validation
            const validation = this.rulesEngine.validateMove(gameState.currentFEN, move);

            if (!validation.valid) {
                return {
                    success: false,
                    error: 'INVALID_MOVE',
                    message: validation.error
                };
            }

            // 7. Apply move and update state
            const moveResult = this.rulesEngine.applyMove(gameState.currentFEN, move);

            // Update game state
            gameState.currentFEN = moveResult.newFEN;
            gameState.lastMove = {
                move,
                san: moveResult.san,
                userId,
                timestamp: Date.now()
            };

            this.gameStates.set(gameId, gameState);

            // Update move history
            const history = this.moveHistory.get(gameId) || [];
            history.push({
                move,
                san: moveResult.san,
                userId,
                timestamp: Date.now()
            });
            this.moveHistory.set(gameId, history);

            return {
                success: true,
                move: moveResult.move,
                san: moveResult.san,
                newFEN: moveResult.newFEN,
                moveType: moveResult.moveType
            };

        } catch (error) {
            return {
                success: false,
                error: 'VALIDATION_ERROR',
                message: error.message
            };
        }
    }

    // Get AI move with security
    async getAIMoveSecure(userId, gameId, level, token) {
        try {
            // Authentication
            const authService = new MockAuthenticationService();
            const user = authService.verifyToken(token);

            if (!user) {
                return {
                    success: false,
                    error: 'AUTHENTICATION_FAILED'
                };
            }

            // Rate limiting for AI requests
            if (!this.checkRateLimit(userId, 'ai_request')) {
                return {
                    success: false,
                    error: 'AI_RATE_LIMIT_EXCEEDED'
                };
            }

            // Get game state
            const gameState = this.gameStates.get(gameId);
            if (!gameState) {
                return {
                    success: false,
                    error: 'GAME_NOT_FOUND'
                };
            }

            // Generate AI move
            const aiResponse = await this.aiBot.generateMove(gameState.currentFEN, level, 3000);

            // Validate AI move
            const validation = this.rulesEngine.validateMove(gameState.currentFEN, aiResponse.move);

            if (!validation.valid) {
                return {
                    success: false,
                    error: 'AI_GENERATED_INVALID_MOVE'
                };
            }

            return {
                success: true,
                move: aiResponse.move,
                san: aiResponse.san,
                newFEN: aiResponse.newFEN,
                metadata: aiResponse.metadata
            };

        } catch (error) {
            return {
                success: false,
                error: 'AI_MOVE_ERROR',
                message: error.message
            };
        }
    }

    // Rate limiting implementation
    checkRateLimit(userId, type = 'move') {
        const limits = {
            move: { maxRequests: 20, windowMs: 60000 }, // 20 moves per minute
            ai_request: { maxRequests: 10, windowMs: 60000 } // 10 AI requests per minute
        };

        const limit = limits[type];
        const key = `${userId}_${type}`;
        const now = Date.now();

        const userLimit = this.rateLimits.get(key);

        if (!userLimit) {
            this.rateLimits.set(key, {
                count: 1,
                resetTime: now + limit.windowMs
            });
            return true;
        }

        if (now > userLimit.resetTime) {
            // Reset window
            this.rateLimits.set(key, {
                count: 1,
                resetTime: now + limit.windowMs
            });
            return true;
        }

        if (userLimit.count >= limit.maxRequests) {
            return false; // Rate limit exceeded
        }

        userLimit.count++;
        return true;
    }

    // Initialize game session
    initGameSession(gameId, whiteUserId, blackUserId) {
        this.playerSessions.set(gameId, {
            white: whiteUserId,
            black: blackUserId,
            createdAt: Date.now()
        });

        this.gameStates.set(gameId, {
            currentFEN: 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1',
            status: 'active',
            createdAt: Date.now()
        });
    }
}

describe('🔒 Security Layer Integration Tests', () => {
    let rulesEngine;
    let aiBot;
    let authService;
    let securityValidator;
    let testTokens;

    beforeEach(() => {
        // Initialize components
        rulesEngine = new RulesEngine();
        aiBot = new AIBot();
        authService = new MockAuthenticationService();
        securityValidator = new MockSecurityMoveValidator();

        // Generate test tokens
        testTokens = {
            player1: authService.generateToken(1),
            player2: authService.generateToken(2)
        };

        console.log('🔧 Security integration test setup complete');
    });

    describe('🔐 Authentication Integration', () => {

        /**
         * Test: Move validation works with JWT tokens
         * Expected: Only authenticated users can make moves
         * Description: Ensures Rules Engine respects authentication system
         */
        it('should validate moves only with valid JWT tokens', async () => {
            console.log('🔐 Testing JWT token authentication...');

            try {
                const gameId = 'test-game-security-1';
                securityValidator.initGameSession(gameId, 1, 2);

                // Test valid token move
                const validMove = 'b2b3';
                const validResult = await securityValidator.validateMoveSecure(
                    1, gameId, validMove, testTokens.player1
                );

                assert(validResult.success === true,
                    `❌ Valid token move failed\nExpected: Success\nGot: ${validResult.error || 'Unknown error'}`);
                assert(validResult.move === validMove,
                    `❌ Move mismatch\nExpected: ${validMove}\nGot: ${validResult.move}`);

                // Test invalid token move
                const invalidToken = 'invalid.token.here';
                const invalidResult = await securityValidator.validateMoveSecure(
                    1, gameId, 'b3b4', invalidToken
                );

                assert(invalidResult.success === false,
                    `❌ Invalid token accepted\nExpected: Failure\nGot: Success`);
                assert(invalidResult.error === 'AUTHENTICATION_FAILED',
                    `❌ Wrong error type\nExpected: AUTHENTICATION_FAILED\nGot: ${invalidResult.error}`);

                // Test expired token (simulate)
                const expiredToken = jwt.sign(
                    { id: 1, username: 'testPlayer1' },
                    'test-secret-key',
                    { expiresIn: '-1h' } // Expired 1 hour ago
                );

                const expiredResult = await securityValidator.validateMoveSecure(
                    1, gameId, 'c2c3', expiredToken
                );

                assert(expiredResult.success === false,
                    `❌ Expired token accepted\nExpected: Failure\nGot: Success`);

                console.log('✅ JWT token authentication passed');
                console.log(`📊 Valid: Success, Invalid: ${invalidResult.error}, Expired: ${expiredResult.error}`);

            } catch (error) {
                assert.fail(`❌ JWT authentication failed\nExpected: Proper authentication\nGot Error: ${error.message}`);
            }
        });

        /**
         * Test: Authorization checks for game participation
         * Expected: Users can only move in games they're part of
         * Description: Ensures users can't interfere with other games
         */
        it('should enforce authorization for game participation', async () => {
            console.log('🔐 Testing game authorization...');

            try {
                const gameId1 = 'auth-game-1';
                const gameId2 = 'auth-game-2';

                // Setup two different games
                securityValidator.initGameSession(gameId1, 1, 2); // Player 1 vs Player 2
                securityValidator.initGameSession(gameId2, 2, 1); // Player 2 vs Player 1 (different colors)

                // Test authorized move in correct game
                const authorizedResult = await securityValidator.validateMoveSecure(
                    1, gameId1, 'b2b3', testTokens.player1
                );

                assert(authorizedResult.success === true,
                    `❌ Authorized move failed\nExpected: Success\nGot: ${authorizedResult.error}`);

                // Test unauthorized move in wrong game (player 1 not in this game setup)
                const gameId3 = 'unauthorized-game';
                securityValidator.initGameSession(gameId3, 2, 3); // Player 2 vs Player 3

                const unauthorizedResult = await securityValidator.validateMoveSecure(
                    1, gameId3, 'b2b3', testTokens.player1
                );

                assert(unauthorizedResult.success === false,
                    `❌ Unauthorized move accepted\nExpected: Failure\nGot: Success`);
                assert(unauthorizedResult.error === 'AUTHORIZATION_FAILED',
                    `❌ Wrong error type\nExpected: AUTHORIZATION_FAILED\nGot: ${unauthorizedResult.error}`);

                // Test turn-based authorization
                const wrongTurnResult = await securityValidator.validateMoveSecure(
                    2, gameId1, 'b5b4', testTokens.player2
                );

                assert(wrongTurnResult.success === false,
                    `❌ Wrong turn move accepted\nExpected: Failure\nGot: Success`);
                assert(wrongTurnResult.error === 'NOT_YOUR_TURN',
                    `❌ Wrong error type\nExpected: NOT_YOUR_TURN\nGot: ${wrongTurnResult.error}`);

                console.log('✅ Game authorization passed');
                console.log(`📊 Authorized: Success, Unauthorized: ${unauthorizedResult.error}, Wrong turn: ${wrongTurnResult.error}`);

            } catch (error) {
                assert.fail(`❌ Game authorization failed\nExpected: Proper authorization\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🤖 AI Bot Security Integration', () => {

        /**
         * Test: AI bot requests require authentication
         * Expected: AI moves only generated for authenticated users
         * Description: Ensures AI bot respects security layer
         */
        it('should require authentication for AI bot requests', async () => {
            console.log('🤖 Testing AI bot authentication...');

            try {
                const gameId = 'ai-security-game';
                securityValidator.initGameSession(gameId, 1, 2);

                // Test authenticated AI request
                const validAIResult = await securityValidator.getAIMoveSecure(
                    1, gameId, 'L2', testTokens.player1
                );

                assert(validAIResult.success === true,
                    `❌ Authenticated AI request failed\nExpected: Success\nGot: ${validAIResult.error}`);
                assert(typeof validAIResult.move === 'string',
                    `❌ AI move format wrong\nExpected: string\nGot: ${typeof validAIResult.move}`);
                assert(validAIResult.metadata,
                    `❌ AI metadata missing\nExpected: metadata object\nGot: ${validAIResult.metadata}`);

                // Test unauthenticated AI request
                const invalidAIResult = await securityValidator.getAIMoveSecure(
                    1, gameId, 'L2', 'invalid.token'
                );

                assert(invalidAIResult.success === false,
                    `❌ Unauthenticated AI request accepted\nExpected: Failure\nGot: Success`);
                assert(invalidAIResult.error === 'AUTHENTICATION_FAILED',
                    `❌ Wrong error type\nExpected: AUTHENTICATION_FAILED\nGot: ${invalidAIResult.error}`);

                // Test AI move validation through security layer
                if (validAIResult.success) {
                    const aiMoveValidation = rulesEngine.validateMove(
                        securityValidator.gameStates.get(gameId).currentFEN,
                        validAIResult.move
                    );

                    assert(aiMoveValidation.valid === true,
                        `❌ AI generated invalid move\nExpected: Valid move\nGot: ${aiMoveValidation.error}`);
                }

                console.log('✅ AI bot authentication passed');
                console.log(`📊 Valid AI: ${validAIResult.move || 'N/A'}, Invalid: ${invalidAIResult.error}`);

            } catch (error) {
                assert.fail(`❌ AI bot authentication failed\nExpected: Secure AI requests\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🚦 Rate Limiting Integration', () => {

        /**
         * Test: Rate limiting protects against abuse
         * Expected: Excessive requests are blocked
         * Description: Ensures system can't be overwhelmed
         */
        it('should enforce rate limits on move requests', async () => {
            console.log('🚦 Testing rate limiting...');

            try {
                const gameId = 'rate-limit-game';
                securityValidator.initGameSession(gameId, 1, 2);

                let successfulMoves = 0;
                let rateLimitedMoves = 0;

                // Attempt many moves rapidly
                for (let i = 0; i < 25; i++) {
                    const move = i % 2 === 0 ? 'b2b3' : 'b3b2'; // Alternate moves
                    const result = await securityValidator.validateMoveSecure(
                        1, gameId, move, testTokens.player1
                    );

                    if (result.success) {
                        successfulMoves++;
                    } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
                        rateLimitedMoves++;
                    }
                }

                // Should have some successful moves and some rate limited
                assert(successfulMoves > 0,
                    `❌ No successful moves\nExpected: > 0\nGot: ${successfulMoves}`);
                assert(rateLimitedMoves > 0,
                    `❌ Rate limiting not working\nExpected: > 0 rate limited\nGot: ${rateLimitedMoves}`);
                assert(successfulMoves < 25,
                    `❌ Rate limiting not effective\nExpected: < 25 successful\nGot: ${successfulMoves}`);

                // Test AI request rate limiting
                let aiSuccessful = 0;
                let aiRateLimited = 0;

                for (let i = 0; i < 15; i++) {
                    const aiResult = await securityValidator.getAIMoveSecure(
                        1, gameId, 'L1', testTokens.player1
                    );

                    if (aiResult.success) {
                        aiSuccessful++;
                    } else if (aiResult.error === 'AI_RATE_LIMIT_EXCEEDED') {
                        aiRateLimited++;
                    }
                }

                assert(aiRateLimited > 0,
                    `❌ AI rate limiting not working\nExpected: > 0 rate limited\nGot: ${aiRateLimited}`);

                console.log('✅ Rate limiting passed');
                console.log(`📊 Moves: ${successfulMoves}/${25} successful, AI: ${aiSuccessful}/${15} successful`);

            } catch (error) {
                assert.fail(`❌ Rate limiting failed\nExpected: Effective rate limiting\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🔄 Session Management Integration', () => {

        /**
         * Test: Game sessions are properly managed
         * Expected: Sessions track game states securely
         * Description: Ensures session integrity with Rules Engine
         */
        it('should manage game sessions securely', async () => {
            console.log('🔄 Testing session management...');

            try {
                const gameId = 'session-test-game';

                // Create session
                securityValidator.initGameSession(gameId, 1, 2);

                // Verify session creation
                const session = securityValidator.playerSessions.get(gameId);
                assert(session,
                    `❌ Session not created\nExpected: Session object\nGot: ${session}`);
                assert(session.white === 1 && session.black === 2,
                    `❌ Session players wrong\nExpected: white=1, black=2\nGot: white=${session.white}, black=${session.black}`);

                // Verify game state creation
                const gameState = securityValidator.gameStates.get(gameId);
                assert(gameState,
                    `❌ Game state not created\nExpected: Game state object\nGot: ${gameState}`);
                assert(gameState.currentFEN,
                    `❌ Game state FEN missing\nExpected: FEN string\nGot: ${gameState.currentFEN}`);

                // Test session persistence through moves
                const move1Result = await securityValidator.validateMoveSecure(
                    1, gameId, 'b2b3', testTokens.player1
                );

                assert(move1Result.success === true,
                    `❌ First move failed\nExpected: Success\nGot: ${move1Result.error}`);

                // Verify game state updated
                const updatedGameState = securityValidator.gameStates.get(gameId);
                assert(updatedGameState.currentFEN !== gameState.currentFEN,
                    `❌ Game state not updated\nExpected: Different FEN\nGot: Same FEN`);
                assert(updatedGameState.lastMove,
                    `❌ Last move not recorded\nExpected: Move object\nGot: ${updatedGameState.lastMove}`);

                // Test move history tracking
                const moveHistory = securityValidator.moveHistory.get(gameId);
                assert(Array.isArray(moveHistory),
                    `❌ Move history not array\nExpected: Array\nGot: ${typeof moveHistory}`);
                assert(moveHistory.length === 1,
                    `❌ Move history count wrong\nExpected: 1\nGot: ${moveHistory.length}`);
                assert(moveHistory[0].userId === 1,
                    `❌ Move history user wrong\nExpected: 1\nGot: ${moveHistory[0].userId}`);

                console.log('✅ Session management passed');
                console.log(`📊 Session: Players ${session.white}/${session.black}, Moves: ${moveHistory.length}`);

            } catch (error) {
                assert.fail(`❌ Session management failed\nExpected: Secure session handling\nGot Error: ${error.message}`);
            }
        });
    });

    describe('⚡ Security Performance Integration', () => {

        /**
         * Test: Security layer doesn't significantly impact performance
         * Expected: Security checks complete quickly
         * Description: Ensures security doesn't slow down gameplay
         */
        it('should maintain performance with security checks', async () => {
            console.log('⚡ Testing security performance impact...');

            try {
                const gameId = 'performance-security-game';
                securityValidator.initGameSession(gameId, 1, 2);

                const moveCount = 10;
                const startTime = Date.now();

                // Perform multiple authenticated moves
                for (let i = 0; i < moveCount; i++) {
                    const moves = ['b2b3', 'b5b4', 'c2c3', 'c5c4', 'b3b2', 'b4b5', 'c3c2', 'c4c5'];
                    const move = moves[i % moves.length];

                    const result = await securityValidator.validateMoveSecure(
                        i % 2 === 0 ? 1 : 2,
                        gameId,
                        move,
                        i % 2 === 0 ? testTokens.player1 : testTokens.player2
                    );

                    // Some moves might fail due to game state, but should be fast
                }

                const endTime = Date.now();
                const totalTime = endTime - startTime;
                const avgTimePerMove = totalTime / moveCount;

                // Security checks should add minimal overhead (< 100ms per move)
                assert(avgTimePerMove < 100,
                    `❌ Security checks too slow\nExpected: < 100ms per move\nGot: ${avgTimePerMove}ms`);

                // Test AI request performance with security
                const aiStartTime = Date.now();
                const aiResult = await securityValidator.getAIMoveSecure(
                    1, gameId, 'L1', testTokens.player1
                );
                const aiEndTime = Date.now();
                const aiTime = aiEndTime - aiStartTime;

                // AI request with security should be reasonable (< 2000ms)
                assert(aiTime < 2000,
                    `❌ Secure AI request too slow\nExpected: < 2000ms\nGot: ${aiTime}ms`);

                console.log('✅ Security performance passed');
                console.log(`📊 Avg move time: ${avgTimePerMove}ms, AI time: ${aiTime}ms`);

            } catch (error) {
                assert.fail(`❌ Security performance failed\nExpected: Fast security checks\nGot Error: ${error.message}`);
            }
        });
    });

    after(() => {
        console.log('🧹 Security integration tests cleanup complete');
    });
});

// Export utilities for other integration tests
module.exports = {
    MockAuthenticationService,
    MockSecurityMoveValidator,
    testTokenAuthentication: (token, authService) => {
        return authService.verifyToken(token) !== null;
    },
    testRateLimit: (validator, userId, type = 'move') => {
        return validator.checkRateLimit(userId, type);
    },
    testSecureMove: async (validator, userId, gameId, move, token) => {
        return await validator.validateMoveSecure(userId, gameId, move, token);
    }
};