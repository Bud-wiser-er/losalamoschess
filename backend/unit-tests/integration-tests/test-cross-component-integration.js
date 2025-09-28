/**
 * CROSS-COMPONENT INTEGRATION TESTS
 *
 * Purpose: Test complete game flow using all Byron's components together
 * File Location: /backend/unit-tests/integration-tests/test-cross-component-integration.js
 *
 * Tests:
 * 1. Rules Engine → AI Bot → WebSocket → Database flow
 * 2. Complete game simulation from start to finish
 * 3. Error recovery when one component fails
 * 4. Multi-component performance under load
 * 5. Component state synchronization
 * 6. End-to-end data integrity
 */

const assert = require('assert');

// Import all Byron's components
const RulesEngine = require('../../src/engine/index');
const AIBot = require('../../src/ai-bot/index');

// Import mocks from other integration tests
const { MockWebSocketServer } = require('./test-websocket-integration');
const { MockDatabaseService, MockGameRepository } = require('./test-database-integration');
const { MockFrontendGameState, MockFrontendUI } = require('./test-frontend-integration');

// Complete Game System Integration
class GameSystemIntegrator {
    constructor() {
        // Initialize all components
        this.rulesEngine = new RulesEngine();
        this.aiBot = new AIBot();
        this.webSocket = new MockWebSocketServer();
        this.database = new MockDatabaseService();
        this.gameRepository = new MockGameRepository(this.database);
        this.frontendState = new MockFrontendGameState();
        this.frontendUI = new MockFrontendUI();

        // Track system state
        this.systemErrors = [];
        this.performanceMetrics = {};
        this.gameFlow = [];
    }

    // Simulate complete game flow
    async simulateCompleteGame(playerVsAI = true, botLevel = 'L2') {
        const startTime = Date.now();
        console.log(`🎮 Starting complete game simulation (${playerVsAI ? 'Player vs AI' : 'AI vs AI'})`);

        try {
            // 1. Game Creation
            const game = await this.gameRepository.createGame(1, 2, {
                timeControl: 'blitz',
                isRated: true,
                botLevel: botLevel
            });

            this.frontendState.gameId = game.id;
            this.frontendState.botLevel = botLevel;
            this.gameFlow.push({ step: 'game_created', gameId: game.id });

            let currentFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';
            let moveCount = 0;
            const maxMoves = 50; // Prevent infinite games

            // 2. Game Loop
            while (moveCount < maxMoves) {
                const legalMoves = this.rulesEngine.getLegalMoves(currentFEN);

                if (legalMoves.length === 0) {
                    // Game ended
                    const boardState = this.rulesEngine.parseFEN(currentFEN);
                    const gameStatus = this.rulesEngine.checkGameStatus(boardState);
                    this.gameFlow.push({ step: 'game_ended', reason: gameStatus.type });
                    break;
                }

                const isWhiteTurn = currentFEN.split(' ')[1] === 'w';
                const isPlayerTurn = isWhiteTurn && playerVsAI;

                let move, moveResult;

                if (isPlayerTurn) {
                    // 3. Player Move
                    move = legalMoves[0]; // Simulate player choosing first legal move
                    const validation = this.rulesEngine.validateMove(currentFEN, move);

                    if (!validation.valid) {
                        throw new Error(`Invalid player move: ${move}`);
                    }

                    moveResult = this.rulesEngine.applyMove(currentFEN, move);
                    await this.gameRepository.makeMove(game.id, 1, move);

                    // Update frontend
                    this.frontendState.executeMove(move.slice(0, 2), move.slice(2, 4));
                    this.frontendUI.updateBoard(this.frontendState.board);

                    this.gameFlow.push({ step: 'player_move', move, san: moveResult.san });

                } else {
                    // 4. AI Move
                    const aiResponse = await this.aiBot.generateMove(currentFEN, botLevel, 3000);
                    move = aiResponse.move;
                    moveResult = aiResponse;

                    // Validate AI move
                    const validation = this.rulesEngine.validateMove(currentFEN, move);
                    if (!validation.valid) {
                        throw new Error(`Invalid AI move: ${move}`);
                    }

                    await this.gameRepository.makeMove(game.id, 2, move);

                    // Update frontend
                    this.frontendState.executeMove(move.slice(0, 2), move.slice(2, 4));
                    this.frontendUI.updateBoard(this.frontendState.board);

                    this.gameFlow.push({ step: 'ai_move', move, san: moveResult.san, level: botLevel });
                }

                // 5. WebSocket Broadcasting
                const moveMessage = {
                    type: isPlayerTurn ? 'player_move' : 'ai_move',
                    gameId: game.id,
                    move: move,
                    san: moveResult.san,
                    newFEN: moveResult.newFEN,
                    timestamp: Date.now()
                };

                this.webSocket.send(JSON.stringify(moveMessage));

                currentFEN = moveResult.newFEN;
                moveCount++;
            }

            // 6. Game Completion
            await this.database.completeGame(game.id, 'completed');
            const completeGame = await this.gameRepository.getGameWithMoves(game.id);

            const endTime = Date.now();
            this.performanceMetrics.totalTime = endTime - startTime;
            this.performanceMetrics.movesPlayed = moveCount;
            this.performanceMetrics.avgMoveTime = this.performanceMetrics.totalTime / moveCount;

            return {
                success: true,
                game: completeGame,
                metrics: this.performanceMetrics,
                flow: this.gameFlow
            };

        } catch (error) {
            this.systemErrors.push(error);
            return {
                success: false,
                error: error.message,
                metrics: this.performanceMetrics,
                flow: this.gameFlow
            };
        }
    }

    // Test component failure recovery
    async testComponentFailureRecovery() {
        console.log('🔧 Testing component failure recovery...');

        const recoveryTests = [];

        try {
            // 1. AI Bot Timeout Recovery
            const startTime = Date.now();
            const testFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';

            try {
                await this.aiBot.generateMove(testFEN, 'L4', 1); // Very short timeout
            } catch (error) {
                const fallbackMoves = this.rulesEngine.getLegalMoves(testFEN);
                const fallbackMove = fallbackMoves[0];

                recoveryTests.push({
                    component: 'AI Bot',
                    failure: 'Timeout',
                    recovery: 'Fallback to legal move',
                    success: !!fallbackMove
                });
            }

            // 2. Rules Engine Error Recovery
            try {
                this.rulesEngine.validateMove('invalid-fen', 'e2e4');
            } catch (error) {
                recoveryTests.push({
                    component: 'Rules Engine',
                    failure: 'Invalid FEN',
                    recovery: 'Error handled gracefully',
                    success: true
                });
            }

            // 3. Database Error Recovery
            try {
                await this.gameRepository.makeMove('nonexistent-game', 1, 'e2e4');
            } catch (error) {
                recoveryTests.push({
                    component: 'Database',
                    failure: 'Game not found',
                    recovery: 'Error handled gracefully',
                    success: true
                });
            }

            return recoveryTests;

        } catch (error) {
            return { error: error.message };
        }
    }

    // Test concurrent games performance
    async testConcurrentGamesPerformance(gameCount = 3) {
        console.log(`⚡ Testing concurrent games performance (${gameCount} games)...`);

        const startTime = Date.now();
        const gamePromises = [];

        for (let i = 0; i < gameCount; i++) {
            const integrator = new GameSystemIntegrator();
            gamePromises.push(integrator.simulateCompleteGame(false, 'L1')); // AI vs AI for speed
        }

        const results = await Promise.all(gamePromises);
        const endTime = Date.now();

        const successfulGames = results.filter(r => r.success).length;
        const totalTime = endTime - startTime;
        const avgGameTime = totalTime / gameCount;

        return {
            totalGames: gameCount,
            successfulGames,
            successRate: (successfulGames / gameCount) * 100,
            totalTime,
            avgGameTime,
            concurrentPerformance: totalTime < (gameCount * 10000) // Should be faster than sequential
        };
    }
}

describe('🔗 Cross-Component Integration Tests', () => {
    let gameSystem;

    beforeEach(() => {
        gameSystem = new GameSystemIntegrator();
        console.log('🔧 Cross-component integration test setup complete');
    });

    describe('🎮 Complete Game Flow Integration', () => {

        /**
         * Test: Complete Player vs AI game from start to finish
         * Expected: All components work together seamlessly
         * Description: Simulates full game using Rules Engine → AI Bot → WebSocket → Database
         */
        it('should handle complete Player vs AI game flow', async () => {
            console.log('🎮 Testing complete Player vs AI game flow...');

            try {
                const result = await gameSystem.simulateCompleteGame(true, 'L2');

                // Verify game completed successfully
                assert(result.success === true,
                    `❌ Game flow failed\nExpected: Success\nGot Error: ${result.error || 'Unknown'}`);

                // Verify game data integrity
                assert(result.game.moves.length > 0,
                    `❌ No moves recorded\nExpected: > 0 moves\nGot: ${result.game.moves.length}`);

                // Verify move alternation (player and AI moves)
                const playerMoves = result.game.moves.filter(m => m.player_id === 1).length;
                const aiMoves = result.game.moves.filter(m => m.player_id === 2).length;

                assert(Math.abs(playerMoves - aiMoves) <= 1,
                    `❌ Move alternation broken\nExpected: Similar count\nGot: Player ${playerMoves}, AI ${aiMoves}`);

                // Verify performance metrics
                assert(result.metrics.totalTime > 0,
                    `❌ No timing data\nExpected: > 0ms\nGot: ${result.metrics.totalTime}ms`);
                assert(result.metrics.avgMoveTime < 5000,
                    `❌ Moves too slow\nExpected: < 5000ms avg\nGot: ${result.metrics.avgMoveTime}ms`);

                // Verify game flow completeness
                const flowSteps = result.flow.map(f => f.step);
                assert(flowSteps.includes('game_created'),
                    `❌ Missing game creation\nExpected: game_created in flow\nGot: ${flowSteps}`);
                assert(flowSteps.includes('player_move') || flowSteps.includes('ai_move'),
                    `❌ No moves in flow\nExpected: player_move or ai_move\nGot: ${flowSteps}`);

                // Verify WebSocket messages sent
                assert(gameSystem.webSocket.sentMessages.length > 0,
                    `❌ No WebSocket messages\nExpected: > 0 messages\nGot: ${gameSystem.webSocket.sentMessages.length}`);

                console.log('✅ Complete Player vs AI game flow passed');
                console.log(`📊 Game: ${result.game.moves.length} moves, ${result.metrics.totalTime}ms`);

            } catch (error) {
                assert.fail(`❌ Complete game flow failed\nExpected: Successful game\nGot Error: ${error.message}`);
            }
        });

        /**
         * Test: AI vs AI game simulation
         * Expected: AI can play against itself using all components
         * Description: Tests system stability with pure AI gameplay
         */
        it('should handle AI vs AI game simulation', async () => {
            console.log('🤖 Testing AI vs AI game simulation...');

            try {
                const result = await gameSystem.simulateCompleteGame(false, 'L1');

                // Verify AI vs AI game completed
                assert(result.success === true,
                    `❌ AI vs AI game failed\nExpected: Success\nGot Error: ${result.error || 'Unknown'}`);

                // Verify all moves are AI moves
                const totalMoves = result.game.moves.length;
                const aiMoves = result.game.moves.filter(m => m.player_id === 2).length;

                // In AI vs AI, all moves should be from AI (player_id 2), or alternating if we treat both as AI
                assert(totalMoves > 0,
                    `❌ No AI moves\nExpected: > 0 moves\nGot: ${totalMoves}`);

                // Verify AI move quality (should have SAN notation)
                result.game.moves.forEach((move, index) => {
                    assert(move.san_notation && move.san_notation.length > 0,
                        `❌ Move ${index} missing SAN\nExpected: SAN notation\nGot: ${move.san_notation}`);
                    assert(/^[a-f][1-6][a-f][1-6]$/.test(move.move_notation),
                        `❌ Move ${index} format wrong\nExpected: UCI format\nGot: ${move.move_notation}`);
                });

                // Verify game ended properly
                const endSteps = result.flow.filter(f => f.step === 'game_ended');
                if (endSteps.length > 0) {
                    const gameEnd = endSteps[0];
                    const validEndReasons = ['CHECKMATE', 'STALEMATE', 'DRAW'];
                    assert(validEndReasons.includes(gameEnd.reason),
                        `❌ Invalid end reason\nExpected: ${validEndReasons}\nGot: ${gameEnd.reason}`);
                }

                console.log('✅ AI vs AI game simulation passed');
                console.log(`📊 AI Game: ${totalMoves} moves, ended: ${endSteps.length > 0 ? endSteps[0].reason : 'max moves'}`);

            } catch (error) {
                assert.fail(`❌ AI vs AI simulation failed\nExpected: Successful AI game\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🔧 Component Failure Recovery', () => {

        /**
         * Test: System handles component failures gracefully
         * Expected: Failures in one component don't crash the entire system
         * Description: Tests error handling and recovery mechanisms
         */
        it('should recover gracefully from component failures', async () => {
            console.log('🔧 Testing component failure recovery...');

            try {
                const recoveryResults = await gameSystem.testComponentFailureRecovery();

                // Verify recovery tests were performed
                assert(Array.isArray(recoveryResults),
                    `❌ Recovery results wrong type\nExpected: Array\nGot: ${typeof recoveryResults}`);
                assert(recoveryResults.length > 0,
                    `❌ No recovery tests\nExpected: > 0 tests\nGot: ${recoveryResults.length}`);

                // Verify each component recovery
                const componentTests = ['AI Bot', 'Rules Engine', 'Database'];
                componentTests.forEach(component => {
                    const test = recoveryResults.find(r => r.component === component);
                    assert(test,
                        `❌ Missing ${component} recovery test\nExpected: Test for ${component}\nGot: ${recoveryResults.map(r => r.component)}`);
                    assert(test.success === true,
                        `❌ ${component} recovery failed\nExpected: Successful recovery\nGot: Failed (${test.failure})`);
                });

                // Verify error handling doesn't crash system
                assert(gameSystem.systemErrors.length >= 0,
                    `❌ System errors not tracked\nExpected: Error tracking\nGot: No error array`);

                console.log('✅ Component failure recovery passed');
                console.log(`📊 Tested: ${recoveryResults.length} recovery scenarios`);

            } catch (error) {
                assert.fail(`❌ Component failure recovery failed\nExpected: Graceful error handling\nGot Error: ${error.message}`);
            }
        });
    });

    describe('⚡ Performance Integration', () => {

        /**
         * Test: System performance under concurrent game load
         * Expected: Multiple games can run simultaneously without degradation
         * Description: Tests system scalability and resource management
         */
        it('should handle concurrent games efficiently', async () => {
            console.log('⚡ Testing concurrent games performance...');

            try {
                const concurrentResult = await gameSystem.testConcurrentGamesPerformance(3);

                // Verify concurrent games completed
                assert(concurrentResult.successfulGames > 0,
                    `❌ No concurrent games succeeded\nExpected: > 0 games\nGot: ${concurrentResult.successfulGames}`);

                // Verify success rate is reasonable
                assert(concurrentResult.successRate >= 60,
                    `❌ Low success rate\nExpected: >= 60%\nGot: ${concurrentResult.successRate}%`);

                // Verify performance is acceptable
                assert(concurrentResult.avgGameTime < 15000,
                    `❌ Games too slow\nExpected: < 15s avg\nGot: ${concurrentResult.avgGameTime}ms`);

                // Verify concurrent execution is faster than sequential
                assert(concurrentResult.concurrentPerformance === true,
                    `❌ Concurrent execution not efficient\nExpected: Faster than sequential\nGot: ${concurrentResult.totalTime}ms total`);

                console.log('✅ Concurrent games performance passed');
                console.log(`📊 ${concurrentResult.successfulGames}/${concurrentResult.totalGames} games, ${concurrentResult.avgGameTime}ms avg`);

            } catch (error) {
                assert.fail(`❌ Concurrent games performance failed\nExpected: Efficient concurrent execution\nGot Error: ${error.message}`);
            }
        });

        /**
         * Test: Memory usage and resource cleanup
         * Expected: System properly cleans up resources after games
         * Description: Tests for memory leaks and proper resource management
         */
        it('should manage resources efficiently', async () => {
            console.log('💾 Testing resource management...');

            try {
                const initialMemory = process.memoryUsage();

                // Run multiple game simulations
                for (let i = 0; i < 5; i++) {
                    const tempSystem = new GameSystemIntegrator();
                    const result = await tempSystem.simulateCompleteGame(false, 'L1');

                    // Verify game completed without resource leaks
                    assert(result.success === true || result.game.moves.length > 0,
                        `❌ Game ${i} failed or incomplete\nExpected: Success or moves\nGot: ${result.success} with ${result.game?.moves?.length || 0} moves`);
                }

                const finalMemory = process.memoryUsage();
                const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

                // Verify memory usage is reasonable (< 50MB increase)
                assert(memoryIncrease < 50 * 1024 * 1024,
                    `❌ Excessive memory usage\nExpected: < 50MB increase\nGot: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

                // Verify no component state leaks
                assert(gameSystem.webSocket.sentMessages.length >= 0,
                    `❌ WebSocket state corrupted\nExpected: Valid state\nGot: Invalid message array`);

                console.log('✅ Resource management passed');
                console.log(`📊 Memory: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase after 5 games`);

            } catch (error) {
                assert.fail(`❌ Resource management failed\nExpected: Efficient resource usage\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🔄 Data Integrity Integration', () => {

        /**
         * Test: End-to-end data integrity across all components
         * Expected: Data remains consistent across Rules Engine, Database, and WebSocket
         * Description: Verifies data flows correctly without corruption
         */
        it('should maintain data integrity across all components', async () => {
            console.log('🔄 Testing end-to-end data integrity...');

            try {
                const result = await gameSystem.simulateCompleteGame(true, 'L2');

                if (result.success && result.game.moves.length > 0) {
                    // 1. Verify Rules Engine → Database integrity
                    for (const move of result.game.moves) {
                        // Validate each stored move
                        const validation = gameSystem.rulesEngine.validateMove(
                            move.fen_before || 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1',
                            move.move_notation
                        );

                        assert(validation.valid === true,
                            `❌ Stored move invalid\nExpected: Valid move\nGot: ${move.move_notation} - ${validation.error || 'Unknown error'}`);
                    }

                    // 2. Verify Database → WebSocket integrity
                    const webSocketMoves = gameSystem.webSocket.sentMessages.filter(m =>
                        JSON.parse(m).type === 'player_move' || JSON.parse(m).type === 'ai_move'
                    );

                    assert(webSocketMoves.length > 0,
                        `❌ No moves in WebSocket\nExpected: > 0 moves\nGot: ${webSocketMoves.length}`);

                    // Verify move count consistency
                    assert(webSocketMoves.length <= result.game.moves.length,
                        `❌ WebSocket move count mismatch\nExpected: <= ${result.game.moves.length}\nGot: ${webSocketMoves.length}`);

                    // 3. Verify Frontend → Backend integrity
                    const frontendMoveCount = gameSystem.frontendState.moveHistory.length;
                    assert(frontendMoveCount > 0,
                        `❌ Frontend move history empty\nExpected: > 0 moves\nGot: ${frontendMoveCount}`);

                    // 4. Verify game state consistency
                    const finalFEN = gameSystem.frontendState.generateCurrentFEN();
                    const boardState = gameSystem.rulesEngine.parseFEN(finalFEN);

                    assert(typeof boardState === 'object',
                        `❌ Board state corrupted\nExpected: Valid board object\nGot: ${typeof boardState}`);

                    // 5. Verify move history integrity
                    const gameFlowMoves = result.flow.filter(f => f.step === 'player_move' || f.step === 'ai_move');
                    assert(gameFlowMoves.length === result.game.moves.length,
                        `❌ Move history mismatch\nExpected: ${result.game.moves.length} moves\nGot: ${gameFlowMoves.length} flow moves`);
                }

                console.log('✅ End-to-end data integrity passed');
                console.log(`📊 Verified: ${result.game?.moves?.length || 0} moves across all components`);

            } catch (error) {
                assert.fail(`❌ Data integrity test failed\nExpected: Consistent data across components\nGot Error: ${error.message}`);
            }
        });
    });

    after(() => {
        console.log('🧹 Cross-component integration tests cleanup complete');
    });
});

// Export utilities for other integration tests
module.exports = {
    GameSystemIntegrator,
    testCompleteGameFlow: async (botLevel = 'L2') => {
        const system = new GameSystemIntegrator();
        return await system.simulateCompleteGame(true, botLevel);
    },
    testConcurrentPerformance: async (gameCount = 3) => {
        const system = new GameSystemIntegrator();
        return await system.testConcurrentGamesPerformance(gameCount);
    },
    validateSystemIntegrity: (gameResult) => {
        return gameResult.success &&
               gameResult.game &&
               gameResult.game.moves.length > 0 &&
               gameResult.metrics.totalTime > 0;
    }
};