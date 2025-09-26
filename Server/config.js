/**
 * =============================================================================
 * SECURE SERVER CONFIGURATION
 * =============================================================================
 * 
 * PURPOSE: Secure configuration management with environment variables
 * LOCATION: /Server/config.js
 */

const path = require('path');

// Load environment variables
require('dotenv').config();

/**
 * Validate required environment variables
 */
function validateEnvironment() {
    const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('\n💡 Please create a .env file with the required variables');
        console.error('   Run: node generate-jwt-config.js');
        process.exit(1);
    }
    
    // Warn about insecure defaults
    if (process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
        console.warn('⚠️  WARNING: Using default JWT_SECRET - this is insecure!');
        console.warn('   Please generate secure tokens: node generate-jwt-config.js');
    }
}

// Validate environment on startup
validateEnvironment();

/**
 * Server Configuration
 */
const config = {
    // Server Settings
    server: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || 'localhost',
        environment: process.env.NODE_ENV || 'development'
    },
    
    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    
    // Security Settings
    security: {
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
        sessionSecret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
        sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
        
        // Rate Limiting
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15 minutes
            authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 10,
            apiMax: parseInt(process.env.RATE_LIMIT_API_MAX) || 100
        }
    },
    
    // CORS Configuration
    cors: {
        origin: process.env.CORS_ORIGIN ? 
            process.env.CORS_ORIGIN.split(',') : 
            ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true
    },
    
    // Email Configuration
    email: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        from: process.env.EMAIL_FROM || 'Los Alamos Chess <noreply@losalamoschess.com>',
        service: process.env.EMAIL_SERVICE || 'gmail'
    },
    
    // Database Configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        name: process.env.DB_NAME || 'los_alamos_chess',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
    },
    
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    },
    
    // Game Settings
    game: {
        timerDuration: 15 * 60, // 15 minutes in seconds
        maxGamesPerUser: 10,
        cleanupInterval: 60 * 60 * 1000 // 1 hour
    }
};

/**
 * Get configuration with environment-specific overrides
 */
function getConfig() {
    const env = config.server.environment;
    
    if (env === 'production') {
        // Production-specific overrides
        config.security.bcryptRounds = 15; // Higher security
        config.jwt.expiresIn = '5m'; // Shorter tokens
        config.logging.level = 'warn'; // Less verbose logging
    } else if (env === 'test') {
        // Test-specific overrides
        config.security.bcryptRounds = 4; // Faster for tests
        config.jwt.expiresIn = '1h'; // Longer for tests
    }
    
    return config;
}

/**
 * Validate configuration
 */
function validateConfig(config) {
    // Check JWT secrets are not default values
    const insecureSecrets = [
        'your-secret-key-change-in-production',
        'your-refresh-secret-key',
        'changeme',
        'secret',
        '123456'
    ];
    
    if (insecureSecrets.includes(config.jwt.secret)) {
        throw new Error('JWT_SECRET is using an insecure default value');
    }
    
    if (insecureSecrets.includes(config.jwt.refreshSecret)) {
        throw new Error('JWT_REFRESH_SECRET is using an insecure default value');
    }
    
    // Check JWT secrets are long enough
    if (config.jwt.secret.length < 32) {
        console.warn('⚠️  JWT_SECRET should be at least 32 characters long');
    }
    
    if (config.jwt.refreshSecret.length < 32) {
        console.warn('⚠️  JWT_REFRESH_SECRET should be at least 32 characters long');
    }
    
    return true;
}

module.exports = {
    getConfig,
    validateConfig,
    config: getConfig()
};
