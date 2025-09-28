/**
 * DATABASE INTEGRATION TESTS
 *
 * Purpose: Test that Byron's Rules Engine output can be stored in Arno's database schema
 * File Location: /backend/unit-tests/integration-tests/test-database-integration.js
 *
 * Tests:
 * 1. Rules Engine output format matches database requirements
 * 2. Move history format matches database storage schema
 * 3. Game state persistence and recovery scenarios
 * 4. FEN storage and retrieval integrity
 * 5. Database transaction handling for game operations
 */

const assert = require('assert');

// Import Byron's backend components
const RulesEngine = require('../../src/engine/index');
const AIBot = require('../../src/ai-bot/index');

// Mock Database Service for testing (based on Arno's schema)
class MockDatabaseService {
    constructor() {
        // Simulate database tables
        this.games = new Map();
        this.moves = new Map();
        this.users = new Map();
        this.gameStates = new Map();

        // Initialize with test users
        this.users.set(1, { id: 1, username: 'player1', rating: 1200 });
        this.users.set(2, { id: 2, username: 'AI-Bot', rating: 1500 });
    }

    // Game creation (matches Arno's schema expectations)
    async createGame(gameData) {
        const gameId = `game_${Date.now()}`;
        const game = {
            id: gameId,
            white_player_id: gameData.whitePlayerId,
            black_player_id: gameData.blackPlayerId,
            current_fen: gameData.startingFEN || 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1',
            move_history: JSON.stringify([]),
            status: gameData.status || 'active',
            result: null,
            created_at: new Date(),
            updated_at: new Date()
        };

        this.games.set(gameId, game);
        return game;
    }

    // Game state retrieval
    async getGameState(gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error(`Game ${gameId} not found`);
        }

        return {
            ...game,
            move_history: JSON.parse(game.move_history || '[]')
        };
    }

    // Move storage (matches expected schema)
    async saveMove(gameId, moveData) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error(`Game ${gameId} not found`);
        }

        // Store individual move record
        const moveId = `move_${Date.now()}_${Math.random()}`;
        const move = {
            id: moveId,
            game_id: gameId,
            player_id: moveData.playerId,
            move_notation: moveData.move, // UCI format from Rules Engine
            san_notation: moveData.san,   // SAN format from Rules Engine
            fen_before: moveData.fenBefore,
            fen_after: moveData.fenAfter,
            created_at: new Date()
        };

        this.moves.set(moveId, move);

        // Update game state
        const moveHistory = JSON.parse(game.move_history);
        moveHistory.push({
            move: moveData.move,
            san: moveData.san,
            timestamp: Date.now()
        });

        game.current_fen = moveData.fenAfter;
        game.move_history = JSON.stringify(moveHistory);
        game.updated_at = new Date();

        this.games.set(gameId, game);
        return move;
    }

    // Game completion
    async completeGame(gameId, result) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error(`Game ${gameId} not found`);
        }

        game.status = 'completed';
        game.result = result;
        game.ended_at = new Date();

        this.games.set(gameId, game);
        return game;
    }

    // Utility methods
    async getGameMoves(gameId) {
        const moves = [];
        for (const move of this.moves.values()) {
            if (move.game_id === gameId) {
                moves.push(move);
            }
        }
        return moves.sort((a, b) => a.created_at - b.created_at);
    }
}

// Mock Game Repository (based on existing structure)
class MockGameRepository {
    constructor(databaseService) {
        this.db = databaseService;
        this.rulesEngine = new RulesEngine();
    }

    async createGame(whitePlayerId, blackPlayerId, gameSettings = {}) {
        const gameData = {
            whitePlayerId,
            blackPlayerId,
            startingFEN: gameSettings.startingFEN,
            timeControl: gameSettings.timeControl || 'blitz',
            isRated: gameSettings.isRated || true
        };

        return await this.db.createGame(gameData);
    }

    async makeMove(gameId, playerId, move) {
        // Get current game state
        const gameState = await this.db.getGameState(gameId);
        const currentFEN = gameState.current_fen;

        // Validate move using Byron's Rules Engine
        const validation = this.rulesEngine.validateMove(currentFEN, move);
        if (!validation.valid) {
            throw new Error(`Invalid move: ${validation.error}`);
        }

        // Apply move using Byron's Rules Engine
        const moveResult = this.rulesEngine.applyMove(currentFEN, move);

        // Save to database in expected format
        const moveData = {
            playerId,
            move: move,                    // UCI format
            san: moveResult.san,           // SAN format
            fenBefore: currentFEN,
            fenAfter: moveResult.newFEN
        };

        return await this.db.saveMove(gameId, moveData);
    }

    async getGameWithMoves(gameId) {
        const gameState = await this.db.getGameState(gameId);
        const moves = await this.db.getGameMoves(gameId);

        return {
            ...gameState,
            moves: moves
        };
    }
}

describe('💾 Database Integration Tests', () => {
    let rulesEngine;
    let aiBot;
    let mockDB;
    let gameRepository;

    beforeEach(() => {
        // Initialize Byron's components
        rulesEngine = new RulesEngine();
        aiBot = new AIBot();
        mockDB = new MockDatabaseService();
        gameRepository = new MockGameRepository(mockDB);

        console.log('🔧 Database integration test setup complete');
    });

    describe('🎮 Game State Persistence', () => {

        /**
         * Test: Rules Engine output matches database storage requirements
         * Expected: All Rules Engine data can be stored without transformation
         * Description: Ensures database schema supports Byron's engine output format
         */
        it('should store Rules Engine output in database format', async () => {
            console.log('💾 Testing Rules Engine database storage compatibility...');

            try {
                // Create test game
                const game = await gameRepository.createGame(1, 2);
                const gameId = game.id;

                // Get starting position from Rules Engine
                const startFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';
                const legalMoves = rulesEngine.getLegalMoves(startFEN);

                // Test first move storage
                const firstMove = legalMoves[0];
                const moveResult = rulesEngine.applyMove(startFEN, firstMove);

                // Verify Rules Engine output format
                const requiredFields = ['newFEN', 'san', 'moveType'];
                requiredFields.forEach(field => {
                    assert(moveResult.hasOwnProperty(field),
                        `❌ Rules Engine missing required field: ${field}\nExpected: ${requiredFields}\nGot: ${Object.keys(moveResult)}`);
                });

                // Store move in database
                const savedMove = await gameRepository.makeMove(gameId, 1, firstMove);

                // Verify database storage format matches Rules Engine output
                assert(savedMove.move_notation === firstMove,
                    `❌ Move notation mismatch\nExpected: ${firstMove}\nGot: ${savedMove.move_notation}`);
                assert(savedMove.san_notation === moveResult.san,
                    `❌ SAN notation mismatch\nExpected: ${moveResult.san}\nGot: ${savedMove.san_notation}`);
                assert(savedMove.fen_after === moveResult.newFEN,
                    `❌ FEN after mismatch\nExpected: ${moveResult.newFEN}\nGot: ${savedMove.fen_after}`);

                // Verify game state is updated correctly
                const updatedGame = await mockDB.getGameState(gameId);
                assert(updatedGame.current_fen === moveResult.newFEN,
                    `❌ Game state FEN not updated\nExpected: ${moveResult.newFEN}\nGot: ${updatedGame.current_fen}`);

                console.log('✅ Rules Engine database storage compatibility passed');
                console.log(`📊 Stored move: ${firstMove} (${moveResult.san})`);

            } catch (error) {
                assert.fail(`❌ Rules Engine database storage failed\nExpected: Successful storage\nGot Error: ${error.message}`);
            }
        });

        /**
         * Test: Move history format matches database schema expectations
         * Expected: Move history can be stored and retrieved as JSON
         * Description: Ensures move sequences are properly stored for game replay
         */
        it('should handle move history in database-compatible JSON format', async () => {
            console.log('📚 Testing move history database format...');

            try {
                // Create game and play several moves
                const game = await gameRepository.createGame(1, 2);
                const gameId = game.id;

                let currentFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';
                const playedMoves = [];

                // Play 4 moves (2 for each player)
                for (let moveNum = 0; moveNum < 4; moveNum++) {
                    const legalMoves = rulesEngine.getLegalMoves(currentFEN);
                    const selectedMove = legalMoves[0]; // Take first legal move
                    const playerId = (moveNum % 2) + 1; // Alternate players

                    // Apply move using Rules Engine
                    const moveResult = rulesEngine.applyMove(currentFEN, selectedMove);

                    // Store in database
                    await gameRepository.makeMove(gameId, playerId, selectedMove);

                    playedMoves.push({
                        move: selectedMove,
                        san: moveResult.san,
                        fen: moveResult.newFEN
                    });

                    currentFEN = moveResult.newFEN;
                }

                // Retrieve complete game with move history
                const completeGame = await gameRepository.getGameWithMoves(gameId);

                // Verify move history structure
                assert(Array.isArray(completeGame.moves),
                    `❌ Move history should be array\nExpected: Array\nGot: ${typeof completeGame.moves}`);
                assert(completeGame.moves.length === 4,
                    `❌ Incorrect move count\nExpected: 4 moves\nGot: ${completeGame.moves.length} moves`);

                // Verify each move in history
                completeGame.moves.forEach((dbMove, index) => {
                    const expectedMove = playedMoves[index];

                    assert(dbMove.move_notation === expectedMove.move,
                        `❌ Move ${index} notation mismatch\nExpected: ${expectedMove.move}\nGot: ${dbMove.move_notation}`);
                    assert(dbMove.san_notation === expectedMove.san,
                        `❌ Move ${index} SAN mismatch\nExpected: ${expectedMove.san}\nGot: ${dbMove.san_notation}`);
                    assert(dbMove.fen_after === expectedMove.fen,
                        `❌ Move ${index} FEN mismatch\nExpected: ${expectedMove.fen}\nGot: ${dbMove.fen_after}`);
                });

                // Verify JSON serialization/deserialization
                const gameState = await mockDB.getGameState(gameId);
                const moveHistory = JSON.parse(gameState.move_history);

                assert(Array.isArray(moveHistory),
                    `❌ Parsed move history not array\nExpected: Array\nGot: ${typeof moveHistory}`);
                assert(moveHistory.length === 4,
                    `❌ Parsed move history length\nExpected: 4\nGot: ${moveHistory.length}`);

                console.log('✅ Move history database format validation passed');
                console.log(`📊 Stored ${playedMoves.length} moves successfully`);

            } catch (error) {
                assert.fail(`❌ Move history database format failed\nExpected: Proper JSON storage\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🔄 Game State Recovery', () => {

        /**
         * Test: Game state can be recovered and resumed from database
         * Expected: Reconstructed game state matches Rules Engine requirements
         * Description: Ensures games can be properly resumed after server restart
         */
        it('should recover and resume games from database state', async () => {
            console.log('🔄 Testing game state recovery...');

            try {
                // Create and play partial game
                const game = await gameRepository.createGame(1, 2);
                const gameId = game.id;

                let currentFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';

                // Play several moves
                for (let i = 0; i < 6; i++) {
                    const legalMoves = rulesEngine.getLegalMoves(currentFEN);
                    const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                    const playerId = (i % 2) + 1;

                    await gameRepository.makeMove(gameId, playerId, move);
                    const moveResult = rulesEngine.applyMove(currentFEN, move);
                    currentFEN = moveResult.newFEN;
                }

                // Simulate server restart - recover game state
                const recoveredGame = await gameRepository.getGameWithMoves(gameId);
                const recoveredFEN = recoveredGame.current_fen;

                // Verify Rules Engine can work with recovered state
                const legalMovesFromRecovered = rulesEngine.getLegalMoves(recoveredFEN);

                // Verify recovered state is valid
                assert(Array.isArray(legalMovesFromRecovered),
                    `❌ Recovered state invalid\nExpected: Legal moves array\nGot: ${typeof legalMovesFromRecovered}`);
                assert(legalMovesFromRecovered.length > 0,
                    `❌ No legal moves from recovered state\nExpected: > 0 moves\nGot: ${legalMovesFromRecovered.length}`);

                // Test that Rules Engine can continue the game
                const nextMove = legalMovesFromRecovered[0];
                const continueResult = rulesEngine.applyMove(recoveredFEN, nextMove);

                assert(continueResult.newFEN !== recoveredFEN,
                    `❌ Game state not advancing\nExpected: Different FEN\nGot: Same FEN`);
                assert(typeof continueResult.san === 'string',
                    `❌ Invalid SAN from recovered state\nExpected: string\nGot: ${typeof continueResult.san}`);

                // Verify move history integrity
                assert(recoveredGame.moves.length === 6,
                    `❌ Move history incomplete\nExpected: 6 moves\nGot: ${recoveredGame.moves.length} moves`);

                // Verify moves can be replayed from history
                let replayFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';
                for (const move of recoveredGame.moves) {
                    const replayResult = rulesEngine.applyMove(replayFEN, move.move_notation);
                    assert(replayResult.newFEN === move.fen_after,
                        `❌ Replay mismatch at move ${move.move_notation}\nExpected: ${move.fen_after}\nGot: ${replayResult.newFEN}`);
                    replayFEN = replayResult.newFEN;
                }

                assert(replayFEN === recoveredFEN,
                    `❌ Replay doesn't match current state\nExpected: ${recoveredFEN}\nGot: ${replayFEN}`);

                console.log('✅ Game state recovery validation passed');
                console.log(`📊 Recovered game with ${recoveredGame.moves.length} moves`);

            } catch (error) {
                assert.fail(`❌ Game state recovery failed\nExpected: Successful recovery\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🤖 AI Game Database Integration', () => {

        /**
         * Test: AI Bot games are properly stored in database
         * Expected: AI moves and metadata stored correctly
         * Description: Ensures AI games can be stored and analyzed
         */
        it('should store AI bot games with proper metadata', async () => {
            console.log('🤖 Testing AI bot database integration...');

            try {
                // Create human vs AI game
                const game = await gameRepository.createGame(1, 2, {
                    timeControl: 'blitz',
                    isRated: true
                });
                const gameId = game.id;

                let currentFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';

                // Human player makes first move
                const humanLegalMoves = rulesEngine.getLegalMoves(currentFEN);
                const humanMove = humanLegalMoves[0];
                await gameRepository.makeMove(gameId, 1, humanMove);

                const humanMoveResult = rulesEngine.applyMove(currentFEN, humanMove);
                currentFEN = humanMoveResult.newFEN;

                // AI makes response move
                const aiResponse = await aiBot.generateMove(currentFEN, 'L2', 3000);

                // Verify AI response format for database storage
                const requiredAIFields = ['move', 'newFEN', 'san', 'metadata'];
                requiredAIFields.forEach(field => {
                    assert(aiResponse.hasOwnProperty(field),
                        `❌ AI response missing field: ${field}\nExpected: ${requiredAIFields}\nGot: ${Object.keys(aiResponse)}`);
                });

                // Store AI move in database
                const aiMoveData = {
                    playerId: 2, // AI player
                    move: aiResponse.move,
                    san: aiResponse.san,
                    fenBefore: currentFEN,
                    fenAfter: aiResponse.newFEN,
                    metadata: JSON.stringify(aiResponse.metadata) // Store AI metadata
                };

                const savedAIMove = await mockDB.saveMove(gameId, aiMoveData);

                // Verify AI move storage
                assert(savedAIMove.move_notation === aiResponse.move,
                    `❌ AI move notation mismatch\nExpected: ${aiResponse.move}\nGot: ${savedAIMove.move_notation}`);
                assert(savedAIMove.san_notation === aiResponse.san,
                    `❌ AI SAN mismatch\nExpected: ${aiResponse.san}\nGot: ${savedAIMove.san_notation}`);

                // Verify AI metadata can be retrieved
                if (savedAIMove.metadata) {
                    const retrievedMetadata = JSON.parse(savedAIMove.metadata);
                    assert(typeof retrievedMetadata === 'object',
                        `❌ AI metadata format invalid\nExpected: object\nGot: ${typeof retrievedMetadata}`);
                }

                // Retrieve complete game with both human and AI moves
                const completeGame = await gameRepository.getGameWithMoves(gameId);
                assert(completeGame.moves.length === 2,
                    `❌ Missing moves in database\nExpected: 2 moves\nGot: ${completeGame.moves.length} moves`);

                // Verify move alternation (human then AI)
                assert(completeGame.moves[0].player_id === 1,
                    `❌ First move not by human\nExpected: player_id 1\nGot: ${completeGame.moves[0].player_id}`);
                assert(completeGame.moves[1].player_id === 2,
                    `❌ Second move not by AI\nExpected: player_id 2\nGot: ${completeGame.moves[1].player_id}`);

                console.log('✅ AI bot database integration passed');
                console.log(`📊 Human move: ${humanMove}, AI move: ${aiResponse.move}`);

            } catch (error) {
                assert.fail(`❌ AI bot database integration failed\nExpected: Successful AI game storage\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🎯 Database Transaction Integrity', () => {

        /**
         * Test: Database transactions handle Rules Engine failures gracefully
         * Expected: Failed moves don't corrupt game state
         * Description: Ensures database consistency when move validation fails
         */
        it('should maintain database integrity on Rules Engine failures', async () => {
            console.log('🎯 Testing database transaction integrity...');

            try {
                // Create test game
                const game = await gameRepository.createGame(1, 2);
                const gameId = game.id;

                const initialFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';

                // Make valid move first
                const legalMoves = rulesEngine.getLegalMoves(initialFEN);
                const validMove = legalMoves[0];
                await gameRepository.makeMove(gameId, 1, validMove);

                const gameAfterValidMove = await mockDB.getGameState(gameId);
                const validMoveFEN = gameAfterValidMove.current_fen;

                // Attempt invalid move that should fail
                const invalidMove = 'z9z9'; // Invalid coordinates

                try {
                    await gameRepository.makeMove(gameId, 2, invalidMove);
                    assert.fail('Should have failed with invalid move');
                } catch (error) {
                    // Expected to fail - verify error message
                    assert(error.message.includes('Invalid move'),
                        `❌ Wrong error message\nExpected: Contains 'Invalid move'\nGot: ${error.message}`);
                }

                // Verify game state unchanged after failed move
                const gameAfterFailedMove = await mockDB.getGameState(gameId);
                assert(gameAfterFailedMove.current_fen === validMoveFEN,
                    `❌ Game state corrupted by failed move\nExpected: ${validMoveFEN}\nGot: ${gameAfterFailedMove.current_fen}`);

                // Verify move count unchanged
                const movesAfterFailure = await mockDB.getGameMoves(gameId);
                assert(movesAfterFailure.length === 1,
                    `❌ Move count changed after failure\nExpected: 1 move\nGot: ${movesAfterFailure.length} moves`);

                // Verify game can continue with valid move
                const legalMovesAfterFailure = rulesEngine.getLegalMoves(validMoveFEN);
                const nextValidMove = legalMovesAfterFailure[0];
                await gameRepository.makeMove(gameId, 2, nextValidMove);

                const finalGame = await mockDB.getGameState(gameId);
                const finalMoves = await mockDB.getGameMoves(gameId);

                // Verify successful continuation
                assert(finalMoves.length === 2,
                    `❌ Game didn't continue properly\nExpected: 2 moves\nGot: ${finalMoves.length} moves`);
                assert(finalGame.current_fen !== validMoveFEN,
                    `❌ Game state didn't advance\nExpected: Different FEN\nGot: Same FEN`);

                console.log('✅ Database transaction integrity validation passed');
                console.log(`📊 Handled invalid move gracefully, game continued`);

            } catch (error) {
                assert.fail(`❌ Database transaction integrity failed\nExpected: Graceful error handling\nGot Error: ${error.message}`);
            }
        });
    });

    after(() => {
        console.log('🧹 Database integration tests cleanup complete');
    });
});

// Export utilities for other integration tests
module.exports = {
    MockDatabaseService,
    MockGameRepository,
    testRulesEngineDBCompatibility: (rulesEngine, moveResult) => {
        const requiredFields = ['newFEN', 'san', 'moveType'];
        return requiredFields.every(field => moveResult.hasOwnProperty(field));
    },
    testMoveHistoryFormat: (moveHistory) => {
        return Array.isArray(moveHistory) &&
               moveHistory.every(move =>
                   move.hasOwnProperty('move') &&
                   move.hasOwnProperty('san') &&
                   move.hasOwnProperty('timestamp')
               );
    }
};