// move-authorization.js
// This shows how your security integrates with Byron's rules engine

class MoveAuthorizationService {
    constructor(authService, rulesEngine, databaseService) {
        this.authService = authService;
        this.rulesEngine = rulesEngine;
        this.db = databaseService;
    }

    /**
     * Complete move validation with security checks
     * This is called BEFORE Byron's rules engine
     */
    async validateAndProcessMove(gameId, uci, user, requestSource = 'websocket') {
        try {
            // STEP 1: Security Authorization Checks (YOUR RESPONSIBILITY)
            await this.validateMoveAuthorization(gameId, user);

            // STEP 2: Get current game state
            const gameState = await this.db.getGameState(gameId);

            // STEP 3: Validate user's turn (YOUR RESPONSIBILITY)
            this.validateUserTurn(gameState, user);

            // STEP 4: Rate limiting check (YOUR RESPONSIBILITY)
            this.checkRateLimit(user.id, requestSource);

            // STEP 5: Byron's Rules Engine Validation
            const moveValidation = await this.rulesEngine.validateMove(
                gameState.fen, 
                uci
            );

            if (!moveValidation.legal) {
                throw new Error(`ILLEGAL_MOVE: ${moveValidation.error}`);
            }

            // STEP 6: Apply move using Byron's engine
            const moveResult = await this.rulesEngine.applyMove(
                gameState.fen,
                uci
            );

            // STEP 7: Security audit logging (YOUR RESPONSIBILITY)
            await this.logMoveAttempt(gameId, user, uci, 'SUCCESS', moveResult);

            return {
                success: true,
                gameId,
                move: {
                    uci,
                    san: moveResult.san,
                    flags: moveResult.flags
                },
                nextFen: moveResult.nextFen,
                gameStatus: moveResult.flags.state
            };

        } catch (error) {
            // Log failed attempts for security monitoring
            await this.logMoveAttempt(gameId, user, uci, 'FAILED', { error: error.message });
            throw error;
        }
    }

    /**
     * STEP 1: Validate move authorization
     */
    async validateMoveAuthorization(gameId, user) {
        // Check basic game move permission
        if (!this.authService.authorize(user, 'game', 'move')) {
            throw new Error('FORBIDDEN: No move permission');
        }

        // Check if user is actually in this game
        const gameParticipants = await this.db.getGameParticipants(gameId);
        const isParticipant = gameParticipants.some(p => p.userId === user.id);
        
        if (!isParticipant) {
            throw new Error('FORBIDDEN: Not a participant in this game');
        }

        // Check if game is still active
        const gameState = await this.db.getGameState(gameId);
        if (gameState.status !== 'active') {
            throw new Error('GAME_NOT_ACTIVE: Game has ended');
        }
    }

    /**
     * STEP 3: Validate it's the user's turn
     */
    validateUserTurn(gameState, user) {
        // Get user's seat (white/black) from their JWT token
        const userSeat = user.seat;
        
        if (!userSeat) {
            throw new Error('NO_SEAT: User not seated in this game');
        }

        // Check if it's this user's turn to move
        if (gameState.toMove !== userSeat) {
            throw new Error('WRONG_TURN: Not your turn to move');
        }

        // Additional check: ensure user is still seated (not replaced/kicked)
        const currentSeating = gameState.players;
        const currentPlayer = currentSeating.find(p => p.seat === userSeat);
        
        if (!currentPlayer || currentPlayer.userId !== user.id) {
            throw new Error('SEAT_CHANGED: No longer seated in this position');
        }
    }

    /**
     * STEP 4: Rate limiting for moves
     */
    checkRateLimit(userId, source) {
        const now = Date.now();
        const limits = {
            websocket: { maxMoves: 10, windowMs: 5000 }, // 10 moves per 5 seconds
            rest: { maxMoves: 5, windowMs: 5000 }        // 5 moves per 5 seconds
        };

        const limit = limits[source] || limits.websocket;

        if (!this.moveAttempts) {
            this.moveAttempts = new Map();
        }

        const userAttempts = this.moveAttempts.get(userId) || [];
        const recentAttempts = userAttempts.filter(
            time => now - time < limit.windowMs
        );

        if (recentAttempts.length >= limit.maxMoves) {
            throw new Error('RATE_LIMITED: Too many move attempts');
        }

        recentAttempts.push(now);
        this.moveAttempts.set(userId, recentAttempts);
    }

    /**
     * STEP 7: Security audit logging
     */
    async logMoveAttempt(gameId, user, uci, status, details) {
        await this.db.createAuditLog({
            action: 'MOVE_ATTEMPT',
            userId: user.id,
            metadata: {
                gameId,
                uci,
                status,
                userSeat: user.seat,
                username: user.username,
                details: details
            },
            timestamp: new Date()
        });
    }

    /**
     * Bot move authorization (different from human moves)
     */
    async validateBotMove(gameId, botLevel, requestingUser) {
        // Only admins or game participants can request bot moves
        if (!this.authService.authorize(requestingUser, 'game', 'bot-request')) {
            throw new Error('FORBIDDEN: Cannot request bot moves');
        }

        const gameState = await this.db.getGameState(gameId);
        
        // Ensure it's the bot's turn (bot should be seated)
        const botPlayer = gameState.players.find(p => p.isBot);
        if (!botPlayer || gameState.toMove !== botPlayer.seat) {
            throw new Error('WRONG_TURN: Not bot\'s turn');
        }

        return true;
    }

    /**
     * Spectator move validation (should always fail)
     */
    validateSpectatorMove(user) {
        if (user.roles.includes('spectator')) {
            throw new Error('FORBIDDEN: Spectators cannot make moves');
        }
    }
}

// Usage Example for Byron's integration:
class GameMoveHandler {
    constructor(moveAuthService, webSocketAuthenticator, databaseService) {
        this.moveAuth = moveAuthService;
        this.wsAuth = webSocketAuthenticator;
        this.db = databaseService;
    }

    /**
     * This is how the complete flow works when Ethan's WebSocket receives a move
     */
    async handleWebSocketMove(socket, data) {
        try {
            const { gameId, uci } = data;
            const user = socket.user; // From your WebSocket authentication

            // YOUR security validation + Byron's rules engine
            const moveResult = await this.moveAuth.validateAndProcessMove(
                gameId, 
                uci, 
                user, 
                'websocket'
            );

            // Save to database (Arno's responsibility)
            await this.db.saveMove(gameId, moveResult);

            // Broadcast to all players in the game
            this.wsAuth.broadcastToGame(gameId, 'move-applied', {
                gameId: gameId,
                move: moveResult.move,
                nextFen: moveResult.nextFen,
                gameStatus: moveResult.gameStatus,
                by: user.username
            });

            // Send confirmation to move maker
            socket.emit('move-confirmed', {
                success: true,
                move: moveResult.move
            });

        } catch (error) {
            // Send error back to user
            socket.emit('move-rejected', {
                error: error.message,
                gameId: data.gameId,
                uci: data.uci
            });
        }
    }

    /**
     * REST endpoint version (for HTTP API)
     */
    async handleRestMove(req, res) {
        try {
            const { gameId } = req.params;
            const { uci } = req.body;
            const user = req.user; // From your JWT middleware

            const moveResult = await this.moveAuth.validateAndProcessMove(
                gameId,
                uci,
                user,
                'rest'
            );

            await this.db.saveMove(gameId, moveResult);

            // Also broadcast via WebSocket if connected
            this.wsAuth.broadcastToGame(gameId, 'move-applied', {
                gameId: gameId,
                move: moveResult.move,
                nextFen: moveResult.nextFen,
                gameStatus: moveResult.gameStatus,
                by: user.username
            });

            res.json({
                success: true,
                move: moveResult.move,
                nextFen: moveResult.nextFen,
                gameStatus: moveResult.gameStatus
            });

        } catch (error) {
            const statusCode = this.getErrorStatusCode(error.message);
            res.status(statusCode).json({
                error: error.message,
                gameId: req.params.gameId
            });
        }
    }

    getErrorStatusCode(errorMessage) {
        if (errorMessage.includes('FORBIDDEN')) return 403;
        if (errorMessage.includes('WRONG_TURN')) return 409;
        if (errorMessage.includes('RATE_LIMITED')) return 429;
        if (errorMessage.includes('ILLEGAL_MOVE')) return 400;
        if (errorMessage.includes('GAME_NOT_ACTIVE')) return 409;
        return 400;
    }
}

module.exports = { MoveAuthorizationService, GameMoveHandler };