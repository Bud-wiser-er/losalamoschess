const express = require('express');
const router = express.Router();

// These routes will integrate with Byron's Rules Engine and Elizabeth's security
// For now, we'll create the structure with database integration

/**
 * POST /games
 * Create a new game
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
 * Get game by ID
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
 * POST /games/:id/join
 * Join a game
 */
router.post('/:id/join', async (req, res) => {
    try {
        // TODO: Add authentication middleware (Elizabeth)
        
        const { id } = req.params;
        const { color } = req.body; // 'white' or 'black'
        
        if (!['white', 'black'].includes(color)) {
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
            message: `Joined as ${color}`
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
 * POST /games/:id/move
 * Make a move (integrates with Byron's Rules Engine)
 */
router.post('/:id/move', async (req, res) => {
    try {
        // TODO: Add authentication and authorization middleware (Elizabeth)
        // TODO: Integrate with Byron's Rules Engine for move validation
        
        const { id } = req.params;
        const { uci } = req.body; // Universal Chess Interface notation
        const idempotencyKey = req.headers['idempotency-key'];
        
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
        const userId = req.user?.id; // Will come from auth middleware
        
        // Check if user can move
        const moveAuth = await gameRepository.canUserMove(id, userId);
        if (!moveAuth.canMove) {
            const errorMap = {
                'GAME_NOT_FOUND': { status: 404, error: 'GAME_NOT_FOUND' },
                'GAME_NOT_ACTIVE': { status: 409, error: 'GAME_NOT_ACTIVE' },
                'NOT_PARTICIPANT': { status: 403, error: 'NOT_PARTICIPANT' },
                'NOT_YOUR_TURN': { status: 409, error: 'WRONG_TURN' }
            };
            
            const errorInfo = errorMap[moveAuth.reason] || { status: 400, error: 'INVALID_MOVE' };
            return res.status(errorInfo.status).json({
                error: errorInfo.error,
                message: moveAuth.reason
            });
        }

        // TODO: Call Byron's Rules Engine here
        // const rulesEngine = req.app.locals.rulesEngine;
        // const moveResult = await rulesEngine.validateAndApplyMove(currentFen, uci);
        
        // For now, return a placeholder response
        const response = {
            success: true,
            message: 'Move endpoint ready - pending Rules Engine integration',
            move: { uci },
            gameId: id
        };

        // Store idempotent response if key provided
        if (idempotencyKey) {
            await databaseService.saveIdempotentResponse(idempotencyKey, id, response);
        }

        res.json(response);
        
    } catch (error) {
        console.error('Move error:', error);
        res.status(500).json({ 
            error: 'MOVE_FAILED', 
            message: 'Failed to process move' 
        });
    }
});

/**
 * GET /games/:id/moves
 * Get move history for a game
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
 * Export game in PGN format
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
 * GET /games
 * Get games with filtering options
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
 * POST /games/:id/bot-move
 * Request a bot move (integrates with Byron's AI Bot)
 */
router.post('/:id/bot-move', async (req, res) => {
    try {
        // TODO: Add authentication middleware (Elizabeth)
        // TODO: Integrate with Byron's AI Bot
        
        const { id } = req.params;
        const { level = 'L1', msCap = 3000, seed } = req.body;
        
        if (!['L0', 'L1', 'L2', 'L3'].includes(level)) {
            return res.status(400).json({
                error: 'INVALID_BOT_LEVEL',
                message: 'Bot level must be L0, L1, L2, or L3'
            });
        }

        const gameRepository = req.app.locals.repositories.game;
        const game = await gameRepository.findById(id);
        
        if (!game) {
            return res.status(404).json({
                error: 'GAME_NOT_FOUND',
                message: 'Game not found'
            });
        }

        if (game.status !== 'active') {
            return res.status(409).json({
                error: 'GAME_NOT_ACTIVE',
                message: 'Game is not active'
            });
        }

        // TODO: Call Byron's AI Bot here
        // const aiBot = req.app.locals.aiBot;
        // const botRequest = { fen: game.current_fen, level, msCap, seed };
        // const botReply = await aiBot.generateMove(botRequest);
        
        // For now, return a placeholder response
        const response = {
            success: true,
            message: 'Bot move endpoint ready - pending AI Bot integration',
            request: { level, msCap, seed },
            gameId: id
        };

        res.json(response);
        
    } catch (error) {
        console.error('Bot move error:', error);
        res.status(500).json({ 
            error: 'BOT_MOVE_FAILED', 
            message: 'Failed to request bot move' 
        });
    }
});

/**
 * DELETE /games/:id
 * Cancel/abandon a game (only if not started or user is participant)
 */
router.delete('/:id', async (req, res) => {
    try {
        // TODO: Add authentication middleware (Elizabeth)
        
        const { id } = req.params;
        const userId = req.user?.id; // Will come from auth middleware
        
        const gameRepository = req.app.locals.repositories.game;
        const game = await gameRepository.findById(id);
        
        if (!game) {
            return res.status(404).json({
                error: 'GAME_NOT_FOUND',
                message: 'Game not found'
            });
        }

        // Check if user is a participant
        const isParticipant = game.white_player_id === userId || game.black_player_id === userId;
        if (!isParticipant) {
            return res.status(403).json({
                error: 'NOT_PARTICIPANT',
                message: 'Only game participants can cancel games'
            });
        }

        // Only allow cancellation of games that haven't really started
        if (game.ply > 2) {
            return res.status(409).json({
                error: 'GAME_IN_PROGRESS',
                message: 'Cannot cancel games that are in progress. Use resignation instead.'
            });
        }

        // For now, just mark as abandoned - could delete instead
        await gameRepository.updateStatus(id, 'draw', null);
        
        res.json({
            success: true,
            message: 'Game cancelled'
        });
        
    } catch (error) {
        console.error('Game cancellation error:', error);
        res.status(500).json({ 
            error: 'GAME_CANCEL_FAILED', 
            message: 'Failed to cancel game' 
        });
    }
});

module.exports = router;