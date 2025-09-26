// config.js - Configuration utilities only (FIXED - removed circular dependencies)

// ================================================
// config/database.js - Database configuration
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'los_alamos_chess',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait when connecting
});

// ================================================
// middleware/auth.js - Authentication middleware
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    return next(new Error('Authentication error'));  // Changed from 'Invalid token'
  }
};

// ================================================
// utils/logger.js - Logging utility
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.ensureLogDirectory();
  }
  
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      data
    };
    
    // Console output
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
    
    // File output
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }
  
  info(message, data) { this.log('info', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }
  debug(message, data) { this.log('debug', message, data); }
}

const logger = new Logger();

// ================================================
// utils/validation.js - Input validation utilities
const Joi = require('joi');

const schemas = {
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required()
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required()
  }),
  
  move: Joi.object({
    gameId: Joi.string().required(),
    from: Joi.string().pattern(/^[a-f][1-6]$/).required(),
    to: Joi.string().pattern(/^[a-f][1-6]$/).required(),
    promotion: Joi.string().valid('q', 'r', 'n').optional()
  })
};

const validate = (schema, data) => {
  const { error, value } = schema.validate(data);
  if (error) {
    throw new Error(error.details[0].message);
  }
  return value;
};

// Export everything - REMOVED the circular dependency parts
module.exports = { 
  pool, 
  authenticate, 
  authenticateSocket, 
  logger, 
  schemas, 
  validate 
};