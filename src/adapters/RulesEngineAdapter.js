/**
 * Rules Engine Adapter
 * Transforms data between database format and Byron's Rules Engine format
 */

class RulesEngineAdapter {
    /**
     * Transform database game record to Byron's board object format
     * @param {Object} dbGame - Game record from database
     * @returns {Object} Board object for rules engine
     */
    static dbGameToBoardObject(dbGame) {
        if (!dbGame || !dbGame.current_fen) {
            return null;
        }

        // Byron's rules engine parseFEN expects a FEN string
        // and returns a board object with the structure he needs
        // We just need to ensure the FEN is properly formatted
        return {
            fen: dbGame.current_fen,
            gameId: dbGame.id,
            version: dbGame.version,
            status: dbGame.status,
            whiteClockMs: dbGame.white_clock_ms,
            blackClockMs: dbGame.black_clock_ms
        };
    }

    /**
     * Transform Byron's move result back to database update format
     * @param {Object} moveResult - Result from rulesEngine.applyMove()
     * @param {string} uci - The UCI move string
     * @param {Object} gameState - Current game state
     * @returns {Object} Database update object
     */
    static moveResultToDbUpdate(moveResult, uci, gameState) {
        if (!moveResult || !moveResult.fen) {
            return null;
        }

        // Parse the new FEN to extract turn and move numbers
        const fenParts = moveResult.fen.split(' ');
        const turn = fenParts[1]; // 'w' or 'b'
        const halfMoveClock = parseInt(fenParts[4]);
        const fullMoveNumber = parseInt(fenParts[5]);

        return {
            current_fen: moveResult.fen,
            to_move: turn,
            status: this.mapEngineStatusToDb(moveResult.status),
            ply: gameState.ply + 1,
            halfMoveClock: halfMoveClock,
            fullMoveNumber: fullMoveNumber,
            version: gameState.version + 1,
            updated_at: new Date()
        };
    }

    /**
     * Transform Byron's move result to database move record
     * @param {string} gameId - Game ID
     * @param {Object} moveResult - Result from rulesEngine.applyMove()
     * @param {string} uci - UCI move string
     * @param {Object} gameState - Current game state before move
     * @param {string} by - 'human' or 'bot'
     * @returns {Object} Database move record
     */
    static moveResultToDbMove(gameId, moveResult, uci, gameState, by = 'human') {
        if (!moveResult || !gameId || !uci) {
            return null;
        }

        // Generate SAN notation - Byron's engine should provide this
        // For now, we'll use a placeholder until Byron adds SAN generation
        const san = this.generateBasicSAN(uci, moveResult);

        return {
            game_id: gameId,
            ply: gameState.ply + 1,
            by: by,
            uci: uci,
            san: san,
            flags: JSON.stringify(moveResult.flags || {}),
            prev_fen: gameState.current_fen,
            next_fen: moveResult.fen,
            server_ms_spent: 0, // Will be set by caller if needed
            created_at: new Date()
        };
    }

    /**
     * Map Byron's game status to database status
     * @param {string} engineStatus - Status from rules engine
     * @returns {string} Database status
     */
    static mapEngineStatusToDb(engineStatus) {
        const statusMap = {
            'ONGOING': 'active',
            'CHECKMATE': 'mate',
            'STALEMATE': 'stalemate',
            'DRAW': 'draw'
        };
        return statusMap[engineStatus] || 'active';
    }

    /**
     * Map database status to engine status
     * @param {string} dbStatus - Status from database
     * @returns {string} Engine status
     */
    static mapDbStatusToEngine(dbStatus) {
        const statusMap = {
            'active': 'ONGOING',
            'mate': 'CHECKMATE',
            'stalemate': 'STALEMATE',
            'draw': 'DRAW'
        };
        return statusMap[dbStatus] || 'ONGOING';
    }

    /**
     * Generate basic SAN notation from UCI
     * This is a simplified implementation until Byron adds SAN generation
     * @param {string} uci - UCI move
     * @param {Object} moveResult - Move result with flags
     * @returns {string} Basic SAN notation
     */
    static generateBasicSAN(uci, moveResult) {
        if (!uci || uci.length < 4) return uci;

        let san = '';
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promotion = uci[4] || null;

        // This is a very basic SAN generation
        // Byron's engine should eventually provide proper SAN
        san = to;

        if (moveResult.flags) {
            if (moveResult.flags.capture) san = 'x' + san;
            if (promotion) san += '=' + promotion.toUpperCase();
            if (moveResult.flags.checkmate) san += '#';
            else if (moveResult.flags.check) san += '+';
        }

        return san || uci; // Fallback to UCI if SAN generation fails
    }

    /**
     * Validate move data consistency between engine and database
     * @param {Object} gameState - Current game state from DB
     * @param {string} uci - UCI move
     * @returns {Object} Validation result
     */
    static validateMoveConsistency(gameState, uci) {
        // Basic validation
        if (!gameState) {
            return { valid: false, error: 'No game state provided' };
        }

        if (!uci || typeof uci !== 'string') {
            return { valid: false, error: 'Invalid UCI format' };
        }

        if (gameState.status !== 'active') {
            return { valid: false, error: 'Game is not active' };
        }

        // UCI format validation
        const uciRegex = /^[a-f][1-6][a-f][1-6][qrn]?$/;
        if (!uciRegex.test(uci)) {
            return { valid: false, error: 'Invalid UCI move format' };
        }

        return { valid: true };
    }

    /**
     * Extract player authorization info from game state
     * @param {Object} gameState - Game state from database
     * @returns {Object} Authorization info
     */
    static extractAuthorizationInfo(gameState) {
        if (!gameState) return null;

        return {
            whitePlayerId: gameState.white_player_id,
            blackPlayerId: gameState.black_player_id,
            currentTurn: gameState.to_move,
            activePlayerId: gameState.to_move === 'w' ? 
                gameState.white_player_id : 
                gameState.black_player_id
        };
    }
}

module.exports = RulesEngineAdapter;