// config/database.js - Database configuration

//  this mainly focusses on some of the integration with the database although integration is not necessary for this progress demo the protocols are vital in the setup
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

module.exports = pool;

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

// const authenticateSocket = (socket, next) => {
//   try {
//     const token = socket.handshake.auth.token;
    
//     if (!token) {
//       return next(new Error('Authentication error'));
//     }
    
//     const decoded = jwt.verify(token, JWT_SECRET);
//     socket.user = decoded;
//     next();
//   } catch (error) {
//     return next(new Error('Invalid token'));
//   }
// };

// incorrect code commented out above
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
    return next(new Error('Invalid token'));
  }
};

module.exports = { authenticate, authenticateSocket };

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

module.exports = new Logger();

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

module.exports = { schemas, validate };

// ================================================
// .gitignore
/*
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# ESLint cache
.eslintcache

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
*/

// ================================================
// eslint.config.js - ESLint configuration
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    'indent': ['error', 2],
    'comma-dangle': ['error', 'never']
  }
};

// ================================================
// tests/server.test.js - Basic server tests
const request = require('supertest');
const { app } = require('../server');

describe('Server Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
  });
});

describe('Authentication Routes', () => {
  test('POST /api/auth/register should create user', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };
    
    const response = await request(app)
      .post('/api/auth/register')
      .send(userData);
    
    expect(response.status).toBe(201);
    expect(response.body.user.username).toBe(userData.username);
    expect(response.body.accessToken).toBeDefined();
  });
  
  test('POST /api/auth/login should authenticate user', async () => {
    // First register a user
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'logintest',
        email: 'login@example.com',
        password: 'password123'
      });
    
    // Then login
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeDefined();
  });
});

// ================================================
// README.md content
/*
# Los Alamos Chess Server

A Node.js/Express server for the Los Alamos Chess Platform (EPE321 Group 14 Project).

## Features

- JWT Authentication with refresh tokens
- Real-time WebSocket communication
- Rate limiting and security headers
- Input validation
- Comprehensive logging
- Unit testing setup
- PostgreSQL integration ready

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - User login
- POST `/api/auth/refresh` - Refresh access token
- POST `/api/auth/logout` - User logout

### User
- GET `/api/user/profile` - Get user profile (authenticated)

### WebSocket Events

#### Client to Server
- `join-game` - Join a game room
- `make-move` - Make a chess move
- `chat-message` - Send chat message

#### Server to Client
- `move-made` - Chess move broadcast
- `chat-message` - Chat message broadcast
- `error` - Error notifications

## Project Structure

```
├── server.js              # Main server file
├── config/
│   └── database.js        # Database configuration
├── middleware/
│   └── auth.js            # Authentication middleware
├── utils/
│   ├── logger.js          # Logging utility
│   └── validation.js      # Input validation
├── tests/
│   └── server.test.js     # Test files
├── logs/                  # Log files
└── package.json
```

## Environment Variables

See `.env.example` for all available configuration options.

## Security Features

- Bcrypt password hashing (12 rounds)
- JWT tokens with short expiry (15 min access, 7 day refresh)
- Rate limiting on authentication endpoints
- CORS protection
- Security headers via Helmet
- Input sanitization
- SQL injection prevention (with PostgreSQL integration)

## Testing

Run the test suite:
```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## Team Responsibilities

- **Ethan (Networking)**: WebSocket server, JWT auth, real-time features
- **Byron (Game Logic)**: Rules engine integration, AI bot orchestration
- **Arno (Database)**: PostgreSQL schema, persistence layer
- **Elizabeth (Security)**: Authentication, RBAC, POPIA compliance
- **Nastasha (Frontend)**: Client-side integration points

## Development Guidelines

1. Follow ESLint configuration
2. Write unit tests for new features
3. Use semantic commit messages
4. Keep environment secrets secure
5. Log important events
6. Handle errors gracefully

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure PostgreSQL connection
4. Set up proper logging
5. Enable HTTPS
6. Configure reverse proxy (nginx)
7. Set up monitoring

## License

MIT License - EPE321 Group 14 Project
*/