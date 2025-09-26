/**
 * Byron's Game Engine Integration Configuration
 * This file configures the integration between security and Byron's engine
 */

module.exports = {
    // Byron's engine settings
    engine: {
        enabled: true,
        startingFEN: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
        boardSize: 6,
        files: ['a', 'b', 'c', 'd', 'e', 'f'],
        ranks: [1, 2, 3, 4, 5, 6]
    },
    
    // Security settings
    security: {
        moveValidation: true,
        playerAuthorization: true,
        auditLogging: true,
        rateLimiting: true
    },
    
    // Game settings
    game: {
        timerDuration: 15 * 60, // 15 minutes in seconds
        allowTakebacks: false,
        allowDrawOffers: true
    }
};