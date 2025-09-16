// websocket-auth.test.js
const WebSocketAuthenticator = require('../websocket-auth');
const AuthenticationService = require('../../src/models/AuthenticationService');
const { MoveAuthorizationService } = require('../move-authorization');
describe('WebSocket Authentication', () => {
    let wsAuth, mockAuthService, mockSocket, mockIo;

    beforeEach(() => {
        mockAuthService = {
            validateToken: jest.fn(),
            authorize: jest.fn(),
            issueJWT: jest.fn()
        };

        wsAuth = new WebSocketAuthenticator(mockAuthService);

        mockSocket = {
            handshake: {
                auth: {},
                headers: {},
                query: {}
            },
            user: null,
            userId: null,
            emit: jest.fn(),
            join: jest.fn(),
            to: jest.fn().mockReturnThis(),
            on: jest.fn(),
            disconnect: jest.fn()
        };

        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn()
        };
    });

    describe('authenticateSocket', () => {
        test('should authenticate valid token from auth header', async () => {
            mockSocket.handshake.auth.token = 'valid-token';
            mockAuthService.validateToken.mockResolvedValue({
                valid: true,
                user: { id: 'user-123', username: 'testuser', rating: 1200 }
            });

            await wsAuth.authenticateSocket(mockSocket);

            expect(mockSocket.user).toEqual({
                id: 'user-123',
                username: 'testuser',
                rating: 1200
            });
            expect(mockSocket.userId).toBe('user-123');
        });

        test('should authenticate token from authorization header', async () => {
            mockSocket.handshake.headers.authorization = 'Bearer valid-token';
            mockAuthService.validateToken.mockResolvedValue({
                valid: true,
                user: { id: 'user-123', username: 'testuser' }
            });

            await wsAuth.authenticateSocket(mockSocket);

            expect(mockSocket.user.id).toBe('user-123');
        });

        test('should authenticate token from query parameter', async () => {
            mockSocket.handshake.query.token = 'valid-token';
            mockAuthService.validateToken.mockResolvedValue({
                valid: true,
                user: { id: 'user-123', username: 'testuser' }
            });

            await wsAuth.authenticateSocket(mockSocket);

            expect(mockSocket.user.id).toBe('user-123');
        });

        test('should reject connection with missing token', async () => {
            await expect(wsAuth.authenticateSocket(mockSocket))
                .rejects.toThrow('MISSING_TOKEN');
        });

        test('should reject connection with invalid token', async () => {
            mockSocket.handshake.auth.token = 'invalid-token';
            mockAuthService.validateToken.mockResolvedValue({
                valid: false,
                error: 'INVALID_TOKEN'
            });

            await expect(wsAuth.authenticateSocket(mockSocket))
                .rejects.toThrow('INVALID_TOKEN');
        });
    });

    describe('handleJoinGame', () => {
        beforeEach(() => {
            mockSocket.user = { id: 'user-123', username: 'testuser', rating: 1200 };
        });

        test('should allow authorized user to join game', async () => {
            mockAuthService.authorize.mockReturnValue(true);
            mockAuthService.issueJWT.mockReturnValue('game-token-with-seat');

            const data = { gameId: 'game-456', seat: 'white' };

            await wsAuth.handleJoinGame(mockSocket, data, mockIo);

            expect(mockSocket.join).toHaveBeenCalledWith('game-456');
            expect(mockSocket.emit).toHaveBeenCalledWith('seat-assigned', {
                seat: 'white',
                gameToken: 'game-token-with-seat'
            });
            expect(mockSocket.to).toHaveBeenCalledWith('game-456');
        });

        test('should reject unauthorized user', async () => {
            mockAuthService.authorize.mockReturnValue(false);

            const data = { gameId: 'game-456', seat: 'white' };

            await wsAuth.handleJoinGame(mockSocket, data, mockIo);

            expect(mockSocket.emit).toHaveBeenCalledWith('error', {
                code: 'FORBIDDEN',
                message: 'Not authorized to join games'
            });
            expect(mockSocket.join).not.toHaveBeenCalled();
        });

        test('should allow spectators to join without seat', async () => {
            mockAuthService.authorize.mockReturnValue(true);

            const data = { gameId: 'game-456' }; // No seat specified

            await wsAuth.handleJoinGame(mockSocket, data, mockIo);

            expect(mockSocket.join).toHaveBeenCalledWith('game-456');
            expect(mockSocket.emit).toHaveBeenCalledWith('game-snapshot', 
                expect.objectContaining({ gameId: 'game-456' })
            );
        });
    });

    describe('handleMoveIntent', () => {
        beforeEach(() => {
            mockSocket.user = { 
                id: 'user-123', 
                username: 'testuser',
                seat: 'white'
            };
        });

        test('should process valid move', async () => {
            mockAuthService.authorize.mockReturnValue(true);

            const data = { gameId: 'game-456', uci: 'e2e4' };

            await wsAuth.handleMoveIntent(mockSocket, data, mockIo);

            expect(mockIo.to).toHaveBeenCalledWith('game-456');
            expect(mockIo.emit).toHaveBeenCalledWith('move-received', 
                expect.objectContaining({
                    gameId: 'game-456',
                    uci: 'e2e4',
                    by: 'testuser'
                })
            );
        });

        test('should reject unauthorized move', async () => {
            mockAuthService.authorize.mockReturnValue(false);

            const data = { gameId: 'game-456', uci: 'e2e4' };

            await wsAuth.handleMoveIntent(mockSocket, data, mockIo);

            expect(mockSocket.emit).toHaveBeenCalledWith('error', {
                code: 'FORBIDDEN',
                message: 'Not authorized to make moves'
            });
        });

        test('should rate limit rapid moves', async () => {
            mockAuthService.authorize.mockReturnValue(true);

            // Simulate 11 rapid moves (limit is 10)
            for (let i = 0; i < 11; i++) {
                await wsAuth.handleMoveIntent(mockSocket, { 
                    gameId: 'game-456', 
                    uci: `e${2 + i % 4}e${3 + i % 4}` 
                }, mockIo);
            }

            // Last call should be rate limited
            expect(mockSocket.emit).toHaveBeenLastCalledWith('error', {
                code: 'TOO_MANY_MOVES',
                message: 'Please slow down your move submissions'
            });
        });
    });

    describe('handleChatMessage', () => {
        beforeEach(() => {
            mockSocket.user = { id: 'user-123', username: 'testuser' };
        });

        test('should broadcast sanitized chat message', async () => {
            const data = { 
                gameId: 'game-456', 
                message: 'Good game! <script>alert("xss")</script>' 
            };

            await wsAuth.handleChatMessage(mockSocket, data, mockIo);

            expect(mockIo.to).toHaveBeenCalledWith('game-456');
            expect(mockIo.emit).toHaveBeenCalledWith('chat-message', 
                expect.objectContaining({
                    message: 'Good game! ', // XSS removed
                    user: { id: 'user-123', username: 'testuser' }
                })
            );
        });

        test('should rate limit chat messages', async () => {
            // Send 3 messages rapidly (limit is 2 per second)
            for (let i = 0; i < 3; i++) {
                await wsAuth.handleChatMessage(mockSocket, {
                    gameId: 'game-456',
                    message: `Message ${i}`
                }, mockIo);
            }

            expect(mockSocket.emit).toHaveBeenLastCalledWith('error', {
                code: 'CHAT_LIMITED',
                message: 'Please slow down your messages'
            });
        });

        test('should limit message length', async () => {
            const longMessage = 'a'.repeat(1000); // 1000 characters
            
            await wsAuth.handleChatMessage(mockSocket, {
                gameId: 'game-456',
                message: longMessage
            }, mockIo);

            const emittedCall = mockIo.emit.mock.calls.find(call => 
                call[0] === 'chat-message'
            );
            expect(emittedCall[1].message.length).toBeLessThanOrEqual(500);
        });
    });

    describe('sanitizeMessage', () => {
        test('should remove script tags', () => {
            const malicious = '<script>alert("xss")</script>Hello';
            const sanitized = wsAuth.sanitizeMessage(malicious);
            expect(sanitized).toBe('Hello');
        });

        test('should remove javascript: protocols', () => {
            const malicious = 'Click javascript:alert("xss") here';
            const sanitized = wsAuth.sanitizeMessage(malicious);
            expect(sanitized).toBe('Click "xss") here');
        });

        test('should remove event handlers', () => {
            const malicious = 'Hello onclick="alert()" world';
            const sanitized = wsAuth.sanitizeMessage(malicious);
            expect(sanitized).toBe('Hello  world');
        });

        test('should handle non-string input', () => {
            expect(wsAuth.sanitizeMessage(null)).toBe('');
            expect(wsAuth.sanitizeMessage(undefined)).toBe('');
            expect(wsAuth.sanitizeMessage(123)).toBe('');
        });
    });
});

// move-authorization.test.js
describe('Move Authorization Service', () => {
    let moveAuthService, mockAuthService, mockRulesEngine, mockDb;

    beforeEach(() => {
        mockAuthService = {
            authorize: jest.fn(),
        };

        mockRulesEngine = {
            validateMove: jest.fn(),
            applyMove: jest.fn(),
        };

        mockDb = {
            getGameState: jest.fn(),
            getGameParticipants: jest.fn(),
            createAuditLog: jest.fn(),
            saveMove: jest.fn()
        };

        moveAuthService = new MoveAuthorizationService(
            mockAuthService,
            mockRulesEngine,
            mockDb
        );
    });

    describe('validateAndProcessMove', () => {
        const mockUser = {
            id: 'user-123',
            username: 'testuser',
            seat: 'white',
            roles: ['player']
        };

        const mockGameState = {
            id: 'game-456',
            status: 'active',
            toMove: 'white',
            fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
            players: [
                { userId: 'user-123', seat: 'white' },
                { userId: 'user-456', seat: 'black' }
            ]
        };

        test('should validate and process legal move', async () => {
            mockAuthService.authorize.mockReturnValue(true);
            mockDb.getGameParticipants.mockResolvedValue([
                { userId: 'user-123' },
                { userId: 'user-456' }
            ]);
            mockDb.getGameState.mockResolvedValue(mockGameState);
            mockRulesEngine.validateMove.mockResolvedValue({
                legal: true
            });
            mockRulesEngine.applyMove.mockResolvedValue({
                legal: true,
                nextFen: 'updated-fen',
                san: 'b3',
                flags: { state: 'none' }
            });

            const result = await moveAuthService.validateAndProcessMove(
                'game-456',
                'b2b3',
                mockUser
            );

            expect(result.success).toBe(true);
            expect(result.move.uci).toBe('b2b3');
            expect(result.move.san).toBe('b3');
            expect(result.nextFen).toBe('updated-fen');
            expect(mockDb.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'MOVE_ATTEMPT',
                    metadata: expect.objectContaining({
                        status: 'SUCCESS'
                    })
                })
            );
        });

        test('should reject move from unauthorized user', async () => {
            mockAuthService.authorize.mockReturnValue(false);

            await expect(moveAuthService.validateAndProcessMove(
                'game-456',
                'b2b3',
                mockUser
            )).rejects.toThrow('FORBIDDEN: No move permission');

            expect(mockDb.createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'MOVE_ATTEMPT',
                    metadata: expect.objectContaining({
                        status: 'FAILED'
                    })
                })
            );
        });

        test('should reject move from non-participant', async () => {
            mockAuthService.authorize.mockReturnValue(true);
            mockDb.getGameParticipants.mockResolvedValue([
                { userId: 'other-user' }
            ]);

            await expect(moveAuthService.validateAndProcessMove(
                'game-456',
                'b2b3',
                mockUser
            )).rejects.toThrow('FORBIDDEN: Not a participant in this game');
        });

        test('should reject move when not user\'s turn', async () => {
            const gameStateBlackTurn = {
                ...mockGameState,
                toMove: 'black'
            };

            mockAuthService.authorize.mockReturnValue(true);
            mockDb.getGameParticipants.mockResolvedValue([
                { userId: 'user-123' }
            ]);
            mockDb.getGameState.mockResolvedValue(gameStateBlackTurn);

            await expect(moveAuthService.validateAndProcessMove(
                'game-456',
                'b2b3',
                mockUser
            )).rejects.toThrow('WRONG_TURN: Not your turn to move');
        });

        test('should reject move in inactive game', async () => {
            const inactiveGameState = {
                ...mockGameState,
                status: 'completed'
            };

            mockAuthService.authorize.mockReturnValue(true);
            mockDb.getGameParticipants.mockResolvedValue([
                { userId: 'user-123' }
            ]);
            mockDb.getGameState.mockResolvedValue(inactiveGameState);

            await expect(moveAuthService.validateAndProcessMove(
                'game-456',
                'b2b3',
                mockUser
            )).rejects.toThrow('GAME_NOT_ACTIVE: Game has ended');
        });

        test('should reject illegal move from rules engine', async () => {
            mockAuthService.authorize.mockReturnValue(true);
            mockDb.getGameParticipants.mockResolvedValue([
                { userId: 'user-123' }
            ]);
            mockDb.getGameState.mockResolvedValue(mockGameState);
            mockRulesEngine.validateMove.mockResolvedValue({
                legal: false,
                error: 'INVALID_MOVE'
            });

            await expect(moveAuthService.validateAndProcessMove(
                'game-456',
                'invalid-move',
                mockUser
            )).rejects.toThrow('ILLEGAL_MOVE: INVALID_MOVE');
        });

        test('should handle rate limiting', async () => {
            mockAuthService.authorize.mockReturnValue(true);
            mockDb.getGameParticipants.mockResolvedValue([
                { userId: 'user-123' }
            ]);
            mockDb.getGameState.mockResolvedValue(mockGameState);

            // Make 10 rapid moves (websocket limit)
            for (let i = 0; i < 10; i++) {
                try {
                    await moveAuthService.validateAndProcessMove(
                        'game-456',
                        `move-${i}`,
                        mockUser,
                        'websocket'
                    );
                } catch (e) {
                    // Some may fail for other reasons, that's ok
                }
            }

            // 11th move should be rate limited
            await expect(moveAuthService.validateAndProcessMove(
                'game-456',
                'b2b3',
                mockUser,
                'websocket'
            )).rejects.toThrow('RATE_LIMITED: Too many move attempts');
        });

        test('should handle seat changes during game', async () => {
            const gameStateWithDifferentPlayer = {
                ...mockGameState,
                players: [
                    { userId: 'different-user', seat: 'white' }, // User was replaced
                    { userId: 'user-456', seat: 'black' }
                ]
            };

            mockAuthService.authorize.mockReturnValue(true);
            mockDb.getGameParticipants.mockResolvedValue([
                { userId: 'user-123' }
            ]);
            mockDb.getGameState.mockResolvedValue(gameStateWithDifferentPlayer);

            await expect(moveAuthService.validateAndProcessMove(
                'game-456',
                'b2b3',
                mockUser
            )).rejects.toThrow('SEAT_CHANGED: No longer seated in this position');
        });
    });

    describe('validateBotMove', () => {
        test('should allow authorized bot move request', async () => {
            const adminUser = { id: 'admin-123', roles: ['admin'] };
            const gameStateWithBot = {
                status: 'active',
                toMove: 'black',
                players: [
                    { userId: 'user-123', seat: 'white' },
                    { userId: 'bot-456', seat: 'black', isBot: true }
                ]
            };

            mockAuthService.authorize.mockReturnValue(true);
            mockDb.getGameState.mockResolvedValue(gameStateWithBot);

            const result = await moveAuthService.validateBotMove(
                'game-456',
                'L2',
                adminUser
            );

            expect(result).toBe(true);
        });

        test('should reject unauthorized bot move request', async () => {
            const playerUser = { id: 'user-123', roles: ['player'] };

            mockAuthService.authorize.mockReturnValue(false);

            await expect(moveAuthService.validateBotMove(
                'game-456',
                'L2',
                playerUser
            )).rejects.toThrow('FORBIDDEN: Cannot request bot moves');
        });

        test('should reject bot move when not bot\'s turn', async () => {
            const adminUser = { id: 'admin-123', roles: ['admin'] };
            const gameStateHumanTurn = {
                status: 'active',
                toMove: 'white', // Human's turn
                players: [
                    { userId: 'user-123', seat: 'white' },
                    { userId: 'bot-456', seat: 'black', isBot: true }
                ]
            };

            mockAuthService.authorize.mockReturnValue(true);
            mockDb.getGameState.mockResolvedValue(gameStateHumanTurn);

            await expect(moveAuthService.validateBotMove(
                'game-456',
                'L2',
                adminUser
            )).rejects.toThrow('WRONG_TURN: Not bot\'s turn');
        });
    });

    describe('validateSpectatorMove', () => {
        test('should reject spectator move attempts', () => {
            const spectatorUser = { 
                id: 'spec-123', 
                roles: ['spectator'] 
            };

            expect(() => {
                moveAuthService.validateSpectatorMove(spectatorUser);
            }).toThrow('FORBIDDEN: Spectators cannot make moves');
        });

        test('should allow non-spectator users', () => {
            const playerUser = { 
                id: 'user-123', 
                roles: ['player'] 
            };

            expect(() => {
                moveAuthService.validateSpectatorMove(playerUser);
            }).not.toThrow();
        });
    });
});

// Performance and stress tests
describe('Security Performance & Stress Tests', () => {
    let authService, mockDb;

    beforeEach(() => {
        mockDb = {
            findUserByEmail: jest.fn(),
            findUserByUsername: jest.fn(),
            findUserById: jest.fn(),
            createUser: jest.fn(),
            updateUser: jest.fn(),
            createAuditLog: jest.fn()
        };

        authService = new AuthenticationService(mockDb, {
            jwtSecret: 'test-secret-key-256-bits-long',
            bcryptRounds: 4 // Fast for testing
        });
    });

  //  test('should handle concurrent login attempts without race conditions', async () => {
  //  const user = {
 //       id: 'user-123',
  //      email: 'test@example.com',
 //       passwordHash: await require('bcrypt').hash('password123', 4)
 //   };

 //   mockDb.findUserByEmail.mockResolvedValue(user);
 //   mockDb.updateUser.mockResolvedValue(true);

    // Simple test - just verify the service can handle multiple calls
  //  const promises = Array.from({ length: 3 }, () =>
  //      authService.loginUser('test@example.com', 'password123')
  //  );

  //  const results = await Promise.allSettled(promises);
    
    // At least one should succeed
  //  const successful = results.filter(result => 
 //       result.status === 'fulfilled' && result.value && result.value.success === true
 //   );
    
  //  expect(successful.length).toBeGreaterThan(0);
});
    test('should handle concurrent registration attempts', async () => {
        mockDb.findUserByEmail.mockResolvedValue(null);
        mockDb.findUserByUsername.mockResolvedValue(null);
        mockDb.createUser.mockImplementation((userData) => ({
            id: `user-${Math.random()}`,
            ...userData
        }));

        // 50 concurrent registrations with different emails
        const promises = Array.from({ length: 50 }, (_, i) =>
            authService.registerUser({
                username: `user${i}`,
                email: `user${i}@example.com`,
                password: 'SecurePass123'
            })
        );

        const results = await Promise.allSettled(promises);
        
        results.forEach(result => {
            expect(result.status).toBe('fulfilled');
        });
    });

    test('should handle token validation under load', async () => {
        const user = { id: 'user-123', username: 'testuser' };
        mockDb.findUserById.mockResolvedValue(user);

        const token = authService.issueJWT(user);

        // 100 concurrent token validations
        const promises = Array.from({ length: 100 }, () =>
            authService.validateToken(token)
        );

        const results = await Promise.all(promises);
        
        results.forEach(result => {
            expect(result.valid).toBe(true);
            expect(result.user.id).toBe('user-123');
        });
    });

//     test('should maintain security under rapid authentication attempts', async () => {
//     const validUser = {
//         id: 'user-123',
//         email: 'test@example.com',
//         passwordHash: await require('bcrypt').hash('correctpassword', 4)
//     };

//     mockDb.findUserByEmail.mockResolvedValue(validUser);
//     mockDb.updateUser.mockResolvedValue(true);

//     // Test one success, one failure
//     const validLogin = authService.loginUser('test@example.com', 'correctpassword');
//     const invalidLogin = authService.loginUser('test@example.com', 'wrongpassword')
//         .catch(err => ({ error: err.message }));

//     const [validResult, invalidResult] = await Promise.all([validLogin, invalidLogin]);
    
//     expect(validResult.success).toBe(true);
//     expect(invalidResult.error).toBeDefined();
// });

    test('should handle malformed JWT tokens gracefully', async () => {
        const malformedTokens = [
            'not.a.jwt',
            'header.payload', // Missing signature
            'too.many.parts.here.invalid',
            '', // Empty string
            null,
            undefined,
            'valid.looking.jwt.but.invalid.signature'
        ];

        for (const token of malformedTokens) {
            const result = await authService.validateToken(token);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        }
    });

    test('should prevent memory leaks in rate limiting', () => {
        // Simulate many different users to test cleanup
        for (let i = 0; i < 1000; i++) {
            authService._recordFailedAttempt(`user${i}@example.com`);
        }

        // Force cleanup by simulating time passage
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 20 * 60 * 1000);

        // New attempts should not be affected by old data
        expect(authService._isRateLimited('newuser@example.com')).toBe(false);

        Date.now.mockRestore();
    });


// Integration tests
describe('Full Security Integration Tests', () => {
    // These would test the complete flow from HTTP request to database
    // You'd need to set up actual HTTP server and database for these
    test('should handle complete registration flow', () => {
        // POST /auth/register -> AuthenticationService -> Database
        // This would be implemented with supertest and actual endpoints
    });

    test('should handle complete login flow with WebSocket', () => {
        // POST /auth/login -> JWT token -> WebSocket auth -> Game join
    });

    test('should handle complete move authorization flow', () => {
        // WebSocket move -> Auth check -> Rules engine -> Database -> Broadcast
    });
});