// security/index.js
const AuthenticationService = require('../src/models/AuthenticationService');
const authMiddleware = require('./auth-middleware');
const createAuthRoutes = require('./auth-routes');
const WebSocketAuthenticator = require('./websocket-auth');
const { MoveAuthorizationService } = require('./move-authorization');

module.exports = {
    AuthenticationService,
    authMiddleware,
    createAuthRoutes,
    WebSocketAuthenticator,
    MoveAuthorizationService
};