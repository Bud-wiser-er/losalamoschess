/**
 * =============================================================================
 * FIXED ENHANCED SECURITY MOVE VALIDATOR WITH BYRON'S ENGINE
 * =============================================================================
 * 
 * PURPOSE: Clean, error-free security integration with Byron's game engine
 * EXPECTED INPUT: Move requests with authentication
 * OUTPUT: Validated moves with security checks
 * 
 * Location: /security/enhanced-move-validator.js
 */

const crypto = require('crypto');
const path = require('path');

/**
 * Enhanced Move Validator with Byron's Game Engine Integration
 */
class SecurityMoveValidator {
    constructor() {
        this.moveHistory = new Map(); // gameId -> moves[]
        this.gameStates = new Map();  // gameId -> current state
        this.playerSessions = new Map(); // gameId -> {white: userId, black: userId}
        
        // Initialize Byron's Rules Engine
        try {
            const RulesEngine = require('../backend/src/engine/index');
            this.rulesEngine = new RulesEngine();
            this.engineAvailable = true;
            console.log('🎮 Byron\'s Rules Engine initialized successfully');
        } catch (error) {
            console.warn('⚠️ Byron\'s Rules Engine not available:', error.message);
            this.engineAvailable = false;
            this.rulesEngine = null;
        }
    }
/**
 * Get AI move using Byron's engine
 */
async getAIMoveSecure(req, res) {
    try {
        const { gameId, currentFEN, level = 'L1' } = req.body;
        const userId = req.user?.id;
        
        console.log('🤖 SecurityMoveValidator: Getting AI move from Byron\'s engine');
        
        if (!gameId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_DATA',
                details: 'Game ID required'
            });
        }

        // Get current position
        const position = currentFEN || this.getCurrentFEN(gameId);
        console.log(`🎯 AI analyzing position: ${position}`);
        
        if (this.engineAvailable && this.rulesEngine) {
            // Try getBestMove first
            if (this.rulesEngine.getBestMove) {
                const aiMove = this.rulesEngine.getBestMove(position, { 
                    level: level, 
                    msCap: 1000 
                });
                
                if (aiMove && aiMove.uci) {
                    console.log(`🤖 Byron's engine selected: ${aiMove.uci}`);
                    return res.json({
                        success: true,
                        move: aiMove.uci,
                        from: aiMove.uci.substring(0, 2),
                        to: aiMove.uci.substring(2, 4),
                        engine: 'Byron\'s Rules Engine',
                        level: level,
                        thinkTime: aiMove.thinkTime || 1000
                    });
                }
            }
            
            // Fallback: get all legal moves and pick one
            if (this.rulesEngine.getLegalMoves) {
                const legalMoves = this.rulesEngine.getLegalMoves(position);
                if (legalMoves && legalMoves.length > 0) {
                    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                    console.log(`🤖 Byron's engine picked random move: ${randomMove}`);
                    
                    return res.json({
                        success: true,
                        move: randomMove,
                        from: randomMove.substring(0, 2),
                        to: randomMove.substring(2, 4),
                        engine: 'Byron\'s Rules Engine (random)',
                        availableMoves: legalMoves.length
                    });
                }
            }
        }
        
        return res.status(500).json({
            success: false,
            error: 'NO_AI_MOVE',
            details: 'Byron\'s engine could not generate AI move'
        });
        
    } catch (error) {
        console.error('❌ AI move generation failed:', error);
        return res.status(500).json({
            success: false,
            error: 'AI_MOVE_ERROR',
            details: error.message
        });
    }
}
    /**
     * Validate move with full security and Byron's rules engine integration
     */
    async validateMoveSecure(req, res) {
        try {
            console.log('🔒 Security: Validating move with engine integration');
            
            // Extract and validate input data
            const { gameId, move, currentFEN } = req.body;
            const userId = req.user?.id;
            
            if (!gameId || !move || !userId) {
                return res.status(400).json({
                    legal: false,
                    error: 'MISSING_DATA',
                    details: 'Game ID, move, and authentication required'
                });
            }

            // 1. SECURITY: Verify player authorization
            const authResult = await this.verifyPlayerAuthorization(gameId, userId, move);
            if (!authResult.authorized) {
                return res.status(403).json({
                    legal: false,
                    error: 'UNAUTHORIZED',
                    details: authResult.reason
                });
            }

            // 2. Get current board position
            const currentBoard = currentFEN || this.getCurrentFEN(gameId);
            console.log(`🎯 Validating move: ${move} on position: ${currentBoard}`);
            
            // 3. BYRON'S ENGINE: Validate move if available
            if (this.engineAvailable && this.rulesEngine) {
                const engineValidation = this.rulesEngine.validateMove(currentBoard, move);
                
                if (!engineValidation.valid) {
                    console.log(`❌ Byron's engine rejected move: ${engineValidation.error}`);
                    return res.status(400).json({
                        legal: false,
                        error: engineValidation.error || 'INVALID_MOVE',
                        details: engineValidation.details || 'Move validation failed',
                        moveValidation: {
                            fromSquare: move.substring(0, 2),
                            toSquare: move.substring(2, 4),
                            reason: engineValidation.error
                        }
                    });
                }

                // Apply move using Byron's engine
                const moveResult = this.rulesEngine.applyMove(currentBoard, move);
                
                if (!moveResult || !moveResult.fen) {
                    console.log('❌ Byron\'s engine failed to apply move');
                    return res.status(500).json({
                        legal: false,
                        error: 'MOVE_APPLICATION_FAILED',
                        details: 'Failed to apply move to board state'
                    });
                }

                // Update game state with engine result
                const newGameState = this.updateGameStateWithEngineResult(gameId, move, moveResult);
                
                // Log move for audit trail
                await this.logMove(gameId, userId, move, newGameState);

                // Return successful result
                console.log('✅ Move validated and applied successfully with Byron\'s engine');
                
                return res.json({
                    legal: true,
                    move: move,
                    gameId: gameId,
                    newFEN: moveResult.fen,
                    gameStatus: moveResult.status || 'active',
                    activeColor: this.getActiveColorFromFEN(moveResult.fen),
                    moveCount: this.getMoveCountFromFEN(moveResult.fen),
                    capture: engineValidation.flags?.capture || false,
                    check: moveResult.flags?.check || false,
                    checkmate: moveResult.flags?.checkmate || false,
                    stalemate: moveResult.flags?.stalemate || false,
                    promotion: engineValidation.flags?.promotion || false,
                    flags: {
                        ...engineValidation.flags,
                        ...moveResult.flags
                    },
                    notation: this.generateMoveNotation(move, engineValidation, moveResult),
                    timestamp: new Date().toISOString(),
                    message: 'Move validated successfully with Byron\'s engine'
                });

            } else {
                // Fallback: Basic validation without Byron's engine
                console.log('⚠️ Using fallback validation (Byron\'s engine not available)');
                
                const basicValidation = this.validateMoveBasic(move, currentBoard);
                
                if (!basicValidation.valid) {
                    return res.status(400).json({
                        legal: false,
                        error: basicValidation.error,
                        details: basicValidation.details
                    });
                }

                // Create basic move result
                const newFEN = this.applyMoveBasic(move, currentBoard);
                const newGameState = {
                    fen: newFEN,
                    status: 'active',
                    activeColor: this.getActiveColorFromFEN(newFEN),
                    moveCount: this.getMoveCountFromFEN(newFEN),
                    flags: {},
                    lastMove: move,
                    timestamp: new Date().toISOString()
                };

                this.gameStates.set(gameId, newGameState);
                await this.logMove(gameId, userId, move, newGameState);

                console.log('✅ Move validated with basic validation');

                return res.json({
                    legal: true,
                    move: move,
                    gameId: gameId,
                    newFEN: newFEN,
                    gameStatus: 'active',
                    activeColor: this.getActiveColorFromFEN(newFEN),
                    moveCount: this.getMoveCountFromFEN(newFEN),
                    capture: false,
                    check: false,
                    checkmate: false,
                    stalemate: false,
                    promotion: false,
                    flags: {},
                    notation: `${move.substring(0, 2)}-${move.substring(2, 4)}`,
                    timestamp: new Date().toISOString(),
                    message: 'Move validated with basic validation (engine not available)'
                });
            }

        } catch (error) {
            console.error('❌ Security: Move validation failed:', error);
            return res.status(500).json({
                legal: false,
                error: 'VALIDATION_ERROR',
                details: 'Internal validation error',
                message: error.message
            });
        }
    }

    async getLegalMovesSecure(req, res) {
    try {
        const { gameId, square } = req.body;
        const userId = req.user?.id;
        
        if (!gameId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_DATA',
                details: 'Game ID and authentication required'
            });
        }

        // **REMOVED: Don't check authorization for viewing legal moves**
        // Users should be able to see what moves are possible even if not their turn

        // Get current position
        const currentFEN = this.getCurrentFEN(gameId);
        
        let moves = [];
        let totalLegalMoves = 0;
        
        if (this.engineAvailable && this.rulesEngine) {
            // Get all legal moves from Byron's engine
            const allLegalMoves = this.rulesEngine.getLegalMoves(currentFEN);
            totalLegalMoves = allLegalMoves.length;
            
            // Filter by square if provided
            if (square) {
                moves = allLegalMoves.filter(move => move.startsWith(square));
            } else {
                moves = allLegalMoves;
            }
        } else {
            // Fallback: Basic move generation
            moves = this.generateBasicLegalMoves(currentFEN, square);
            totalLegalMoves = moves.length;
        }

        return res.json({
            success: true,
            gameId: gameId,
            square: square || 'all',
            moves: moves,
            totalLegalMoves: totalLegalMoves,
            engine: this.engineAvailable ? 'Byron\'s engine' : 'Basic validation',
            message: `Legal moves calculated${this.engineAvailable ? ' with Byron\'s engine' : ''}`
        });
        
    } catch (error) {
        console.error('❌ Legal moves calculation error:', error);
        return res.status(500).json({
            success: false,
            error: 'CALCULATION_ERROR',
            details: error.message
        });
    }
}
 async verifyPlayerAuthorization(gameId, userId, move) {
    // Allow AI bot to move
    if (userId === 'ai_bot') {
        console.log('🤖 AI bot authorized to move');
        return { authorized: true, color: 'black' };
    }
    
    // Check if game session exists
    if (!this.playerSessions.has(gameId)) {
        console.warn(`⚠️ No session found for game: ${gameId}`);
        return {
            authorized: false,
            reason: 'Game session not found - please rejoin the game'
        };
    }
    
    const session = this.playerSessions.get(gameId);
    const gameState = this.gameStates.get(gameId);
    
    // Allow guest users (those starting with 'guest_')
    const isGuest = userId.startsWith('guest_');
    
    // Determine which color the user is playing
    const userColor = session.white === userId ? 'white' : 
                      session.black === userId ? 'black' : null;
    
    // For guests, auto-assign to white if not already assigned
    if (isGuest && !userColor && session.white.startsWith('guest_')) {
        console.log(`🎮 Guest ${userId} authorized as white player`);
        return { authorized: true, color: 'white' };
    }
    
    if (!userColor) {
        return {
            authorized: false,
            reason: 'You are not a player in this game'
        };
    }
    
    // Check if it's the user's turn
    const activeColor = gameState?.activeColor === 'w' ? 'white' : 'black';
    if (activeColor !== userColor) {
        return {
            authorized: false,
            reason: `Not your turn (${activeColor} to move)`
        };
    }
    
    return {
        authorized: true,
        color: userColor
    };
}

    /**
     * Update game state with Byron's engine result
     */
    updateGameStateWithEngineResult(gameId, move, engineResult) {
        try {
            const newGameState = {
                fen: engineResult.fen,
                status: engineResult.status || 'active',
                activeColor: this.getActiveColorFromFEN(engineResult.fen),
                moveCount: this.getMoveCountFromFEN(engineResult.fen),
                flags: engineResult.flags || {},
                lastMove: move,
                timestamp: new Date().toISOString()
            };
            
            // Update stored game state
            this.gameStates.set(gameId, newGameState);
            
            // Add move to history
            if (!this.moveHistory.has(gameId)) {
                this.moveHistory.set(gameId, []);
            }
            this.moveHistory.get(gameId).push({
                move: move,
                fen: engineResult.fen,
                timestamp: newGameState.timestamp,
                flags: engineResult.flags
            });
            
            return newGameState;
            
        } catch (error) {
            console.error('❌ Failed to update game state:', error);
            throw error;
        }
    }

    /**
     * Generate move notation (basic implementation)
     */
    generateMoveNotation(move, validation, result) {
        try {
            const from = move.substring(0, 2);
            const to = move.substring(2, 4);
            const promotion = move.length > 4 ? move.substring(4) : '';
            
            let notation = `${from}-${to}`;
            
            if (validation && validation.flags && validation.flags.capture) {
                notation += 'x';
            }
            
            if (promotion) {
                notation += `=${promotion.toUpperCase()}`;
            }
            
            if (result && result.flags) {
                if (result.flags.check) {
                    notation += '+';
                } else if (result.flags.checkmate) {
                    notation += '#';
                }
            }
            
            return notation;
            
        } catch (error) {
            console.error('❌ Move notation generation failed:', error);
            return move; // Fallback to UCI
        }
    }

    /**
     * Basic move validation (fallback when Byron's engine not available)
     */
    validateMoveBasic(move, fen) {
        try {
            if (!move || move.length < 4) {
                return {
                    valid: false,
                    error: 'INVALID_MOVE_FORMAT',
                    details: 'Move must be at least 4 characters (e.g., e2e4)'
                };
            }

            const fromSquare = move.substring(0, 2);
            const toSquare = move.substring(2, 4);

            // Validate square coordinates (Los Alamos: a1-f6)
            if (!this.isValidSquare(fromSquare) || !this.isValidSquare(toSquare)) {
                return {
                    valid: false,
                    error: 'INVALID_SQUARE',
                    details: 'Squares must be within a1-f6 range (Los Alamos board)'
                };
            }

            // Get piece at source square
            const piece = this.getPieceAtSquare(fen, fromSquare);
            if (!piece) {
                return {
                    valid: false,
                    error: 'NO_PIECE',
                    details: 'No piece found at source square'
                };
            }

            return { valid: true };
            
        } catch (error) {
            return {
                valid: false,
                error: 'VALIDATION_ERROR',
                details: error.message
            };
        }
    }

    /**
     * Basic move application (fallback when Byron's engine not available)
     */
    applyMoveBasic(move, fen) {
        try {
            // This is a very basic implementation - just switches the turn
            const parts = fen.split(' ');
            parts[1] = parts[1] === 'w' ? 'b' : 'w';
            
            // Increment move counter if it's white's turn after the move
            if (parts[1] === 'w') {
                parts[5] = (parseInt(parts[5]) + 1).toString();
            }
            
            return parts.join(' ');
            
        } catch (error) {
            console.error('❌ Basic move application failed:', error);
            return fen; // Return original FEN if failed
        }
    }

    /**
     * Generate basic legal moves (fallback)
     */
    generateBasicLegalMoves(fen, square) {
        // This is a very basic implementation
        // In a real scenario, you'd want proper move generation
        const basicMoves = [];
        
        if (square) {
            // Generate some basic moves for the square
            const file = square[0];
            const rank = parseInt(square[1]);
            
            // Add some basic pawn moves as examples
            if (rank < 6) {
                basicMoves.push(square + file + (rank + 1));
            }
            if (rank > 1) {
                basicMoves.push(square + file + (rank - 1));
            }
        } else {
            // Return some basic moves
            basicMoves.push('b2b3', 'c2c3', 'd2d3', 'e2e3');
        }
        
        return basicMoves;
    }

    /**
     * Get piece at square using simplified FEN parsing
     */
    getPieceAtSquare(fen, square) {
        try {
            if (!fen || !square || square.length !== 2) {
                return null;
            }

            const position = fen.split(' ')[0];
            const ranks = position.split('/');
            
            const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
            const rank = 6 - parseInt(square[1]); // Convert to array index (6 -> 0, 1 -> 5)
            
            if (rank < 0 || rank >= 6 || file < 0 || file >= 6) {
                return null;
            }
            
            // Parse the rank string to find piece at file
            const rankString = ranks[rank];
            if (!rankString) return null;
            
            let fileIndex = 0;
            
            for (const char of rankString) {
                if (char >= '1' && char <= '8') {
                    fileIndex += parseInt(char);
                } else {
                    if (fileIndex === file) {
                        const isWhite = char === char.toUpperCase();
                        const pieceType = this.getPieceType(char.toLowerCase());
                        return {
                            type: pieceType,
                            color: isWhite ? 'white' : 'black'
                        };
                    }
                    fileIndex++;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Get piece at square failed:', error);
            return null;
        }
    }

    /**
     * Map piece character to type
     */
    getPieceType(char) {
        const pieceMap = {
            'p': 'pawn',
            'r': 'rook',
            'n': 'knight',
            'q': 'queen',
            'k': 'king'
        };
        return pieceMap[char] || 'unknown';
    }

    /**
     * Check if square is valid for Los Alamos (a1-f6)
     */
    isValidSquare(square) {
        if (!square || square.length !== 2) return false;
        const file = square[0];
        const rank = square[1];
        return file >= 'a' && file <= 'f' && rank >= '1' && rank <= '6';
    }

    /**
     * Get active color from FEN
     */
    getActiveColorFromFEN(fen) {
        try {
            const parts = fen.split(' ');
            return parts[1] === 'w' ? 'white' : 'black';
        } catch (error) {
            return 'white'; // Default fallback
        }
    }

    /**
     * Get move count from FEN
     */
    getMoveCountFromFEN(fen) {
        try {
            const parts = fen.split(' ');
            return parseInt(parts[5]) || 1;
        } catch (error) {
            return 1; // Default fallback
        }
    }

    /**
 * Get current FEN for a game
 */
getCurrentFEN(gameId) {
    if (this.gameStates.has(gameId)) {
        return this.gameStates.get(gameId).fen;
    }
    
    // Return initial Los Alamos position as fallback
    console.warn(`⚠️ No FEN found for game ${gameId}, using initial position`);
    return 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
}

    /**
     * Security: Log move for audit trail
     */
    async logMove(gameId, userId, move, gameState) {
        try {
            const logEntry = {
                gameId,
                userId,
                move,
                gameState: gameState.fen,
                status: gameState.status,
                flags: gameState.flags,
                timestamp: new Date().toISOString(),
                hash: crypto.createHash('sha256').update(`${gameId}${userId}${move}${Date.now()}`).digest('hex')
            };
            
            console.log('📝 Move logged:', {
                gameId: logEntry.gameId,
                userId: logEntry.userId,
                move: logEntry.move,
                timestamp: logEntry.timestamp
            });
            
            // TODO: Store in database when available
            
        } catch (error) {
            console.error('❌ Move logging failed:', error);
        }
    }

   /**
 * Initialize a new game session
 */
initGameSession(gameId, sessionData) {
    console.log(`🎮 Initializing game session: ${gameId}`);
    
    // Store player session data
    this.playerSessions.set(gameId, {
        white: sessionData.white,
        black: sessionData.black || 'ai_bot',
        created: sessionData.timestamp || new Date().toISOString()
    });
    
    // Initialize game state
    const initialFEN = sessionData.startFEN || 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
    this.gameStates.set(gameId, {
        fen: initialFEN,
        activeColor: 'w',
        status: 'active',
        moveCount: 0,
        lastMove: null,
        timestamp: new Date().toISOString()
    });
    
    // Initialize move history
    this.moveHistory.set(gameId, []);
    
    console.log(`✅ Game session initialized for: ${gameId}`);
    return true;
}

    /**
     * Get game session info
     */
    getGameSession(gameId) {
        return this.playerSessions.get(gameId);
    }

    /**
     * Get current game state
     */
    getGameState(gameId) {
        return this.gameStates.get(gameId);
    }

    /**
     * Get move history for game
     */
    getMoveHistory(gameId) {
        return this.moveHistory.get(gameId) || [];
    }

    /**
     * Clean up finished games
     */
    cleanupGame(gameId) {
        try {
            this.playerSessions.delete(gameId);
            this.gameStates.delete(gameId);
            this.moveHistory.delete(gameId);
            console.log(`🧹 Game cleaned up: ${gameId}`);
        } catch (error) {
            console.error('❌ Game cleanup failed:', error);
        }
    }

    /**
     * Test Byron's engine integration
     */
    async testEngineIntegration() {
        try {
            const startingFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
            
            console.log('🧪 Testing Byron\'s engine integration...');
            console.log(`📋 Starting position: ${startingFEN}`);
            
            if (!this.engineAvailable || !this.rulesEngine) {
                console.log('⚠️ Byron\'s engine not available - using fallback validation');
                return false;
            }
            
            // Test move validation
            const testMove = 'b2b3';
            const validation = this.rulesEngine.validateMove(startingFEN, testMove);
            console.log(`🎯 Testing move ${testMove}:`, validation.valid ? 'Valid' : 'Invalid');
            
            if (validation.valid) {
                // Test move application
                const result = this.rulesEngine.applyMove(startingFEN, testMove);
                console.log(`✅ Move applied successfully. New FEN: ${result.fen}`);
            }
            
            // Test legal moves
            const legalMoves = this.rulesEngine.getLegalMoves(startingFEN);
            console.log(`📝 Legal moves from start (${legalMoves.length}):`, legalMoves.slice(0, 5), '...');
            
            console.log('✅ Byron\'s engine integration test completed successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Byron\'s engine integration test failed:', error);
            return false;
        }
    }
}

module.exports = SecurityMoveValidator;