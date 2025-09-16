// auth-middleware.js
const rateLimit = require('express-rate-limit');
const AuthenticationService = require('../src/models/AuthenticationService');
/**
 * Middleware to authenticate JWT tokens
 */
function authenticateToken(authService) {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

            if (!token) {
                return res.status(401).json({ 
                    error: 'UNAUTHORIZED', 
                    message: 'Access token required' 
                });
            }

            const validation = await authService.validateToken(token);
            
            if (!validation.valid) {
                return res.status(401).json({ 
                    error: 'INVALID_TOKEN', 
                    message: 'Token validation failed' 
                });
            }

            req.user = validation.user;
            next();

        } catch (error) {
            return res.status(401).json({ 
                error: 'AUTHENTICATION_ERROR', 
                message: 'Authentication failed' 
            });
        }
    };
}

/**
 * Middleware to authorize specific actions
 */
function authorizeAction(authService, resource, action) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'UNAUTHORIZED', 
                message: 'Authentication required' 
            });
        }

        const authorized = authService.authorize(req.user, resource, action);
        
        if (!authorized) {
            return res.status(403).json({ 
                error: 'FORBIDDEN', 
                message: 'Insufficient permissions' 
            });
        }

        next();
    };
}

/**
 * Rate limiting middleware for authentication endpoints
 */
const createAuthRateLimit = () => {
    return rateLimit({
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 10, // 10 requests per 5 minutes
        message: {
            error: 'TOO_MANY_REQUESTS',
            message: 'Too many authentication attempts, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

/**
 * Rate limiting for move submissions
 */
const createMoveRateLimit = () => {
    return rateLimit({
        windowMs: 5 * 1000, // 5 seconds
        max: 10, // 10 moves per 5 seconds
        message: {
            error: 'TOO_MANY_MOVES',
            message: 'Too many move attempts, please slow down'
        },
        // Remove the custom keyGenerator to use the default (which handles IPv6)
        standardHeaders: true,
        legacyHeaders: false,
    });
};

/**
 * WebSocket authentication middleware for Ethan's realtime component
 */
function authenticateWebSocket(authService) {
    return async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                return next(new Error('UNAUTHORIZED'));
            }

            const validation = await authService.validateToken(token);
            
            if (!validation.valid) {
                return next(new Error('INVALID_TOKEN'));
            }

            socket.user = validation.user;
            next();

        } catch (error) {
            next(new Error('AUTHENTICATION_ERROR'));
        }
    };
}

/**
 * CORS configuration for frontend integration
 */
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'If-Match', 'Idempotency-Key']
};

/**
 * Input sanitization middleware
 */
function sanitizeInput(req, res, next) {
    const sanitize = (obj, visited = new WeakSet()) => {
        // Prevent infinite recursion with circular references
        if (obj && typeof obj === 'object') {
            if (visited.has(obj)) {
                return obj;
            }
            visited.add(obj);
        }

if (typeof obj === 'string') {
    // More comprehensive XSS prevention
    return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
             .replace(/javascript:[^"'\s]*/gi, '') // Simplified - remove everything after javascript:
             .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
             .replace(/on\w+\s*=\s*[^"'\s>]*/gi, '');
}
        
        if (Array.isArray(obj)) {
            return obj.map(item => sanitize(item, visited));
        }
        
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = sanitize(obj[key], visited);
                }
            }
            return sanitized;
        }
        
        return obj;
    };

    if (req.body) {
        req.body = sanitize({ ...req.body });
    }
    
    next();
}
module.exports = {
    authenticateToken,
    authorizeAction,
    createAuthRateLimit,
    createMoveRateLimit,
    authenticateWebSocket,
    corsOptions,
    sanitizeInput
};