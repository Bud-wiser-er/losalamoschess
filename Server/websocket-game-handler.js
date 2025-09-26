/**
 * WEBSOCKET GAME HANDLER
 * 
 * Purpose: Handle real-time chess game communication via WebSocket
 * Integrates: Game engine, database, security validation, move authorization
 * 
 * Input: WebSocket messages (moves, chat, game events)
 * Output: Validated game updates, real-time notifications
 * 
 * File Location: /Server/websocket-game-handler.js
 */

const WebSocket = require('ws');
const GameDatabaseManager = require('./game-database');
const { validateMove } = require('../security/enhanced-move-validator');
const { authorizeGameAction } = require('../security/move-authorization');

class WebSocketGameHandler {
    constructor(server, dbConfig) {
        this.wss = new WebSocket.Server({ server });
        this.gameRooms = new Map(); // gameId -> Set of WebSocket connections
        this.userSockets = new Map(); // userId -> WebSocket connection
        this.db = new GameDatabaseManager(dbConfig);
        
        this.setupWebSocketServer();
        console.log('🌐 WebSocket game handler initialized');
    }

    /**
     * Setup WebSocket server and event handlers
     */
    setupWebSocketServer() {
        this.wss.on('connection', (ws, req) => {
            console.log('🔌 New WebSocket connection');
            
            // Parse user info from connection (you might get this from JWT token)
            ws.userId = this.extractUserIdFromRequest(req);
            ws.gameId = null;
            ws.isAlive = true;
            
            // Store user socket
            if (ws.userId) {
                this.userSockets.set(ws.userId, ws);
            }
            
            // Setup ping/pong for connection health
            ws.on('pong', () => {
                ws.isAlive = true;
            });
            
            // Handle incoming messages
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleMessage(ws, message);
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });
            
            // Handle connection close
            ws.on('close', () => {
                this.handleDisconnection(ws);
            });
            
            // Send welcome message
            this.sendMessage(ws, {
                type: 'connected',
                message: 'Connected to Los Alamos Chess server'
            });
        });
        
        // Setup connection health check
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) {
                    ws.terminate();
                    return;
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // Check every 30 seconds
    }
/**
 * Set Byron's engine reference
 * @param {Object} engine - Byron's rules engine
 */
setByronEngine(engine) {
    this.byronEngine = engine;
}
    /**
     * Extract user ID from WebSocket request
     * @param {Object} req - HTTP request object
     * @returns {string|null} User ID
     */
    extractUserIdFromRequest(req) {
        // In a real implementation, you'd extract this from JWT token
        // For now, we'll use a simple header or query parameter
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            // Parse JWT token here
            // return jwt.verify(token, secret).userId;
        }
        
        // Fallback: use query parameter for demo
        const url = new URL(req.url, `http://${req.headers.host}`);
        return url.searchParams.get('userId') || null;
    }

    /**
     * Handle incoming WebSocket message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Parsed message object
     */
    async handleMessage(ws, message) {
        console.log(`📨 Received message: ${message.type} from ${ws.userId}`);
        
        switch (message.type) {
            case 'join_game':
                await this.handleJoinGame(ws, message);
                break;
            case 'move':
                await this.handleMove(ws, message);
                break;
            case 'chat':
                await this.handleChat(ws, message);
                break;
            case 'offer_draw':
                await this.handleDrawOffer(ws, message);
                break;
            case 'resign':
                await this.handleResign(ws, message);
                break;
            case 'request_game_state':
                await this.handleGameStateRequest(ws, message);
                break;
            case 'get_legal_moves':
                await this.handleLegalMovesRequest(ws, message);
                break;
            case 'legal_moves':
            handleLegalMovesResponse(data);
            break;
            default:
                console.log(`❓ Unknown message type: ${message.type}`);
                this.sendError(ws, 'Unknown message type');
        }
        
    }
    async handleLegalMovesResponse(data) {
    gameState.legalMoves = data.moves || [];
    highlightLegalMoves();
    }
    /**
 * Handle legal moves request using Byron's engine
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Legal moves request
 */
    async handleLegalMovesRequest(ws, message) {
        const { gameId, square, currentFen } = message;
        
        try {
            // Import Byron's engine if not already imported
            const { validateMove, getLegalMoves } = require('../backend/src/engine/index');
            
            // Get legal moves from Byron's engine
            const legalMoves = await getLegalMoves(currentFen, square);
            
            this.sendMessage(ws, {
                type: 'legal_moves',
                square: square,
                moves: legalMoves
            });
            
            console.log(`🎯 Legal moves calculated for ${square}: ${legalMoves.length} moves`);
            
        } catch (error) {
            console.error('❌ Error getting legal moves:', error);
            this.sendError(ws, 'Failed to calculate legal moves');
        }
    }
    /**
     * Handle player joining a game
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Join game message
     */
    async handleJoinGame(ws, message) {
        const { gameId } = message;
        
        if (!gameId) {
            this.sendError(ws, 'Game ID required');
            return;
        }
        
        // Get game from database
        const gameResult = await this.db.getGame(gameId);
        if (!gameResult.success) {
            this.sendError(ws, 'Game not found');
            return;
        }
        
        const game = gameResult.game;
        
        // Check if user is authorized to join this game
        if (ws.userId && 
            game.white_player_id !== ws.userId && 
            game.black_player_id !== ws.userId &&
            game.black_player_id !== null) { // Allow joining AI games
            this.sendError(ws, 'Not authorized to join this game');
            return;
        }
        
        // Leave previous game room if any
        if (ws.gameId) {
            this.leaveGameRoom(ws, ws.gameId);
        }
        
        // Join new game room
        ws.gameId = gameId;
        this.joinGameRoom(ws, gameId);
        
        // Send game state to player
        const moveHistory = await this.db.getMoveHistory(gameId);
        
        this.sendMessage(ws, {
            type: 'game_joined',
            gameId: gameId,
            game: game,
            moveHistory: moveHistory.success ? moveHistory.moves : []
        });
        
        // Notify other players in the room
        this.broadcastToRoom(gameId, {
            type: 'player_joined',
            userId: ws.userId,
            username: game.white_player_id === ws.userId ? game.white_username : game.black_username
        }, ws);
        
        console.log(`🎮 Player ${ws.userId} joined game ${gameId}`);
    }

    /**
     * Handle chess move
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Move message
     */
    async handleMove(ws, message) {
        const { gameId, move } = message;
        
        if (!gameId || !move) {
            this.sendError(ws, 'Game ID and move required');
            return;
        }
        
        // Get current game state
        const gameResult = await this.db.getGame(gameId);
        if (!gameResult.success) {
            this.sendError(ws, 'Game not found');
            return;
        }
        
        const game = gameResult.game;
        
        // Check if it's the player's turn
        const moveHistory = await this.db.getMoveHistory(gameId);
        const currentPly = moveHistory.success ? moveHistory.moves.length + 1 : 1;
        const isWhiteTurn = currentPly % 2 === 1;
        const playerColor = game.white_player_id === ws.userId ? 'white' : 'black';
        
        if ((isWhiteTurn && playerColor !== 'white') || (!isWhiteTurn && playerColor !== 'black')) {
            this.sendError(ws, 'Not your turn');
            return;
        }
        
        // Authorize the move
        const authResult = await authorizeGameAction(ws.userId, gameId, 'move', {
            from: move.from,
            to: move.to,
            currentFen: game.fen
        });
        
        if (!authResult.authorized) {
            this.sendError(ws, authResult.reason || 'Move not authorized');
            await this.db.logAuditEvent('UNAUTHORIZED_MOVE_ATTEMPT', ws.userId, {
                gameId,
                move,
                reason: authResult.reason
            });
            return;
        }
        
        // Validate the move using the engine
        const moveValidation = await validateMove(game.fen, move.from, move.to);
        
        if (!moveValidation.valid) {
            this.sendError(ws, moveValidation.reason || 'Invalid move');
            return;
        }
        
        // Convert move to UCI and SAN notation
        const uci = `${move.from}${move.to}`;
        const san = this.moveToSAN(move, moveValidation); // You'd implement this
        
        // Add move to database
        const moveResult = await this.db.addMove(
            gameId,
            currentPly,
            'human',
            uci,
            san,
            moveValidation.flags || {},
            game.fen,
            moveValidation.resultingFen,
            message.timeSpent || 0
        );
        
        if (!moveResult.success) {
            this.sendError(ws, 'Failed to save move');
            return;
        }
        
        // Update game timers
        const timeSpent = message.timeSpent || 1000; // Default 1 second
        if (playerColor === 'white') {
            game.white_clock_ms -= timeSpent;
        } else {
            game.black_clock_ms -= timeSpent;
        }
        
        await this.db.updateGameTimers(gameId, game.white_clock_ms, game.black_clock_ms);
        
        // Broadcast move to all players in the room
        this.broadcastToRoom(gameId, {
            type: 'move',
            move: {
                from: move.from,
                to: move.to,
                san: san,
                ply: currentPly,
                flags: moveValidation.flags || {}
            },
            gameState: {
                fen: moveValidation.resultingFen,
                currentPlayer: isWhiteTurn ? 'black' : 'white',
                whiteTime: game.white_clock_ms,
                blackTime: game.black_clock_ms
            }
        });
        
        // Check for game end conditions
        if (moveValidation.flags && (moveValidation.flags.checkmate || moveValidation.flags.stalemate)) {
            await this.handleGameEnd(gameId, moveValidation.flags);
        }
        
        // If playing against AI, trigger AI move
        if (game.black_player_id === null && playerColor === 'white') {
            setTimeout(() => this.triggerAIMove(gameId, moveValidation.resultingFen), 1000);
        }
        
        console.log(`♟️ Move played: ${gameId} - ${currentPly}. ${san}`);
    }

    /**
     * Handle chat message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Chat message
     */
    async handleChat(ws, message) {
        const { gameId, text } = message;
        
        if (!gameId || !text) {
            this.sendError(ws, 'Game ID and message text required');
            return;
        }
        
        // Get user info
        const userResult = await this.db.getUserProfile(ws.userId);
        if (!userResult.success) {
            this.sendError(ws, 'User not found');
            return;
        }
        
        // Broadcast chat message to room
        this.broadcastToRoom(gameId, {
            type: 'chat',
            message: {
                author: userResult.user.username,
                text: text.substring(0, 200), // Limit message length
                timestamp: Date.now()
            }
        });
        
        console.log(`💬 Chat message: ${gameId} - ${userResult.user.username}: ${text}`);
    }

    /**
     * Handle draw offer
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Draw offer message
     */
    async handleDrawOffer(ws, message) {
        const { gameId } = message;
        
        this.broadcastToRoom(gameId, {
            type: 'draw_offer',
            fromUserId: ws.userId
        }, ws);
        
        console.log(`🤝 Draw offer: ${gameId} from ${ws.userId}`);
    }

    /**
     * Handle resignation
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Resign message
     */
    async handleResign(ws, message) {
        const { gameId } = message;
        
        // Get game to determine winner
        const gameResult = await this.db.getGame(gameId);
        if (gameResult.success) {
            const game = gameResult.game;
            const winnerId = game.white_player_id === ws.userId ? 
                game.black_player_id : game.white_player_id;
            
            await this.db.endGame(gameId, 'RESIGNED', winnerId);
        }
        
        this.broadcastToRoom(gameId, {
            type: 'game_ended',
            reason: 'resignation',
            resignedUserId: ws.userId
        });
        
        console.log(`🏳️ Resignation: ${gameId} by ${ws.userId}`);
    }

    /**
     * Join a game room
     * @param {WebSocket} ws - WebSocket connection
     * @param {string} gameId - Game ID
     */
    joinGameRoom(ws, gameId) {
        if (!this.gameRooms.has(gameId)) {
            this.gameRooms.set(gameId, new Set());
        }
        this.gameRooms.get(gameId).add(ws);
    }

    /**
     * Leave a game room
     * @param {WebSocket} ws - WebSocket connection
     * @param {string} gameId - Game ID
     */
    leaveGameRoom(ws, gameId) {
        if (this.gameRooms.has(gameId)) {
            this.gameRooms.get(gameId).delete(ws);
            if (this.gameRooms.get(gameId).size === 0) {
                this.gameRooms.delete(gameId);
            }
        }
    }

    /**
     * Broadcast message to all clients in a game room
     * @param {string} gameId - Game ID
     * @param {Object} message - Message to broadcast
     * @param {WebSocket} exclude - WebSocket to exclude from broadcast
     */
    broadcastToRoom(gameId, message, exclude = null) {
        if (this.gameRooms.has(gameId)) {
            this.gameRooms.get(gameId).forEach(ws => {
                if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
                    this.sendMessage(ws, message);
                }
            });
        }
    }

    /**
     * Send message to specific WebSocket
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message to send
     */
    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Send error message to WebSocket
     * @param {WebSocket} ws - WebSocket connection
     * @param {string} error - Error message
     */
    sendError(ws, error) {
        this.sendMessage(ws, {
            type: 'error',
            message: error
        });
    }

    /**
     * Handle WebSocket disconnection
     * @param {WebSocket} ws - WebSocket connection
     */
    handleDisconnection(ws) {
        console.log(`🔌 WebSocket disconnected: ${ws.userId}`);
        
        // Remove from user sockets
        if (ws.userId) {
            this.userSockets.delete(ws.userId);
        }
        
        // Leave game room
        if (ws.gameId) {
            this.leaveGameRoom(ws, ws.gameId);
            
            // Notify other players
            this.broadcastToRoom(ws.gameId, {
                type: 'player_disconnected',
                userId: ws.userId
            });
        }
    }

    /**
     * Convert move to SAN notation (simplified)
     * @param {Object} move - Move object
     * @param {Object} validation - Move validation result
     * @returns {string} SAN notation
     */
    moveToSAN(move, validation) {
        // This is a simplified implementation
        // In a real chess engine, you'd need proper SAN conversion
        let san = `${move.from}-${move.to}`;
        
        if (validation.flags?.capture) {
            san += 'x';
        }
        if (validation.flags?.check) {
            san += '+';
        }
        if (validation.flags?.checkmate) {
            san += '#';
        }
        
        return san;
    }

    /**
     * Trigger AI move (simplified)
     * @param {string} gameId - Game ID
     * @param {string} fen - Current FEN position
     */
    async triggerAIMove(gameId, fen) {
        // This would integrate with your AI engine
        // For now, just make a random legal move
        console.log(`🤖 AI thinking for game ${gameId}...`);
        
        // Simulate AI move after delay
        setTimeout(async () => {
            // In real implementation, call your AI engine here
            const aiMove = this.getRandomLegalMove(fen); // You'd implement this
            
            if (aiMove) {
                // Process AI move similar to human move
                const moveHistory = await this.db.getMoveHistory(gameId);
                const currentPly = moveHistory.success ? moveHistory.moves.length + 1 : 1;
                
                await this.db.addMove(
                    gameId,
                    currentPly,
                    'bot',
                    `${aiMove.from}${aiMove.to}`,
                    this.moveToSAN(aiMove, { flags: {} }),
                    {},
                    fen,
                    'rnqknr/pppppp/6/6/PPPPPP/RNQKNR b - - 0 1', // You'd calculate this
                    500 // AI thinks for 500ms
                );
                
                this.broadcastToRoom(gameId, {
                    type: 'move',
                    move: {
                        from: aiMove.from,
                        to: aiMove.to,
                        san: this.moveToSAN(aiMove, { flags: {} }),
                        ply: currentPly,
                        flags: {}
                    },
                    gameState: {
                        fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 2',
                        currentPlayer: 'white'
                    }
                });
            }
        }, 1000);
    }

    /**
     * Get random legal move (placeholder for AI)
     * @param {string} fen - Current position
     * @returns {Object|null} Random legal move
     */
    getRandomLegalMove(fen) {
        // Placeholder - return a random move for demo
        const moves = [
            { from: 'e5', to: 'e4' },
            { from: 'd5', to: 'd4' },
            { from: 'c5', to: 'c4' }
        ];
        return moves[Math.floor(Math.random() * moves.length)];
    }
}

module.exports = WebSocketGameHandler;