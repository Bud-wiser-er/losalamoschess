require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Database connection
const db = require('./database/connection');

// Services and repositories
const DatabaseService = require('./src/models/DatabaseService');
const UserRepository = require('./src/repositories/UserRepository');
const GameRepository = require('./src/repositories/GameRepository');

// Routes
const authRoutes = require('./src/routes/auth');
const gameRoutes = require('./src/routes/games');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE SETUP ====================

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 auth requests per windowMs
    message: {
        error: 'TOO_MANY_AUTH_ATTEMPTS',
        message: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(generalLimiter);
app.use('/auth', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// ==================== SERVICE INITIALIZATION ====================

// Initialize database service and repositories
const databaseService = new DatabaseService();
const userRepository = new UserRepository(databaseService);
const gameRepository = new GameRepository(databaseService);

// Make services available to routes
app.locals.databaseService = databaseService;
app.locals.repositories = {
    user: userRepository,
    game: gameRepository
};

// TODO: Initialize other services when ready
// app.locals.rulesEngine = new RulesEngine(); // Byron's component
// app.locals.aiBot = new AIBot(); // Byron's component
// app.locals.authService = new AuthenticationService(); // Elizabeth's component
// app.locals.webSocketServer = new WebSocketServer(); // Ethan's component

// ==================== ROUTES ====================

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await databaseService.healthCheck();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: dbHealth,
                server: { status: 'healthy' }
                // TODO: Add health checks for other services
                // rulesEngine: rulesEngineHealth,
                // aiBot: aiBotHealth,
                // webSocket: webSocketHealth
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

// API version endpoint
app.get('/api/version', (req, res) => {
    res.json({
        version: '2025-09-01',
        variant: 'LOS_ALAMOS',
        features: {
            authentication: false, // TODO: Set to true when Elizabeth's component is integrated
            rulesEngine: false,    // TODO: Set to true when Byron's component is integrated
            aiBot: false,         // TODO: Set to true when Byron's AI is integrated
            webSocket: false,     // TODO: Set to true when Ethan's component is integrated
            database: true
        }
    });
});

// Route mounting
app.use('/auth', authRoutes);
app.use('/games', gameRoutes);

// ==================== ERROR HANDLING ====================

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    // Don't leak error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.status(error.status || 500).json({
        error: error.code || 'INTERNAL_ERROR',
        message: isProduction ? 'An error occurred' : error.message,
        ...(isProduction ? {} : { stack: error.stack })
    });
});

// ==================== SERVER STARTUP ====================

async function startServer() {
    try {
        // Test database connection
        console.log('Testing database connection...');
        const dbHealth = await databaseService.healthCheck();
        
        if (dbHealth.status !== 'healthy') {
            throw new Error('Database connection failed');
        }
        
        console.log('✅ Database connection successful');
        
        // TODO: Initialize other services here when ready
        // console.log('Initializing Rules Engine...');
        // await rulesEngine.initialize();
        // console.log('✅ Rules Engine initialized');
        
        // console.log('Initializing AI Bot...');
        // await aiBot.initialize();
        // console.log('✅ AI Bot initialized');
        
        // console.log('Initializing Authentication Service...');
        // await authService.initialize();
        // console.log('✅ Authentication Service initialized');
        
        // console.log('Initializing WebSocket Server...');
        // const server = http.createServer(app);
        // await webSocketServer.initialize(server);
        // console.log('✅ WebSocket Server initialized');
        
        // Start HTTP server
        app.listen(PORT, () => {
            console.log(`🚀 Los Alamos Chess Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔗 API version: http://localhost:${PORT}/api/version`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            
            // TODO: Add WebSocket URL when ready
            // console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
    console.log(`\n📡 Received ${signal}. Shutting down gracefully...`);
    
    try {
        // TODO: Close WebSocket connections when ready
        // await webSocketServer.close();
        
        // Close database connections
        await db.close();
        console.log('✅ Database connections closed');
        
        console.log('👋 Server shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;