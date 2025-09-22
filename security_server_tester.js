// server.js - Main server file with Byron's Rules Engine integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Database and Models
const DatabaseService = require('./src/models/DatabaseService');
const GameRepository = require('./src/repositories/GameRepository');
const UserRepository = require('./src/repositories/UserRepository');

// Byron's Rules Engine
const RulesEngine = require('./backend/src/engine/index');

// Authentication (from security directory)
const { AuthenticationService, createAuthRoutes } = require('./security');

// Routes
const gamesRoutes = require('./src/routes/games');

const app = express();
const PORT =  3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Initialize services and dependencies
async function initializeServices() {
    try {
        console.log('Initializing services...');
        
        // Initialize database service
        const databaseService = new DatabaseService();
        console.log('Database service initialized');
        
        // Initialize Byron's Rules Engine
        const rulesEngine = new RulesEngine();
        console.log('Rules engine initialized');
        
        // Initialize authentication service
        const authService = new AuthenticationService(databaseService);
        console.log('Authentication service initialized');
        
        // Initialize repositories with dependencies
        const userRepository = new UserRepository(databaseService);
        const gameRepository = new GameRepository(databaseService, rulesEngine);
        
        console.log('Repositories initialized');
        
        // Make services available to routes via app.locals
        app.locals.databaseService = databaseService;
        app.locals.rulesEngine = rulesEngine;
        app.locals.authService = authService;
        app.locals.repositories = {
            user: userRepository,
            game: gameRepository
        };
        
        console.log('Services attached to app.locals');
        
        return { databaseService, rulesEngine, authService, userRepository, gameRepository };
    } catch (error) {
        console.error('Failed to initialize services:', error);
        return null;
    }
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        const dbService = req.app.locals.databaseService;
        await dbService.connection.query('SELECT 1');
        
        // Test rules engine
        const rulesEngine = req.app.locals.rulesEngine;
        const testValidation = rulesEngine.validateMove(
            'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 
            'b2b3'
        );
        
        if (!testValidation.valid) {
            throw new Error('Rules engine test failed');
        }
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'connected',
                rulesEngine: 'operational'
            }
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Rules engine test endpoint (for development)
app.get('/test/rules-engine', async (req, res) => {
    try {
        const rulesEngine = req.app.locals.rulesEngine;
        const initialFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
        
        // Test move validation
        const validation = rulesEngine.validateMove(initialFEN, 'b2b3');
        
        // Test legal moves
        const legalMoves = rulesEngine.getLegalMoves(initialFEN);
        
        // Test move application
        let gameState = null;
        if (validation.valid) {
            gameState = rulesEngine.applyMove(initialFEN, 'b2b3');
        }
        
        res.json({
            success: true,
            tests: {
                moveValidation: validation,
                legalMovesCount: legalMoves.length,
                moveApplication: gameState,
                sampleLegalMoves: legalMoves.slice(0, 10)
            }
        });
    } catch (error) {
        console.error('Rules engine test failed:', error);
        res.status(500).json({
            error: 'RULES_ENGINE_TEST_FAILED',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    
    // Rules engine specific errors
    if (error.message && error.message.includes('Rules engine')) {
        return res.status(500).json({
            error: 'RULES_ENGINE_ERROR',
            message: 'Game logic error occurred'
        });
    }
    
    // Database specific errors
    if (error.code && error.code.startsWith('23')) { // PostgreSQL constraint errors
        return res.status(409).json({
            error: 'DATABASE_CONSTRAINT_ERROR',
            message: 'Database constraint violation'
        });
    }
    
    // Generic error response
    res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
    });
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    
    try {
        // Close database connections
        if (app.locals.databaseService && app.locals.databaseService.connection) {
            await app.locals.databaseService.connection.end();
            console.log('Database connections closed');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Start server
async function startServer() {
    console.log('Starting Los Alamos Chess Server...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    
    // Initialize all services
    const services = await initializeServices();
    
    if (!services) {
        console.error('Failed to initialize services. Exiting...');
        process.exit(1);
    }
    
    // NOW SET UP ROUTES AFTER SERVICES ARE INITIALIZED
    // API Routes
    app.use('/api/games', gamesRoutes);
    app.use('/api/auth', createAuthRoutes(services.authService));
    
    // Static files - serve from frontend directory
    app.use(express.static('frontend'));
    
    // 404 handler - MUST come after static files
    app.use((req, res) => {
        res.status(404).json({
            error: 'NOT_FOUND',
            message: 'Endpoint not found'
        });
    });
    
    // Start listening
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Available endpoints:');
        console.log(`  GET  /health - Health check`);
        console.log(`  GET  /test/rules-engine - Rules engine test`);
        console.log(`  POST /api/games - Create game`);
        console.log(`  GET  /api/games/:id - Get game`);
        console.log(`  POST /api/games/:id/join - Join game`);
        console.log(`  POST /api/games/:id/moves - Make move`);
        console.log(`  GET  /api/games/:id/legal-moves - Get legal moves`);
        console.log(`  GET  /api/games/:id/pgn - Export PGN`);
        console.log(`  POST /api/auth/register - Register user`);
        console.log(`  POST /api/auth/login - Login user`);
        console.log('');
        console.log('Integration Status:');
        console.log('  ✓ Byron\'s Rules Engine: Integrated');
        console.log('  ✓ Database Layer: Connected');
        console.log('  ✓ Elizabeth\'s Auth: Integrated');
        console.log('  ⚠ Frontend Integration: Testing...');
    });
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the server
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

module.exports = app;