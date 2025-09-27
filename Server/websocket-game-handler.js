/**
 * WEBSOCKET GAME HANDLER
 * 
 * Purpose: Handle real-time chess game communication via WebSocket
 * Integrates: Game engine, database, security validation, move authorization
 * 
 * Input: WebSocket messages (moves, chat, game events)
 * Output: Validated game updates, real-time notifications
 * 
 * File Location: /Server/websocket-game-handler.js
 */

const WebSocket = require('ws');
const GameDatabaseManager = require('./game-database');
const { validateMove } = require('../security/enhanced-move-validator');
const { authorizeGameAction } = require('../security/move-authorization');


const WebSocketGameHandler = require('./websocket-game-handler');

// Initialize WebSocket Game Handler with database config
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'chess_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
};

const gameHandler = new WebSocketGameHandler(server, dbConfig);

// Load Byron's Rules Engine if available
try {
    const ByronEngine = require('../backend/src/engine/index');
    gameHandler.setByronEngine(ByronEngine);
    console.log('Byron\'s Rules Engine initialized successfully');
} catch (error) {
    console.warn('Byron\'s Rules Engine not found:', error.message);
}

module.exports = WebSocketGameHandler;