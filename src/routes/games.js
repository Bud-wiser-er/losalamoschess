const express = require('express');
const router = express.Router();

// These routes integrate with Byron's Rules Engine and Elizabeth's security
// PRESERVING all original functionality while ADDING new rules engine integration

// ==================== ORIGINAL ROUTES (PRESERVED) ====================

/**
 * POST /games
 * Create a new game (ORIGINAL)
 */
router.post('/', async (req, res) => {
    try {
        // TODO: Add authentication middleware (Elizabeth)
        // TODO: Integrate with rules engine for initial FEN (Byron)
        
        const { timeControl = { base: 300000, increment: 0 } } = req.body;
        
        const gameRepository = req.app.locals.repositories.game;
        
        const gameData = {
            whitePlayerId: req.user?.id || null, // Will come from auth middleware
            blackPlayerId: null,
            whiteClockMs: timeControl.base,
            blackClockMs: timeControl.base
        };

        const game = await gameRepository.create(gameData);
        
        res.status(201).json({
            success: true,
            game: game
        });
        
    } catch (error) {
        console.error('Game creation error:', error);
        res.status(500).json({ 
            error: 'GAME_CREATION_FAILED', 
            message: 'Failed to create game' 
        });
    }
});

/**
 * GET /games/:id
 * Get game by ID (ORIGINAL)
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const gameRepository = req.app.locals.repositories.game;
        
        const game = await gameRepository.findById(id);
        
        if (!game) {
            return res.status(404).json({
                error: 'GAME_NOT_FOUND',
                message: 'Game not found'
            });
        }

        res.json({
            success: true,
            game: game
        });
        
    } catch (error) {
        console.error('Game retrieval error:', error);
        res.status(500).json({ 
            error: 'GAME_RETRIEVAL_FAILED', 
            message: 'Failed to retrieve game' 
        });
    }
});

/**
 * GET /games
 * Get games with filtering options (ORIGINAL)
 */
router.get('/', async (req, res) => {
    try {
        const { 
            status = 'all', 
            user_id, 
            waiting = false, 
            limit = 20, 
            page = 1 
        } = req.query;
        
        const gameRepository = req.app.locals.repositories.game;
        let games;

        if (waiting === 'true') {
            // Get games waiting for opponents
            const excludeUserId = req.user?.id;
            games = await gameRepository.findWaitingGames(excludeUserId);
        } else if (user_id) {
            // Get games for specific user
            games = await gameRepository.findActiveGamesForUser(user_id);
        } else if (status !== 'all') {
            // Filter by status
            games = await gameRepository.findByStatus(status, parseInt(limit));
        } else {
            // Get recent games
            games = await gameRepository.getRecentGames(parseInt(limit));
        }
        
        res.json({
            success: true,
            games: games,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: games.length
            }
        });
        
    } catch (error) {
        console.error('Games list error:', error);
        res.status(500).json({ 
            error: 'GAMES_LIST_FAILED', 
            message: 'Failed to retrieve games' 
        });
    }
});

/**
 * POST /games/:id/join
 * Join a game (ORIGINAL)
 */
router.post('/:id/join', async (req, res) => {
    try {
        // TODO: Add authentication middleware (Elizabeth)
        
        const { id } = req.params;
        const { color } = req.body; // 'white' or 'black'
        
        if (color && !['white', 'black'].includes(color)) {
            return res.status(400).json({
                error: 'INVALID_COLOR',
                message: 'Color must be white or black'
            });
        }

        const gameRepository = req.app.locals.repositories.game;
        const userId = req.user?.id; // Will come from auth middleware
        
        if (!userId) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Authentication required'
            });
        }

        const game = await gameRepository.joinGame(id, userId, color);
        
        res.json({
            success: true,
            game: game,
            message: `Joined as ${color || 'next available color'}`
        });
        
    } catch (error) {
        console.error('Game join error:', error);
        
        if (error.message === 'SEAT_TAKEN') {
            return res.status(409).json({
                error: 'SEAT_TAKEN',
                message: 'That seat is already taken'
            });
        }
        
        res.status(500).json({ 
            error: 'GAME_JOIN_FAILED', 
            message: 'Failed to join game' 
        });
    }
});

/**
 * GET /games/:id/moves
 * Get move history for a game (ORIGINAL)
 */
router.get('/:id/moves', async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;
        
        const gameRepository = req.app.locals.repositories.game;
        const moves = await gameRepository.getMoves(id, parseInt(limit));
        
        res.json({
            success: true,
            moves: moves.reverse(), // Return in chronological order
            gameId: id
        });
        
    } catch (error) {
        console.error('Move history error:', error);
        res.status(500).json({ 
            error: 'MOVE_HISTORY_FAILED', 
            message: 'Failed to retrieve move history' 
        });
    }
});

/**
 * GET /games/:id/pgn
 * Export game in PGN format (ORIGINAL)
 */
router.get('/:id/pgn', async (req, res) => {
    try {
        const { id } = req.params;
        const gameRepository = req.app.locals.repositories.game;
        
        const pgn = await gameRepository.exportPGN(id);
        
        res.setHeader('Content-Type', 'application/x-chess-pgn');
        res.setHeader('Content-Disposition', `attachment; filename="game_${id}.pgn"`);
        res.send(pgn);
        
    } catch (error) {
        console.error('PGN export error:', error);
        
        if (error.message === 'Game not found') {
            return res.status(404).json({
                error: 'GAME_NOT_FOUND',
                message: 'Game not found'
            });
        }
        
        res.status(500).json({ 
            error: 'PGN_EXPORT_FAILED', 
            message: 'Failed to export PGN' 
        });
    }
});

/**
 * POST /games/:id/bot-move
 * Request a bot move (ORIGINAL - integrates with Byron's AI Bot)
 */
router.post('/:id/bot-move', async (req, res) => {
    try {
        // TODO: Add authentication middleware (Elizabeth)
        // TODO: Integrate with Byron's AI Bot
        
        const { id } = req.params;
        const { level = 'L1', msCap = 3000, seed } = req.body;
        
        // Placeholder response for bot integration
        res.json({
            success: false,
            message: 'Bot integration pending - Byron\'s AI Bot not yet implemented',
            gameId: id,
            requested: { level, msCap, seed }
        });
        
    } catch (error) {
        console.error('Bot move error:', error);
        res.status(500).json({ 
            error: 'BOT_MOVE_FAILED', 
            message: 'Failed to request bot move' 
        });
    }
});

// ==================== ENHANCED ORIGINAL ROUTE ====================

/**
 * POST /games/:id/move
 * Make a move (ENHANCED - now integrates with Byron's Rules Engine)
 */
router.post('/:id/move', async (req, res) => {
    try {
        // TODO: Add authentication and authorization middleware (Elizabeth)
        
        const { id } = req.params;
        const { uci } = req.body; // Universal Chess Interface notation
        const idempotencyKey = req.headers['idempotency-key'];
        const userId = req.user?.id;
        
        if (!uci) {
            return res.status(400).json({
                error: 'MISSING_MOVE',
                message: 'UCI move notation required'
            });
        }

        // Check for idempotent response
        const databaseService = req.app.locals.databaseService;
        if (idempotencyKey) {
            const existingResponse = await databaseService.getIdempotentResponse(idempotencyKey);
            if (existingResponse) {
                return res.json(existingResponse);
            }
        }

        const gameRepository = req.app.locals.repositories.game;
        
        // NEW: Enhanced with Byron's Rules Engine integration
        if (gameRepository.rulesEngine) {
            // Use Byron's rules engine for move validation and application
            const moveResult = await gameRepository.makeMove(id, uci, userId, {
                by: 'human',
                serverMs: Date.now() // Will be calculated properly later
            });

            const response = {
                success: true,
                game: moveResult.game,
                move: moveResult.move,
                fen: moveResult.moveResult.fen,
                status: moveResult.moveResult.status,
                flags: moveResult.flags,
                legalMoves: moveResult.moveResult.status === 'ONGOING' ? 
                    await gameRepository.getLegalMoves(id) : []
            };

            // Store idempotent response if key provided
            if (idempotencyKey) {
                await databaseService.saveIdempotentResponse(idempotencyKey, id, response);
            }

            res.json(response);
        } else {
            // FALLBACK: Original implementation when rules engine not available
            // This maintains backward compatibility
            res.json({
                success: false,
                message: 'Move endpoint ready - Rules Engine integration pending',
                move: { uci },
                gameId: id
            });
        }
        
    } catch (error) {
        console.error('Move error:', error);
        
        // Enhanced error handling for Byron's rules engine errors
        const errorMap = {
            'GAME_NOT_FOUND': { status: 404, error: 'GAME_NOT_FOUND' },
            'GAME_NOT_ACTIVE': { status: 409, error: 'GAME_NOT_ACTIVE' },
            'NOT_PARTICIPANT': { status: 403, error: 'NOT_PARTICIPANT' },
            'NOT_YOUR_TURN': { status: 409, error: 'WRONG_TURN' },
            'NOT_AUTHENTICATED': { status: 401, error: 'AUTHENTICATION_REQUIRED' },
            'INVALID_MOVE': { status: 400, error: 'INVALID_MOVE' },
            'ILLEGAL_MOVE': { status: 400, error: 'ILLEGAL_MOVE' },
            'LEAVES_KING_IN_CHECK': { status: 400, error: 'LEAVES_KING_IN_CHECK' },
            'NO_CASTLING': { status: 400, error: 'NO_CASTLING' },
            'NO_EN_PASSANT': { status: 400, error: 'NO_EN_PASSANT' },
            'INVALID_PROMOTION': { status: 400, error: 'INVALID_PROMOTION' },
            'VERSION_CONFLICT': { status: 409, error: 'CONCURRENT_MODIFICATION' }
        };
        
        const errorInfo = errorMap[error.message] || { 
            status: 500, 
            error: 'MOVE_FAILED' 
        };
        
        res.status(errorInfo.status).json({
            error: errorInfo.error,
            message: error.message
        });
    }
});

// ==================== NEW ROUTES (BYRON'S RULES ENGINE INTEGRATION) ====================

/**
 * POST /games/:id/validate-move
 * Validate a move without applying it (NEW)
 */
router.post('/:id/validate-move', async (req, res) => {
    try {
        const { id: gameId } = req.params;
        const { uci } = req.body;
        const userId = req.user?.id;
        
        if (!uci || typeof uci !== 'string') {
            return res.status(400).json({
                error: 'INVALID_UCI',
                message: 'UCI move is required and must be a string'
            });
        }

        const gameRepository = req.app.locals.repositories.game;
        
        if (!gameRepository.rulesEngine) {
            return res.status(503).json({
                error: 'RULES_ENGINE_UNAVAILABLE',
                message: 'Rules engine not available'
            });
        }
        
        const validation = await gameRepository.validateMove(gameId, uci, userId);
        
        res.json({
            success: true,
            validation: validation
        });
        
    } catch (error) {
        console.error('Move validation error:', error);
        res.status(500).json({ 
            error: 'VALIDATION_FAILED', 
            message: 'Failed to validate move' 
        });
    }
});

/**
 * GET /games/:id/legal-moves
 * Get all legal moves for current position (NEW)
 */
router.get('/:id/legal-moves', async (req, res) => {
    try {
        const { id } = req.params;
        
        const gameRepository = req.app.locals.repositories.game;
        
        if (!gameRepository.rulesEngine) {
            return res.status(503).json({
                error: 'RULES_ENGINE_UNAVAILABLE',
                message: 'Rules engine not available'
            });
        }
        
        const legalMoves = await gameRepository.getLegalMoves(id);
        
        res.json({
            success: true,
            legalMoves: legalMoves,
            count: legalMoves.length
        });
        
    } catch (error) {
        console.error('Legal moves error:', error);
        
        if (error.message === 'GAME_NOT_FOUND') {
            return res.status(404).json({
                error: 'GAME_NOT_FOUND',
                message: 'Game not found'
            });
        }
        
        res.status(500).json({ 
            error: 'LEGAL_MOVES_FAILED', 
            message: 'Failed to get legal moves' 
        });
    }
});

/**
 * GET /games/:id/analysis
 * Get game analysis (position info, legal moves count, etc.) (NEW)
 */
router.get('/:id/analysis', async (req, res) => {
    try {
        const { id } = req.params;
        
        const gameRepository = req.app.locals.repositories.game;
        
        if (!gameRepository.rulesEngine) {
            return res.status(503).json({
                error: 'RULES_ENGINE_UNAVAILABLE',
                message: 'Rules engine not available'
            });
        }
        
        const analysis = await gameRepository.getGameAnalysis(id);
        
        res.json({
            success: true,
            analysis: analysis
        });
        
    } catch (error) {
        console.error('Game analysis error:', error);
        
        if (error.message === 'GAME_NOT_FOUND') {
            return res.status(404).json({
                error: 'GAME_NOT_FOUND',
                message: 'Game not found'
            });
        }
        
        res.status(500).json({ 
            error: 'ANALYSIS_FAILED', 
            message: 'Failed to analyze game' 
        });
    }
});

/**
 * GET /games/user/:userId
 * Get active games for a user (NEW - enhanced version of original functionality)
 */
router.get('/user/:userId', async (req, res) => {
    try {
        // TODO: Add authorization check (user can only see their own games)
        
        const { userId } = req.params;
        
        const gameRepository = req.app.locals.repositories.game;
        const games = await gameRepository.findActiveGamesForUser(userId);
        
        res.json({
            success: true,
            games: games,
            count: games.length
        });
        
    } catch (error) {
        console.error('User games error:', error);
        res.status(500).json({ 
            error: 'USER_GAMES_FAILED', 
            message: 'Failed to retrieve user games' 
        });
    }
});

module.exports = router;