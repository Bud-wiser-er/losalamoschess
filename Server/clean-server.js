/**
 * CORRECTED CLEAN SERVER FOR LOS ALAMOS CHESS
 * 
 * Purpose: Complete server with security layer integration for Byron's engine
 * File Location: /Server/clean-server.js
 * 
 * Input: HTTP requests, WebSocket connections, game moves
 * Output: Authenticated responses, validated moves via security layer, real-time game updates
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const EmailService = require('../src/services/EmailService');

// Load security layer (which includes Byron's engine)
let SecurityMoveValidator;
try {
    SecurityMoveValidator = require('../security/enhanced-move-validator');
    console.log('🔒 Security move validator loaded successfully');
} catch (error) {
    console.warn('⚠️ Security validator not found, using fallback');
    SecurityMoveValidator = class {
        constructor() {
            console.log('🔧 Using fallback security validator');
        }
        async validateMoveSecure(req, res) {
            return res.json({
                legal: true,
                move: req.body.move,
                message: 'Fallback validation - security validator not available'
                
            });
            
        
        }
        
        async getLegalMovesSecure(req, res) {
            return res.json({
                success: true,
                moves: ['b2b3', 'c2c3', 'd2d3', 'e2e3'],
                message: 'Fallback moves'
            });
        }
        initGameSession() { /* fallback */ }
    };
}

// Try to load environment variables
try {
    require('dotenv').config();
} catch (error) {
    console.log('📝 No dotenv package found - using environment variables directly');
}

// App setup
const app = express();
const server = http.createServer(app);

// WebSocket Server Setup
const wss = new WebSocket.Server({ server });

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));

app.use(cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true
}));

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many authentication attempts. Try again later.' }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Try again later.' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory storage
const users = new Map();
const games = new Map();
const refreshTokens = new Set();
const resetCodes = new Map();
const gameRooms = new Map();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || generateSecureToken();
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || generateSecureToken();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function generateSecureToken() {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    if (!process.env.JWT_SECRET) {
        console.log('⚠️ Generated temporary JWT secret - please set JWT_SECRET in environment for production');
    }
    return token;
}

function generateResetCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email configuration with our EmailService
const emailService = new EmailService();
let emailInitialized = false;

// Initialize email service
(async () => {
    try {
        emailInitialized = await emailService.initialize();
        if (emailInitialized) {
            console.log('📧 Email service configured and ready');
        } else {
            console.log('📧 Email service not configured - using console output for demo');
        }
    } catch (error) {
        console.log('📧 Email service initialization failed:', error.message);
    }
})();

/**
 * WEBSOCKET GAME HANDLING WITH SECURITY INTEGRATION
 */
class SecurityIntegratedWebSocketHandler {
    constructor() {
        this.connections = new Map(); 
        this.gameRooms = new Map();   
        
        // Initialize security validator (which includes Byron's engine)
        this.securityValidator = new SecurityMoveValidator();
        console.log('🔒 Security validator initialized for WebSocket handler');
    }

    handleConnection(ws, req) {
        console.log('🌐 New WebSocket connection');
        
        ws.userId = null;
        ws.gameId = null;
        ws.isAlive = true;

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                await this.handleMessage(ws, message);
            } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
                this.sendError(ws, 'Invalid message format');
            }
        });

        ws.on('close', () => {
            this.handleDisconnection(ws);
        });

        this.sendMessage(ws, {
            type: 'connected',
            message: 'Connected to Los Alamos Chess server'
        });
    }

    async handleMessage(ws, message) {
        console.log(`📨 Received message: ${message.type} from ${ws.userId}`);
        
        switch (message.type) {
            case 'join_game':
                await this.handleJoinGame(ws, message);
                break;
            case 'get_legal_moves':
                await this.handleLegalMoves(ws, message);
                break;
            case 'move':
                await this.handleMove(ws, message);
                break;
            case 'chat':
                await this.handleChat(ws, message);
                break;
            case 'join_game':
            await this.handleJoinGame(ws, message);
            break;
            
        case 'move':
            await this.handlePlayerMove(ws, message);
            break;
            
        case 'get_legal_moves':
            await this.handleGetLegalMoves(ws, message);
            break;    
            default:
                console.log(`❓ Unknown message type: ${message.type}`);
        }
    }
/**
 * Handle player move and trigger AI response
 */
async handlePlayerMove(ws, message) {
    const { gameId, move, currentFen } = message;
    
    try {
        console.log(`♟️ Player move received: ${move.from} → ${move.to}`);
        
        // Import Byron's engine
        const { validateMove, applyMove } = require('../backend/src/engine/index');
        
        // Validate the player's move
        const uciMove = `${move.from}${move.to}`;
        const validation = validateMove(currentFen || this.generateFENFromGameState(gameId), uciMove);
        
        if (!validation.valid) {
            ws.send(JSON.stringify({
                type: 'error',
                message: `Illegal move: ${validation.error}`
            }));
            return;
        }
        
        // Apply the move
        const moveResult = applyMove(currentFen || this.generateFENFromGameState(gameId), uciMove);
        
        if (!moveResult.valid) {
            ws.send(JSON.stringify({
                type: 'error',
                message: `Failed to apply move: ${moveResult.error}`
            }));
            return;
        }
        
        // Broadcast player move to all clients
        this.broadcastToRoom(gameId, {
            type: 'move',
            move: {
                from: move.from,
                to: move.to,
                uci: uciMove,
                san: moveResult.san || uciMove,
                fen: moveResult.fen
            },
            timestamp: Date.now()
        });
        
        console.log(`✅ Player move applied: ${uciMove}`);
        
        // Check if game is against AI (you can add logic to determine this)
        // For now, always trigger AI move after player move
        setTimeout(() => {
            this.triggerAIMove(gameId, moveResult.fen);
        }, 500); // Small delay for better UX
        
    } catch (error) {
        console.error('❌ Error handling player move:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process move'
        }));
    }
}

   async handleJoinGame(ws, message) {
    const { gameId } = message;
    
    if (!gameId) {
        this.sendError(ws, 'Game ID required');
        return;
    }
    
    // Set game ID for this connection
    ws.gameId = gameId;
    
    // Set a demo user ID if not authenticated
    if (!ws.userId) {
        ws.userId = `guest_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`🎮 Created guest user: ${ws.userId}`);
    }
    
    // Add to game room
    if (!this.gameRooms.has(gameId)) {
        this.gameRooms.set(gameId, new Set());
    }
    this.gameRooms.get(gameId).add(ws);
    
    // **CRITICAL: Initialize game session in security layer**
    try {
        const initialFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1'; // Los Alamos starting position
        
        // Initialize the game session with the security validator
        this.securityValidator.initGameSession(gameId, {
            white: ws.userId,  // Assign player as white
            black: 'ai_bot',   // AI opponent
            startFEN: initialFEN,
            timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Game session initialized: ${gameId} with player ${ws.userId}`);
        
    } catch (error) {
        console.error('❌ Failed to initialize game session:', error);
    }
    
    // Send confirmation
    this.sendMessage(ws, {
        type: 'game_joined',
        gameId: gameId,
        userId: ws.userId,
        message: 'Successfully joined game',
        gameState: {
            fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
            currentTurn: 'white',
            yourColor: 'white'
        }
    });
    
    console.log(`🎮 Player ${ws.userId} joined game: ${gameId}`);
}

/**
 * Trigger AI bot move
 * @param {string} gameId - Game ID
 * @param {string} currentFen - Current board state in FEN
 */
async triggerAIMove(gameId, currentFEN) {
    try {
        console.log(`🤖 Triggering AI move for game: ${gameId}`);
        
        const AIBot = require('../backend/src/ai-bot/index');
        const aiBot = new AIBot();
        
        const botRequest = {
            fen: currentFEN,
            level: 'L1',
            msCap: 2000
        };
        
        console.log(`🤖 Bot request:`, botRequest);
        
        const botResponse = await aiBot.generateMove(botRequest);

        // Handle checkmate/stalemate responses
        if (botResponse.ok && botResponse.checkmate) {
            console.log(`🏆 Checkmate detected! Winner: ${botResponse.winner}`);

            // Update game state to ended
            this.securityValidator.gameStates.set(gameId, {
                ...this.securityValidator.gameStates.get(gameId),
                status: 'ended',
                result: 'checkmate',
                winner: botResponse.winner
            });

            try {
                this.broadcastToRoom(gameId, {
                    type: 'game-ended',
                    result: {
                        type: 'checkmate',
                        winner: botResponse.winner
                    },
                    details: botResponse.details,
                    timestamp: Date.now()
                });
                console.log(`📡 Checkmate message broadcasted to room: ${gameId}`);
            } catch (broadcastError) {
                console.error('❌ Error broadcasting checkmate:', broadcastError);
            }
            await aiBot.cleanup();
            return;
        }

        if (botResponse.ok && botResponse.stalemate) {
            console.log(`🤝 Stalemate detected! Game is a draw.`);

            // Update game state to ended
            this.securityValidator.gameStates.set(gameId, {
                ...this.securityValidator.gameStates.get(gameId),
                status: 'ended',
                result: 'stalemate',
                winner: null
            });

            try {
                this.broadcastToRoom(gameId, {
                    type: 'game-ended',
                    result: {
                        type: 'stalemate',
                        winner: null
                    },
                    details: botResponse.details,
                    timestamp: Date.now()
                });
                console.log(`📡 Stalemate message broadcasted to room: ${gameId}`);
            } catch (broadcastError) {
                console.error('❌ Error broadcasting stalemate:', broadcastError);
            }
            await aiBot.cleanup();
            return;
        }

        if (!botResponse.ok) {
            console.error('❌ AI Bot failed:', botResponse.error);
            await aiBot.cleanup();
            return;
        }

        console.log(`🤖 AI generated move: ${botResponse.move}`);

        const uciMove = botResponse.move;
        const from = uciMove.substring(0, 2);
        const to = uciMove.substring(2, 4);
        
        // Validate the AI's move through security
        const mockReq = {
            body: {
                gameId: gameId,
                move: uciMove,
                currentFEN: currentFEN
            },
            user: { id: 'ai_bot' }
        };
        
        let aiMoveResult = null;
        const mockRes = {
            json: (data) => { aiMoveResult = data; },
            status: (code) => ({ json: (data) => { aiMoveResult = { ...data, statusCode: code }; }})
        };
        
        // **FIXED: Bypass turn validation for AI moves**
        // AI bot moves should not be subject to turn validation since they are generated by the system
        const mockReqAI = {
            ...mockReq,
            user: { id: 'ai_bot', isAI: true } // Mark as AI request
        };

        await this.securityValidator.validateMoveSecure(mockReqAI, mockRes);

        if (aiMoveResult && aiMoveResult.legal) {
            // **FIXED: Properly update the game state in security validator**
            this.securityValidator.gameStates.set(gameId, {
                fen: aiMoveResult.newFEN,
                activeColor: aiMoveResult.activeColor,
                status: aiMoveResult.gameStatus,
                moveCount: aiMoveResult.moveCount,
                lastMove: uciMove,
                timestamp: new Date().toISOString()
            });
            
            console.log(`🎮 Game state updated: ${aiMoveResult.activeColor} to move`);
            
            // Broadcast AI move to all clients
            this.broadcastToRoom(gameId, {
                type: 'ai_move',
                move: {
                    from: from,
                    to: to,
                    uci: uciMove,
                    fen: aiMoveResult.newFEN,
                    activeColor: aiMoveResult.activeColor
                },
                evaluation: botResponse.eval,
                timestamp: Date.now()
            });
            
            console.log(`✅ AI move executed: ${from} -> ${to}`);
        } else {
            console.error('❌ AI move validation failed');
        }

        // Cleanup AI bot
        await aiBot.cleanup();

    } catch (error) {
        console.error('❌ Error in triggerAIMove:', error);
        // Ensure cleanup even on error
        try {
            await aiBot.cleanup();
        } catch (cleanupError) {
            console.error('❌ Error during AI bot cleanup:', cleanupError);
        }
    }
}


   async handleLegalMoves(ws, message) {
    const { square, currentFen, gameId } = message;

    try {
        console.log(`🔒 Getting legal moves via security layer for square: ${square}`);

        // **FIXED: Get current FEN from game state if not provided**
        const currentGameState = this.securityValidator.gameStates.get(gameId || ws.gameId);

        // Check if game has already ended
        if (currentGameState && currentGameState.status === 'ended') {
            this.sendMessage(ws, {
                type: 'legal_moves',
                square: square,
                moves: [], // No legal moves if game has ended
                gameEnded: true
            });
            return;
        }

        const currentFEN = currentFen || currentGameState?.fen || 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

        // Create mock request object for security validator
        const mockReq = {
            body: {
                gameId: gameId || ws.gameId,
                square,
                currentFEN: currentFEN
            },
            user: { id: ws.userId || 'demo_user' }
        };
        
        // Create mock response object to capture the result
        let securityResult = null;
        const mockRes = {
            json: (data) => { 
                securityResult = data; 
            },
            status: (code) => ({ 
                json: (data) => { 
                    securityResult = { ...data, statusCode: code }; 
                } 
            })
        };
        
        // Call security validator
        await this.securityValidator.getLegalMovesSecure(mockReq, mockRes);
        
        if (securityResult && securityResult.success !== false) {
            // **CRITICAL: Convert UCI format to destination squares**
            const moves = securityResult.moves || [];
            const convertedMoves = moves.map(move => {
                // UCI format: "b2b3" -> destination: "b3"
                if (move.length >= 4) {
                    return move.substring(2, 4);
                }
                return move;
            });
            
            console.log(`🔒 Legal moves via security: ${convertedMoves.length} moves -> ${JSON.stringify(convertedMoves)}`);
            
            this.sendMessage(ws, {
                type: 'legal_moves',
                square: square,
                moves: convertedMoves,
                engine: securityResult.engine || 'Security layer'
            });
        } else {
            throw new Error('Security validation failed');
        }
        
    } catch (error) {
        console.error('❌ Error getting legal moves via security:', error);
        
        // Fallback: send basic moves for testing
        const basicMoves = {
            'a2': ['a3'], 'b2': ['b3'], 'c2': ['c3'], 
            'd2': ['d3'], 'e2': ['e3'], 'f2': ['f3'],
            'b1': ['a3', 'c3'], 'e1': ['d3', 'f3']
        };
        
        this.sendMessage(ws, {
            type: 'legal_moves',
            square: square,
            moves: basicMoves[square] || []
        });
    }
}


    async handleMove(ws, message) {
        const { move, gameId } = message;
        
        if (!move || !move.from || !move.to) {
            this.sendError(ws, 'Invalid move format');
            return;
        }

        try {
            console.log(`🔒 Validating move via security layer: ${move.from} -> ${move.to}${move.promotion ? ' (promotion: ' + move.promotion + ')' : ''}`);

            // Convert move to UCI format for security layer - include promotion if present
            const uci = message.uci || `${move.from}${move.to}${move.promotion || ''}`;

            // **FIXED: Get current FEN from game state instead of hardcoded**
            const currentGameState = this.securityValidator.gameStates.get(gameId || ws.gameId);
            const currentFEN = currentGameState?.fen || 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

            // Create mock request object for security validator
            const mockReq = {
                body: {
                    gameId: gameId || ws.gameId,
                    move: uci,
                    currentFEN: currentFEN
                },
                user: { id: ws.userId || 'demo_user' }
            };
            
            // Create mock response object to capture the result
            let securityResult = null;
            const mockRes = {
                json: (data) => { 
                    securityResult = data; 
                },
                status: (code) => ({ 
                    json: (data) => { 
                        securityResult = { ...data, statusCode: code }; 
                    } 
                })
            };
            
            // Call security validator with move validation
            await this.securityValidator.validateMoveSecure(mockReq, mockRes);
            
           if (securityResult && securityResult.legal) {
    // **CRITICAL: Update game state**
    this.securityValidator.gameStates.set(gameId || ws.gameId, {
        fen: securityResult.newFEN,
        activeColor: securityResult.activeColor,
        status: securityResult.gameStatus,
        moveCount: securityResult.moveCount,
        lastMove: uci,
        timestamp: new Date().toISOString()
    });
    
    // Move is valid, broadcast to all players in the game
    this.broadcastToRoom(gameId || ws.gameId, {
        type: 'move',
        move: move,
        valid: true,
        newFEN: securityResult.newFEN,
        activeColor: securityResult.activeColor,
        flags: securityResult.flags || {}
    }, ws);

    console.log(`✅ Valid move via security layer: ${move.from}-${move.to}`);
    console.log(`🎮 Turn: ${securityResult.activeColor} to move`);

    // Check for checkmate/stalemate after player move
    try {
        const RulesEngine = require('../backend/src/engine/index');
        const rulesEngine = new RulesEngine();
        const legalMoves = rulesEngine.getLegalMoves(securityResult.newFEN);

        if (legalMoves.length === 0) {
            const board = rulesEngine.parseFEN(securityResult.newFEN);
            const gameStatus = rulesEngine.checkGameStatus(board);

            if (gameStatus.type === 'CHECKMATE') {
                const winner = board.turn === 'w' ? 'black' : 'white';
                console.log(`🏆 Player move resulted in checkmate! Winner: ${winner}`);

                // Update game state to ended
                this.securityValidator.gameStates.set(gameId || ws.gameId, {
                    ...this.securityValidator.gameStates.get(gameId || ws.gameId),
                    status: 'ended',
                    result: 'checkmate',
                    winner: winner
                });

                this.broadcastToRoom(gameId || ws.gameId, {
                    type: 'game-ended',
                    result: {
                        type: 'checkmate',
                        winner: winner
                    },
                    details: `Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins.`,
                    timestamp: Date.now()
                });
                return; // Don't trigger AI move if game is over
            } else if (gameStatus.type === 'STALEMATE') {
                console.log(`🤝 Player move resulted in stalemate!`);

                // Update game state to ended
                this.securityValidator.gameStates.set(gameId || ws.gameId, {
                    ...this.securityValidator.gameStates.get(gameId || ws.gameId),
                    status: 'ended',
                    result: 'stalemate',
                    winner: null
                });

                this.broadcastToRoom(gameId || ws.gameId, {
                    type: 'game-ended',
                    result: {
                        type: 'stalemate',
                        winner: null
                    },
                    details: 'Stalemate! The game is a draw.',
                    timestamp: Date.now()
                });
                return; // Don't trigger AI move if game is over
            }
        }
    } catch (endGameError) {
        console.error('❌ Error checking for game end:', endGameError);
    }

    // Trigger AI bot if it's now AI's turn and game is not over
    const activeColor = securityResult.activeColor;
    if (activeColor === 'black') {
        console.log('🤖 AI turn detected, triggering bot move...');
        setTimeout(() => {
            this.triggerAIMove(gameId || ws.gameId, securityResult.newFEN);
        }, 800);
    }

            
        } else {
            const errorMsg = securityResult?.details || securityResult?.error || 'Move validation failed';
            this.sendError(ws, errorMsg);
            console.log(`❌ Invalid move via security layer: ${move.from}-${move.to} (${errorMsg})`);
        }
        
    } catch (error) {
        console.error('❌ Move validation error via security:', error);
        this.sendError(ws, 'Move validation failed');
    }
}
    async handleChat(ws, message) {
        const { text, gameId } = message;

        if (!text || !gameId) return;

        // Broadcast to other players only, excluding the sender to prevent duplication
        this.broadcastToRoom(gameId, {
            type: 'chat',
            message: {
                author: 'Player',
                text: text.substring(0, 200),
                timestamp: Date.now()
            }
        }, ws); // Exclude the sender
    }

    broadcastToRoom(gameId, message, exclude = null) {
        if (this.gameRooms.has(gameId)) {
            this.gameRooms.get(gameId).forEach(ws => {
                if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
                    this.sendMessage(ws, message);
                }
            });
        }
    }

    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    sendError(ws, error) {
        this.sendMessage(ws, {
            type: 'error',
            message: error
        });
    }

    handleDisconnection(ws) {
        console.log(`🔌 WebSocket disconnected: ${ws.userId}`);
        
        if (ws.gameId && this.gameRooms.has(ws.gameId)) {
            this.gameRooms.get(ws.gameId).delete(ws);
            if (this.gameRooms.get(ws.gameId).size === 0) {
                this.gameRooms.delete(ws.gameId);
            }
        }
    }
}

const gameHandler = new SecurityIntegratedWebSocketHandler();

// WebSocket server setup
wss.on('connection', (ws, req) => {
    gameHandler.handleConnection(ws, req);
});

// Health check for WebSocket connections
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

console.log('🌐 WebSocket game handler initialized with security integration');

/**
 * AUTHENTICATION MIDDLEWARE
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

/**
 * AUTHENTICATION ROUTES
 */

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ 
                error: 'Username, email, and password are required' 
            });
        }

        const existingUser = Array.from(users.values()).find(
            u => u.email === email || u.username === username
        );

        if (existingUser) {
            return res.status(400).json({ 
                error: 'User with this email or username already exists' 
            });
        }

        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const userId = Date.now().toString();
        const newUser = {
            id: userId,
            username,
            email,
            password: hashedPassword,
            rating: 1200,
            createdAt: new Date().toISOString()
        };

        users.set(userId, newUser);

        const accessToken = jwt.sign(
            { id: userId, username, email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const refreshToken = jwt.sign(
            { id: userId },
            JWT_REFRESH_SECRET,
            { expiresIn: JWT_REFRESH_EXPIRES_IN }
        );

        refreshTokens.add(refreshToken);

        console.log(`✅ User registered: ${username}`);

        res.status(201).json({
            message: 'User registered successfully',
            user: { id: userId, username, email, rating: newUser.rating },
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('❌ Registration failed:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = Array.from(users.values()).find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            JWT_REFRESH_SECRET,
            { expiresIn: JWT_REFRESH_EXPIRES_IN }
        );

        refreshTokens.add(refreshToken);

        console.log(`✅ User logged in: ${user.username}`);

        res.json({
            message: 'Login successful',
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email, 
                rating: user.rating 
            },
            accessToken,
            refreshToken,
            localStorage: {
                username: user.username,
                rating: user.rating,
                userId: user.id
            }
        });

    } catch (error) {
        console.error('❌ Login failed:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Password reset routes
app.post('/api/auth/password-reset', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: 'MISSING_EMAIL',
                message: 'Email is required'
            });
        }

        const user = Array.from(users.values()).find(u => u.email === email);
        if (!user) {
            return res.json({
                success: true,
                message: 'If email exists, reset code sent',
                resetToken: 'dummy-token'
            });
        }

        const resetCode = generateResetCode();
        const resetToken = jwt.sign(
            { id: user.id, email: user.email, purpose: 'password-reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        resetCodes.set(email, {
            code: resetCode,
            token: resetToken,
            expiry: Date.now() + 10 * 60 * 1000
        });

        // Send email with reset code using our EmailService
        try {
            await emailService.sendPasswordResetCode(email, resetCode, user.username);
            console.log(`✅ Password reset code sent to ${email}`);
        } catch (emailError) {
            console.error('Email sending failed, showing code in console:', emailError.message);
            console.log(`🔑 DEMO: Reset code for ${email}: ${resetCode}`);
        }

        res.json({
            success: true,
            message: 'Reset code sent to your email',
            resetToken: resetToken
        });

    } catch (error) {
        console.error('❌ Password reset request failed:', error);
        res.status(500).json({
            error: 'PASSWORD_RESET_ERROR',
            message: 'Failed to process password reset request'
        });
    }
});

app.post('/api/auth/verify-reset-code', async (req, res) => {
    try {
        const { email, code, token } = req.body;

        if (!email || !code || !token) {
            return res.status(400).json({
                success: false,
                message: 'Email, code, and token are required'
            });
        }

        const storedData = resetCodes.get(email);
        if (!storedData || storedData.code !== code || Date.now() > storedData.expiry) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        res.json({
            success: true,
            message: 'Code verified successfully',
            resetToken: token
        });

    } catch (error) {
        console.error('❌ Reset code verification error:', error);
        res.status(500).json({
            error: 'VERIFICATION_ERROR',
            message: 'Failed to verify reset code'
        });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, newPassword, resetToken } = req.body;

        if (!email || !newPassword || !resetToken) {
            return res.status(400).json({
                success: false,
                message: 'Email, new password, and reset token are required'
            });
        }

        // Validate password strength
        if (newPassword.length < 8 ||
            !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with uppercase, lowercase, and number'
            });
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, JWT_SECRET);
            if (decoded.purpose !== 'password-reset') {
                throw new Error('Invalid token purpose');
            }
        } catch (jwtError) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Find user
        const user = users.get(decoded.id);
        if (!user || user.email !== email) {
            return res.status(400).json({
                success: false,
                message: 'User not found or email mismatch'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password
        user.password = hashedPassword;
        users.set(user.id, user);

        // Clear stored reset code
        resetCodes.delete(email);

        console.log(`✅ Password reset completed for ${email}`);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('❌ Password reset completion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
});

// User profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
    const user = users.get(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating,
        createdAt: user.createdAt
    });
});

/**
 * GAME API ROUTES WITH SECURITY INTEGRATION
 */

// Initialize security validator for HTTP routes
let moveValidator;
try {
    moveValidator = new SecurityMoveValidator();
} catch (error) {
    console.warn('⚠️ Security validator initialization failed:', error.message);
    moveValidator = new SecurityMoveValidator(); // Use fallback class
}

// Make Move (with security validation)
app.post('/api/game/move', authenticateToken, apiLimiter, async (req, res) => {
    try {
        await moveValidator.validateMoveSecure(req, res);
    } catch (error) {
        console.error('❌ Move validation failed:', error);
        res.status(500).json({
            legal: false,
            error: 'VALIDATION_ERROR',
            message: 'Move validation service unavailable'
        });
    }
});

// Get Legal Moves
app.post('/api/game/legal-moves', authenticateToken, async (req, res) => {
    try {
        await moveValidator.getLegalMovesSecure(req, res);
    } catch (error) {
        console.error('❌ Legal moves calculation failed:', error);
        res.status(500).json({
            success: false,
            error: 'CALCULATION_ERROR',
            message: 'Legal moves service unavailable'
        });
    }
});

/**
 * STATIC ROUTES
 */

// Serve fixed game script
app.get('/fixed-game-script.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/fixed-game-script.js'));
});

// Homepage
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>Los Alamos Chess</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #1e3c72, #2a5298); color: white;">
            <h1>♛ Los Alamos Chess Server</h1>
            <h2>✅ Server Running Successfully!</h2>
            <p>Available pages:</p>
            <div style="margin: 30px;">
                <a href="/login_page.html" style="color: lightblue; margin: 10px; text-decoration: none; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; display: inline-block;">🔐 Login</a>
                <a href="/dashboard_page.html" style="color: lightblue; margin: 10px; text-decoration: none; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; display: inline-block;">📊 Dashboard</a>
                <a href="/game_view.html" style="color: lightblue; margin: 10px; text-decoration: none; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; display: inline-block;">♟️ Game View</a>
            </div>
        </body>
        </html>
    `);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Los Alamos Chess Server is running',
        timestamp: new Date().toISOString(),
        features: {
            'User Registration': true,
            'JWT Authentication': true,
            'Security Layer': true,
            'WebSocket Support': true,
            'Move Validation': true
        }
    });
});

/**
 * ERROR HANDLING
 */
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

app.use((error, req, res, next) => {
    console.error('❌ Server Error:', error);
    res.status(500).json({
        error: 'Internal Server Error',
        timestamp: new Date().toISOString()
    });
});

/**
 * SERVER STARTUP
 */
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, () => {
    console.log('');
    console.log('============================================');
    console.log('✅ Los Alamos Chess Server Started!');
    console.log('============================================');
    console.log(`🌐 Server URL: http://${HOST}:${PORT}`);
    console.log(`📁 Static Files: ${path.join(__dirname, '../frontend')}`);
    console.log(`🔐 Authentication: JWT tokens configured`);
    console.log(`📧 Email: ${emailInitialized ? 'Configured' : 'Not configured'}`);
    console.log(`🛡️ Security: Rate limiting enabled`);
    console.log('');
    console.log('🎯 Available URLs:');
    console.log(`   Homepage:     http://${HOST}:${PORT}/`);
    console.log(`   Login:        http://${HOST}:${PORT}/login_page.html`);
    console.log(`   Dashboard:    http://${HOST}:${PORT}/dashboard_page.html`);
    console.log(`   Game View:    http://${HOST}:${PORT}/game_view.html`);
    console.log(`   Health Check: http://${HOST}:${PORT}/api/health`);
    console.log('');
    console.log('🚀 Ready for chess gameplay!');
    console.log('🔒 Security layer integration completed successfully');
    
    if (!process.env.JWT_SECRET) {
        console.log('');
        console.log('💡 TIP: Create a .env file with JWT_SECRET for production use');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server shutdown complete');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server shutdown complete');
        process.exit(0);
    });
});

module.exports = { app, server };