// websocket-auth.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

class WebSocketAuthenticator {
    constructor(authService, config = {}) {
        this.authService = authService;
        this.config = {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            ...config
        };
        this.connectedUsers = new Map(); // userId -> socket mapping
        this.gameRooms = new Map(); // gameId -> Set of socketIds
    }

    /**
     * Initialize WebSocket server with authentication
     */
    initializeServer(httpServer) {
        const io = new Server(httpServer, this.config);

        // Authentication middleware
        io.use(async (socket, next) => {
            try {
                await this.authenticateSocket(socket);
                next();
            } catch (error) {
                next(new Error(error.message));
            }
        });

        // Connection handling
        io.on('connection', (socket) => {
            this.handleConnection(socket, io);
        });

        return io;
    }

    /**
     * Authenticate WebSocket connection
     */
    async authenticateSocket(socket) {
        try {
            // Try multiple token sources
            const token = 
                socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.split(' ')[1] ||
                socket.handshake.query.token;

            if (!token) {
                throw new Error('MISSING_TOKEN');
            }

            // Validate token
            const validation = await this.authService.validateToken(token);
            
            if (!validation.valid) {
                throw new Error('INVALID_TOKEN');
            }

            // Attach user to socket
            socket.user = validation.user;
            socket.userId = validation.user.id;

            console.log(`WebSocket: User ${socket.user.username} authenticated`);

        } catch (error) {
            console.error(`WebSocket auth failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handle new WebSocket connection
     */
    handleConnection(socket, io) {
        const user = socket.user;
        
        // Track connected user
        this.connectedUsers.set(user.id, socket);
        
        console.log(`User ${user.username} connected via WebSocket`);

        // Send welcome message
        socket.emit('connected', {
            message: 'Connected successfully',
            user: {
                id: user.id,
                username: user.username,
                rating: user.rating
            }
        });

        // Handle game joining
        socket.on('join-game', async (data) => {
            await this.handleJoinGame(socket, data, io);
        });

        // Handle move submission
        socket.on('move-intent', async (data) => {
            await this.handleMoveIntent(socket, data, io);
        });

        // Handle chat messages
        socket.on('chat-message', async (data) => {
            await this.handleChatMessage(socket, data, io);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });

        // Handle reconnection
        socket.on('reconnect', async () => {
            await this.handleReconnection(socket, io);
        });
    }

    /**
     * Handle user joining a game
     */
    async handleJoinGame(socket, data, io) {
        try {
            const { gameId, seat } = data;
            const user = socket.user;

            // Validate authorization
            if (!this.authService.authorize(user, 'game', 'join')) {
                socket.emit('error', {
                    code: 'FORBIDDEN',
                    message: 'Not authorized to join games'
                });
                return;
            }

            // Join socket room
            socket.join(gameId);
            
            // Track room membership
            if (!this.gameRooms.has(gameId)) {
                this.gameRooms.set(gameId, new Set());
            }
            this.gameRooms.get(gameId).add(socket.id);

            // Issue new token with seat binding if provided
            if (seat) {
                const gameToken = this.authService.issueJWT(user, { 
                    seat: seat,
                    gameId: gameId 
                });
                
                socket.emit('seat-assigned', {
                    seat: seat,
                    gameToken: gameToken
                });
            }

            // Notify other players
            socket.to(gameId).emit('player-joined', {
                user: {
                    id: user.id,
                    username: user.username,
                    rating: user.rating
                },
                seat: seat
            });

            // Send game snapshot (this would integrate with Byron's rules engine)
            socket.emit('game-snapshot', {
                gameId: gameId,
                // Game state would come from database/rules engine
                message: 'Joined game successfully'
            });

            console.log(`User ${user.username} joined game ${gameId} as ${seat || 'spectator'}`);

        } catch (error) {
            socket.emit('error', {
                code: 'JOIN_GAME_ERROR',
                message: error.message
            });
        }
    }

    /**
     * Handle move submission with authorization
     */
    async handleMoveIntent(socket, data, io) {
        try {
            const { gameId, uci } = data;
            const user = socket.user;

            // Validate move authorization
            if (!this.authService.authorize(user, 'game', 'move')) {
                socket.emit('error', {
                    code: 'FORBIDDEN',
                    message: 'Not authorized to make moves'
                });
                return;
            }

            // Additional validation: check if it's user's turn
            // This is where Byron's integration would happen
            // const gameState = await rulesEngine.getGameState(gameId);
            // if (gameState.currentTurn !== user.seat) {
            //     socket.emit('error', { code: 'WRONG_TURN' });
            //     return;
            // }

            // Rate limiting check
            if (this.isMoveLimited(user.id)) {
                socket.emit('error', {
                    code: 'TOO_MANY_MOVES',
                    message: 'Please slow down your move submissions'
                });
                return;
            }

            // Broadcast move to game room
            io.to(gameId).emit('move-received', {
                gameId: gameId,
                uci: uci,
                by: user.username,
                timestamp: new Date().toISOString()
            });

            console.log(`Move ${uci} submitted by ${user.username} in game ${gameId}`);

        } catch (error) {
            socket.emit('error', {
                code: 'MOVE_ERROR',
                message: error.message
            });
        }
    }

    /**
     * Handle chat messages with sanitization
     */
    async handleChatMessage(socket, data, io) {
        try {
            const { gameId, message } = data;
            const user = socket.user;

            // Rate limiting for chat
            if (this.isChatLimited(user.id)) {
                socket.emit('error', {
                    code: 'CHAT_LIMITED',
                    message: 'Please slow down your messages'
                });
                return;
            }

            // Sanitize message (XSS prevention)
            const sanitizedMessage = this.sanitizeMessage(message);

            // Broadcast to game room
            io.to(gameId).emit('chat-message', {
                gameId: gameId,
                user: {
                    id: user.id,
                    username: user.username
                },
                message: sanitizedMessage,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            socket.emit('error', {
                code: 'CHAT_ERROR',
                message: error.message
            });
        }
    }

    /**
     * Handle user disconnection
     */
    handleDisconnection(socket) {
        const user = socket.user;
        
        // Remove from connected users
        this.connectedUsers.delete(user.id);
        
        // Remove from game rooms
        for (const [gameId, socketIds] of this.gameRooms.entries()) {
            if (socketIds.has(socket.id)) {
                socketIds.delete(socket.id);
                
                // Notify other players
                socket.to(gameId).emit('player-disconnected', {
                    user: {
                        id: user.id,
                        username: user.username
                    }
                });
                
                // Clean up empty rooms
                if (socketIds.size === 0) {
                    this.gameRooms.delete(gameId);
                }
            }
        }
        
        console.log(`User ${user.username} disconnected`);
    }

    /**
     * Handle user reconnection
     */
    async handleReconnection(socket, io) {
        const user = socket.user;
        
        // Re-authenticate on reconnection
        try {
            const validation = await this.authService.validateToken(
                socket.handshake.auth.token
            );
            
            if (!validation.valid) {
                socket.emit('error', { code: 'REAUTHENTICATION_REQUIRED' });
                socket.disconnect();
                return;
            }

            // Send fresh state
            socket.emit('reconnected', {
                message: 'Reconnected successfully',
                user: validation.user
            });

        } catch (error) {
            socket.emit('error', { code: 'RECONNECTION_FAILED' });
            socket.disconnect();
        }
    }

    /**
     * Simple rate limiting for moves (10 per 5 seconds)
     */
    isMoveLimited(userId) {
        const now = Date.now();
        if (!this.moveAttempts) this.moveAttempts = new Map();
        
        const userAttempts = this.moveAttempts.get(userId) || [];
        const recentAttempts = userAttempts.filter(time => now - time < 5000);
        
        this.moveAttempts.set(userId, recentAttempts);
        
        if (recentAttempts.length >= 10) {
            return true;
        }
        
        recentAttempts.push(now);
        return false;
    }

    /**
     * Simple rate limiting for chat (2 per second)
     */
    isChatLimited(userId) {
        const now = Date.now();
        if (!this.chatAttempts) this.chatAttempts = new Map();
        
        const userAttempts = this.chatAttempts.get(userId) || [];
        const recentAttempts = userAttempts.filter(time => now - time < 1000);
        
        this.chatAttempts.set(userId, recentAttempts);
        
        if (recentAttempts.length >= 2) {
            return true;
        }
        
        recentAttempts.push(now);
        return false;
    }

    /**
     * Sanitize chat messages
     */
sanitizeMessage(message) {
    if (typeof message !== 'string') return '';
    
    return message
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript\s*:\s*[^"'\s]*/gi, '') // Remove entire javascript: protocol
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^"'\s>]*/gi, '')
        .substring(0, 500);
}
    /**
     * Get connected users for a game
     */
    getGameConnections(gameId) {
        const socketIds = this.gameRooms.get(gameId) || new Set();
        return Array.from(socketIds);
    }

    /**
     * Send message to specific user
     */
    sendToUser(userId, event, data) {
        const socket = this.connectedUsers.get(userId);
        if (socket) {
            socket.emit(event, data);
            return true;
        }
        return false;
    }

    /**
     * Broadcast to all users in a game
     */
    broadcastToGame(gameId, event, data, io) {
        io.to(gameId).emit(event, data);
    }
}

module.exports = WebSocketAuthenticator;