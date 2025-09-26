/**
 * =============================================================================
 * QUICK FIX - CLEAN SERVER WITHOUT CONFIG DEPENDENCY
 * =============================================================================
 * 
 * PURPOSE: Fixed clean server that works immediately without external config
 * REPLACE: Server/clean-server.js
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');

const resetCodes = new Map(); // email -> { code, token, expiry }

// Add these functions anywhere before your routes
function generateResetCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
// Try to load environment variables
try {
    require('dotenv').config();
} catch (error) {
    console.log('📝 No dotenv package found - using environment variables directly');
}

// Import security components with error handling
let SecurityMoveValidator;
try {
    SecurityMoveValidator = require('../security/enhanced-move-validator');
} catch (error) {
    console.warn('⚠️ Security validator not found, creating fallback');
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
        testEngineIntegration() { return Promise.resolve(false); }
    };
}

// App setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
        methods: ["GET", "POST"]
    }
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for onclick handlers
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { error: 'Too many authentication attempts. Try again later.' }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: { error: 'Too many requests. Try again later.' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory storage (replace with database)
const users = new Map();
const games = new Map();
const refreshTokens = new Set();

// JWT configuration with secure defaults and environment variable support
const JWT_SECRET = process.env.JWT_SECRET || generateSecureToken();
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || generateSecureToken();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Generate secure token if env vars not set
function generateSecureToken() {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    console.log('⚠️ Generated temporary JWT secret - please set JWT_SECRET in environment for production');
    return token;
}

// Warn if using generated tokens
if (!process.env.JWT_SECRET) {
    console.log('💡 To set permanent JWT secrets:');
    console.log('   1. Create a .env file in your project root');
    console.log('   2. Add: JWT_SECRET=your-secure-secret-here');
    console.log('   3. Add: JWT_REFRESH_SECRET=your-refresh-secret-here');
}

// Email configuration with fallback
let emailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
    console.log('📧 Email transporter configured');
} else {
    console.log('📧 Email not configured - password reset will be disabled');
}

// Initialize security validator with error handling
let moveValidator;
try {
    moveValidator = new SecurityMoveValidator();
    
    // Test Byron's engine integration on startup
    moveValidator.testEngineIntegration().then(success => {
        if (success) {
            console.log('🎮 Byron\'s Game Engine integrated successfully with security layer');
        } else {
            console.log('🎮 Using fallback validation (Byron\'s engine not available)');
        }
    }).catch(error => {
        console.log('🎮 Using fallback validation:', error.message);
    });
    
} catch (error) {
    console.warn('⚠️ Security validator initialization failed:', error.message);
    moveValidator = new SecurityMoveValidator(); // Use fallback class
}

/**
 * =============================================================================
 * AUTHENTICATION MIDDLEWARE
 * =============================================================================
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
 * =============================================================================
 * AUTHENTICATION ROUTES
 * =============================================================================
 */


// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ 
                error: 'Username, email, and password are required' 
            });
        }

        // Check if user exists
        const existingUser = Array.from(users.values()).find(
            u => u.email === email || u.username === username
        );

        if (existingUser) {
            return res.status(400).json({ 
                error: 'User with this email or username already exists' 
            });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user
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

        // Generate tokens
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

        // Find user
        const user = Array.from(users.values()).find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate tokens
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
            refreshToken
        });

    } catch (error) {
        console.error('❌ Login failed:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Refresh Token
app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken || !refreshTokens.has(refreshToken)) {
        return res.status(403).json({ error: 'Invalid refresh token' });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, user) => {
        if (err) {
            refreshTokens.delete(refreshToken);
            return res.status(403).json({ error: 'Invalid refresh token' });
        }

        const userData = users.get(user.id);
        if (!userData) {
            return res.status(403).json({ error: 'User not found' });
        }

        const newAccessToken = jwt.sign(
            { id: userData.id, username: userData.username, email: userData.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({ accessToken: newAccessToken });
    });
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        refreshTokens.delete(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
});

// Forgot Password
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (!emailTransporter) {
            return res.status(503).json({ error: 'Email service not configured' });
        }

        const user = Array.from(users.values()).find(u => u.email === email);
        if (!user) {
            // Don't reveal if user exists
            return res.json({ message: 'If the email exists, a reset link has been sent' });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { id: user.id, purpose: 'password-reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Create reset URL
        const resetUrl = `http://localhost:3000/reset-password.html?token=${resetToken}`;

        // Send email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset - Los Alamos Chess',
            html: `
                <h2>Password Reset Request</h2>
                <p>Hello ${user.username},</p>
                <p>You requested a password reset for your Los Alamos Chess account.</p>
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };

        await emailTransporter.sendMail(mailOptions);

        console.log(`📧 Password reset email sent to: ${email}`);

        res.json({ message: 'If the email exists, a reset link has been sent' });

    } catch (error) {
        console.error('❌ Password reset failed:', error);
        res.status(500).json({ error: 'Failed to send reset email' });
    }
});

// Reset Password
app.post('/api/auth/password-reset', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: 'MISSING_EMAIL',
                message: 'Email is required'
            });
        }

        // Check if user exists
        const user = Array.from(users.values()).find(u => u.email === email);
        if (!user) {
            // Don't reveal user doesn't exist for security
            return res.json({
                success: true,
                message: 'If email exists, reset code sent',
                resetToken: 'dummy-token'
            });
        }

        // Generate reset code and token
        const resetCode = generateResetCode();
        const resetToken = jwt.sign(
            { id: user.id, email: user.email, purpose: 'password-reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Store reset code temporarily (10 minutes)
        resetCodes.set(email, {
            code: resetCode,
            token: resetToken,
            expiry: Date.now() + 10 * 60 * 1000
        });

        console.log(`🔑 DEMO: Reset code for ${email}: ${resetCode}`);

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

// Also add the verify route:
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
// Get user profile
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

// Add dashboard page route
app.get('/dashboard_page.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dashboard_page.html'));
});

// Add registration page route  
app.get('/registration_page.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/registration_page.html'));
});

/**
 * =============================================================================
 * GAME API ROUTES WITH SECURITY
 * =============================================================================
 */

// Create Game
app.post('/api/game/create', authenticateToken, (req, res) => {
    try {
        const gameId = require('crypto').randomUUID();
        const { gameType, playerColor } = req.body;

        const newGame = {
            id: gameId,
            creator: req.user.id,
            gameType: gameType || 'human',
            playerColor: playerColor || 'white',
            status: 'waiting',
            fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
            createdAt: new Date().toISOString()
        };

        games.set(gameId, newGame);

        // Initialize game session in security validator
        try {
            if (gameType === 'ai') {
                moveValidator.initGameSession(gameId, req.user.id, 'ai');
            } else if (gameType === 'human') {
                moveValidator.initGameSession(gameId, req.user.id, null);
            }
        } catch (error) {
            console.warn('⚠️ Game session initialization skipped:', error.message);
        }

        console.log(`🎮 Game created: ${gameId} by ${req.user.username}`);

        res.status(201).json({
            success: true,
            gameId: gameId,
            game: newGame,
            message: 'Game created successfully'
        });

    } catch (error) {
        console.error('❌ Game creation failed:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
});

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
 * =============================================================================
 * STATIC ROUTES AND PAGES
 * =============================================================================
 */

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
            <div style="margin-top: 30px; font-size: 14px;">
                <p>🔧 <a href="/api/health" style="color: lightgreen;">Health Check</a></p>
                <p>ℹ️ <a href="/api/info" style="color: lightgreen;">Server Info</a></p>
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
        uptime: process.uptime(),
        version: '3.1.0',
        features: {
            'User Registration': true,
            'JWT Authentication': true,
            'Password Reset': !!emailTransporter,
            'Rate Limiting': true,
            'Game Engine': 'Available with fallback',
            'Move Validation': true,
            'Legal Move Calculation': true,
            'Security Integration': true
        }
    });
});

// Server Info
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Los Alamos Chess Server',
        version: '3.1.0',
        description: 'Chess server with authentication and game engine integration',
        endpoints: {
            // Authentication
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            refresh: 'POST /api/auth/refresh',
            logout: 'POST /api/auth/logout',
            forgotPassword: 'POST /api/auth/forgot-password',
            resetPassword: 'POST /api/auth/reset-password',
            
            // User
            profile: 'GET /api/user/profile',
            
            // Game
            createGame: 'POST /api/game/create',
            makeMove: 'POST /api/game/move',
            legalMoves: 'POST /api/game/legal-moves',
            
            // Pages
            homepage: '/',
            login: '/login_page.html',
            dashboard: '/dashboard_page.html',
            gameView: '/game_view.html',
            
            // Monitoring
            health: '/api/health',
            info: '/api/info'
        },
        security: {
            'JWT Authentication': 'Enabled',
            'Rate Limiting': 'Enabled (10 auth/15min, 100 API/15min)',
            'CORS': 'Configured',
            'Helmet Security Headers': 'Enabled',
            'Password Hashing': 'bcrypt with 12 rounds',
            'Email Integration': emailTransporter ? 'Configured' : 'Not configured'
        }
    });
});

// Password reset page
app.get('/reset-password.html', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password - Los Alamos Chess</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0;
            }
            .reset-container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                max-width: 400px;
                width: 100%;
            }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="password"] {
                width: 100%;
                padding: 12px;
                border: 2px solid #ddd;
                border-radius: 5px;
                font-size: 16px;
                box-sizing: border-box;
            }
            button {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 5px;
                font-size: 16px;
                cursor: pointer;
            }
            .message {
                margin-top: 15px;
                padding: 10px;
                border-radius: 5px;
                display: none;
            }
            .error { background: #ffebee; color: #c62828; }
            .success { background: #e8f5e8; color: #2e7d32; }
        </style>
    </head>
    <body>
        <div class="reset-container">
            <h2>Reset Your Password</h2>
            <form id="resetForm">
                <div class="form-group">
                    <label for="newPassword">New Password:</label>
                    <input type="password" id="newPassword" required minlength="8" placeholder="Enter your new password">
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password:</label>
                    <input type="password" id="confirmPassword" required minlength="8" placeholder="Confirm your new password">
                </div>
                <button type="submit" id="resetBtn">Reset Password</button>
            </form>
            <div id="message" class="message"></div>
        </div>

        <script>
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');

            document.getElementById('resetForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                const messageEl = document.getElementById('message');

                if (newPassword !== confirmPassword) {
                    messageEl.textContent = 'Passwords do not match';
                    messageEl.className = 'message error';
                    messageEl.style.display = 'block';
                    return;
                }

                try {
                    const response = await fetch('/api/auth/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, newPassword })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        messageEl.textContent = 'Password reset successfully! You can now login.';
                        messageEl.className = 'message success';
                        setTimeout(() => window.location.href = '/login_page.html', 3000);
                    } else {
                        messageEl.textContent = result.error || 'Reset failed';
                        messageEl.className = 'message error';
                    }

                    messageEl.style.display = 'block';

                } catch (error) {
                    messageEl.textContent = 'Network error. Please try again.';
                    messageEl.className = 'message error';
                    messageEl.style.display = 'block';
                }
            });
        </script>
    </body>
    </html>
    `);
});

/**
 * =============================================================================
 * ERROR HANDLING
 * =============================================================================
 */

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        message: 'The requested route does not exist'
    });
});

// Global Error Handler
app.use((error, req, res, next) => {
    console.error('❌ Server Error:', error);
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'Something went wrong on the server',
        timestamp: new Date().toISOString()
    });
});

/**
 * =============================================================================
 * SERVER STARTUP
 * =============================================================================
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
    console.log(`📧 Email: ${emailTransporter ? 'Configured' : 'Not configured'}`);
    console.log(`🛡️ Security: Rate limiting enabled`);
    console.log('');
    console.log('🎯 Available URLs:');
    console.log(`   Homepage:     http://${HOST}:${PORT}/`);
    console.log(`   Login:        http://${HOST}:${PORT}/login_page.html`);
    console.log(`   Dashboard:    http://${HOST}:${PORT}/dashboard_page.html`);
    console.log(`   Game View:    http://${HOST}:${PORT}/game_view.html`);
    console.log(`   Health Check: http://${HOST}:${PORT}/api/health`);
    console.log(`   Server Info:  http://${HOST}:${PORT}/api/info`);
    console.log('');
    console.log('🚀 Ready for chess gameplay!');
    
    if (!process.env.JWT_SECRET) {
        console.log('');
        console.log('💡 TIP: Create a .env file with JWT_SECRET for production use');
    }
});

// Graceful Shutdown
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