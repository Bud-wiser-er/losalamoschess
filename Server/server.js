// server.js - Main server file for Los Alamos Chess Platform (FIXED)
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

// Import validation utilities from config.js
const { schemas, validate } = require('./config');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Add input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Remove script tags and other potentially harmful content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*["\'][^"\']*["\']?/gi, '')
    .trim();
};

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for general API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Constants
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
const JWT_EXPIRE = '15m'; // Short-lived access tokens
const JWT_REFRESH_EXPIRE = '7d'; // Refresh tokens

// In-memory storage (replace with PostgreSQL in production)
const users = new Map();
const games = new Map();
const refreshTokens = new Map();

// Utility functions
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRE }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' }, 
    JWT_REFRESH_SECRET, 
    { expiresIn: JWT_REFRESH_EXPIRE }
  );
  
  return { accessToken, refreshToken };
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.user = decoded;
  next();
};

// WebSocket authentication middleware (FIXED to match config.js)
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return next(new Error('Authentication error')); // Changed to match config.js
  }
  
  socket.user = decoded;
  next();
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// User Registration (FIXED with Joi validation and XSS prevention)
app.post('/api/auth/register', async (req, res) => {
  try {
    let { username, email, password } = req.body;
    
    // Use Joi validation from config.js - handles email validation automatically
    try {
      const validatedData = validate(schemas.register, { username, email, password });
      username = validatedData.username;
      email = validatedData.email;
      password = validatedData.password;
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    
    // XSS prevention - sanitize inputs after validation
    username = sanitizeInput(username);
    email = sanitizeInput(email);
    
    // Check if user already exists
    const existingUser = Array.from(users.values()).find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const userId = Date.now().toString();
    const user = {
      id: userId,
      username,
      email,
      passwordHash,
      rating: 1200, // Starting rating
      createdAt: new Date().toISOString(),
      isOnline: false
    };
    
    users.set(userId, user);
    
    // Generate tokens
    const tokens = generateTokens(userId);
    refreshTokens.set(tokens.refreshToken, userId);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        username,
        email,
        rating: user.rating
      },
      ...tokens
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
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
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate tokens
    const tokens = generateTokens(user.id);
    refreshTokens.set(tokens.refreshToken, user.id);
    
    // Update user status
    user.isOnline = true;
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating
      },
      ...tokens
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Token Refresh
app.post('/api/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded || !refreshTokens.has(refreshToken)) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Generate new tokens
    const userId = refreshTokens.get(refreshToken);
    const newTokens = generateTokens(userId);
    
    // Remove old refresh token and add new one
    refreshTokens.delete(refreshToken);
    refreshTokens.set(newTokens.refreshToken, userId);
    
    res.json(newTokens);
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
app.post('/api/auth/logout', authenticate, (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    // Remove refresh token
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }
    
    // Update user status
    const user = users.get(req.user.userId);
    if (user) {
      user.isOnline = false;
    }
    
    res.json({ message: 'Logged out successfully' });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
app.get('/api/user/profile', authenticate, (req, res) => {
  try {
    const user = users.get(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      rating: user.rating,
      isOnline: user.isOnline
    });
    
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket connection handling
io.use(authenticateSocket);

io.on('connection', (socket) => {
  console.log(`User ${socket.user.userId} connected`);
  
  // Update user online status
  const user = users.get(socket.user.userId);
  if (user) {
    user.isOnline = true;
  }
  
  // Join user to their personal room for notifications
  socket.join(`user:${socket.user.userId}`);
  
  // Handle game room joining
  socket.on('join-game', (gameId) => {
    socket.join(`game:${gameId}`);
    console.log(`User ${socket.user.userId} joined game ${gameId}`);
  });
  
  // Handle game moves
  socket.on('make-move', (data) => {
    const { gameId, move } = data;
    
    // Basic validation (expand with rules engine)
    if (!gameId || !move) {
      socket.emit('error', { message: 'Invalid move data' });
      return;
    }
    
    // Broadcast move to other players in the game
    socket.to(`game:${gameId}`).emit('move-made', {
      gameId,
      move,
      playerId: socket.user.userId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Move made in game ${gameId} by user ${socket.user.userId}:`, move);
  });
  
  // Handle chat messages (IMPROVED XSS prevention)
  socket.on('chat-message', (data) => {
    const { gameId, message } = data;
    
    // Enhanced sanitization
    const sanitizedMessage = sanitizeInput(message);
    
    // Broadcast to game room
    io.to(`game:${gameId}`).emit('chat-message', {
      gameId,
      message: sanitizedMessage,
      playerId: socket.user.userId,
      playerName: user?.username || 'Anonymous',
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${socket.user.userId} disconnected`);
    
    // Update user status after a delay (in case of quick reconnection)
    setTimeout(() => {
      const userSockets = io.sockets.adapter.rooms.get(`user:${socket.user.userId}`);
      if (!userSockets || userSockets.size === 0) {
        const user = users.get(socket.user.userId);
        if (user) {
          user.isOnline = false;
        }
      }
    }, 5000); // 5 second delay
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Server startup (only if this file is run directly)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Los Alamos Chess Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`); 
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };