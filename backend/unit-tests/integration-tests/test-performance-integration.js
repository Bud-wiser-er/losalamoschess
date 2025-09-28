/**
 * PERFORMANCE INTEGRATION TESTS
 *
 * Purpose: Test Byron's backend handling multiple concurrent games and performance under load
 * File Location: /backend/unit-tests/integration-tests/test-performance-integration.js
 *
 * Tests:
 * 1. Multiple concurrent games performance
 * 2. Memory usage doesn't leak during long sessions
 * 3. AI bot performance under server load
 * 4. WebSocket throughput under heavy traffic
 * 5. Database performance with high transaction volume
 * 6. Component performance degradation analysis
 */

const assert = require('assert');

// Import all components for performance testing
const RulesEngine = require('../../src/engine/index');
const AIBot = require('../../src/ai-bot/index');

// Import integration utilities
const { GameSystemIntegrator } = require('./test-cross-component-integration');
const { MockWebSocketServer } = require('./test-websocket-integration');
const { MockDatabaseService } = require('./test-database-integration');
const { MockAuthenticationService } = require('./test-security-integration');

// Performance Monitoring Utilities
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            memory: [],
            timing: [],
            throughput: [],
            errors: []
        };
        this.startTime = Date.now();
        this.initialMemory = process.memoryUsage();
    }

    // Record memory usage
    recordMemory(label) {
        const memory = process.memoryUsage();
        this.metrics.memory.push({
            label,
            timestamp: Date.now() - this.startTime,
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            external: memory.external,
            rss: memory.rss
        });
    }

    // Record operation timing
    recordTiming(label, duration) {
        this.metrics.timing.push({
            label,
            duration,
            timestamp: Date.now() - this.startTime
        });
    }

    // Record throughput metrics
    recordThroughput(label, operations, timeWindow) {
        this.metrics.throughput.push({
            label,
            operations,
            timeWindow,
            opsPerSecond: operations / (timeWindow / 1000),
            timestamp: Date.now() - this.startTime
        });
    }

    // Record errors
    recordError(label, error) {
        this.metrics.errors.push({
            label,
            error: error.message,
            timestamp: Date.now() - this.startTime
        });
    }

    // Get performance summary
    getSummary() {
        const currentMemory = process.memoryUsage();
        const memoryIncrease = currentMemory.heapUsed - this.initialMemory.heapUsed;

        return {
            totalTime: Date.now() - this.startTime,
            memoryIncrease: memoryIncrease,
            memoryIncreaseFormatted: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
            averageTiming: this.getAverageTiming(),
            maxThroughput: this.getMaxThroughput(),
            errorRate: (this.metrics.errors.length / this.metrics.timing.length) * 100,
            totalOperations: this.metrics.timing.length,
            memorySnapshots: this.metrics.memory.length
        };
    }

    getAverageTiming() {
        if (this.metrics.timing.length === 0) return 0;
        const total = this.metrics.timing.reduce((sum, t) => sum + t.duration, 0);
        return total / this.metrics.timing.length;
    }

    getMaxThroughput() {
        if (this.metrics.throughput.length === 0) return 0;
        return Math.max(...this.metrics.throughput.map(t => t.opsPerSecond));
    }
}

// Load Testing Utilities
class LoadTestRunner {
    constructor() {
        this.activeGames = new Map();
        this.systemComponents = {
            rulesEngine: new RulesEngine(),
            aiBot: new AIBot(),
            webSocket: new MockWebSocketServer(),
            database: new MockDatabaseService(),
            auth: new MockAuthenticationService()
        };
        this.performanceMonitor = new PerformanceMonitor();
    }

    // Run concurrent games load test
    async runConcurrentGamesTest(gameCount = 5, movesPerGame = 10) {
        console.log(`🏁 Starting concurrent games test: ${gameCount} games, ${movesPerGame} moves each`);

        const startTime = Date.now();
        this.performanceMonitor.recordMemory('test_start');

        const gamePromises = [];

        for (let i = 0; i < gameCount; i++) {
            const gamePromise = this.simulateGame(i, movesPerGame);
            gamePromises.push(gamePromise);
        }

        const results = await Promise.all(gamePromises);
        const endTime = Date.now();

        this.performanceMonitor.recordMemory('test_end');
        this.performanceMonitor.recordThroughput(
            'concurrent_games',
            gameCount,
            endTime - startTime
        );

        return {
            gameCount,
            completedGames: results.filter(r => r.success).length,
            totalTime: endTime - startTime,
            avgGameTime: (endTime - startTime) / gameCount,
            results
        };
    }

    // Simulate individual game
    async simulateGame(gameIndex, moveCount) {
        const gameId = `perf-game-${gameIndex}`;
        const gameStartTime = Date.now();

        try {
            // Initialize game
            const game = await this.systemComponents.database.createGame({
                whitePlayerId: 1,
                blackPlayerId: 2,
                startingFEN: 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1'
            });

            let currentFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';
            const moves = [];

            // Play moves
            for (let moveNum = 0; moveNum < moveCount; moveNum++) {
                const moveStartTime = Date.now();

                // Get legal moves
                const legalMoves = this.systemComponents.rulesEngine.getLegalMoves(currentFEN);

                if (legalMoves.length === 0) break; // Game ended

                // Select random move
                const selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];

                // Validate and apply move
                const validation = this.systemComponents.rulesEngine.validateMove(currentFEN, selectedMove);
                if (!validation.valid) continue;

                const moveResult = this.systemComponents.rulesEngine.applyMove(currentFEN, selectedMove);

                // Store move in database
                await this.systemComponents.database.saveMove(game.id, {
                    playerId: (moveNum % 2) + 1,
                    move: selectedMove,
                    san: moveResult.san,
                    fenBefore: currentFEN,
                    fenAfter: moveResult.newFEN
                });

                // Broadcast via WebSocket
                this.systemComponents.webSocket.send(JSON.stringify({
                    type: 'move',
                    gameId: game.id,
                    move: selectedMove,
                    san: moveResult.san
                }));

                moves.push({
                    move: selectedMove,
                    time: Date.now() - moveStartTime
                });

                currentFEN = moveResult.newFEN;

                this.performanceMonitor.recordTiming('move_processing', Date.now() - moveStartTime);
            }

            const gameTime = Date.now() - gameStartTime;
            this.performanceMonitor.recordTiming('game_completion', gameTime);

            return {
                success: true,
                gameId: game.id,
                moves: moves.length,
                time: gameTime,
                avgMoveTime: gameTime / moves.length
            };

        } catch (error) {
            this.performanceMonitor.recordError('game_simulation', error);
            return {
                success: false,
                gameId,
                error: error.message,
                time: Date.now() - gameStartTime
            };
        }
    }

    // Run AI performance stress test
    async runAIStressTest(requestCount = 20, concurrency = 5) {
        console.log(`🤖 Starting AI stress test: ${requestCount} requests, ${concurrency} concurrent`);

        const startTime = Date.now();
        this.performanceMonitor.recordMemory('ai_stress_start');

        const requests = [];
        const testFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';

        // Create batches of concurrent requests
        for (let batch = 0; batch < requestCount; batch += concurrency) {
            const batchPromises = [];

            for (let i = 0; i < concurrency && (batch + i) < requestCount; i++) {
                const aiPromise = this.testAIPerformance(testFEN, 'L2', batch + i);
                batchPromises.push(aiPromise);
            }

            const batchResults = await Promise.all(batchPromises);
            requests.push(...batchResults);

            // Brief pause between batches to prevent overwhelming
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const endTime = Date.now();
        this.performanceMonitor.recordMemory('ai_stress_end');

        const successfulRequests = requests.filter(r => r.success).length;
        const totalTime = endTime - startTime;

        this.performanceMonitor.recordThroughput(
            'ai_requests',
            successfulRequests,
            totalTime
        );

        return {
            totalRequests: requestCount,
            successfulRequests,
            successRate: (successfulRequests / requestCount) * 100,
            totalTime,
            avgRequestTime: totalTime / requestCount,
            requestsPerSecond: (successfulRequests / totalTime) * 1000
        };
    }

    // Test individual AI performance
    async testAIPerformance(fen, level, requestId) {
        const startTime = Date.now();

        try {
            const aiResponse = await this.systemComponents.aiBot.generateMove(fen, level, 3000);
            const responseTime = Date.now() - startTime;

            this.performanceMonitor.recordTiming('ai_request', responseTime);

            return {
                success: true,
                requestId,
                responseTime,
                move: aiResponse.move,
                level
            };

        } catch (error) {
            this.performanceMonitor.recordError('ai_request', error);
            return {
                success: false,
                requestId,
                responseTime: Date.now() - startTime,
                error: error.message
            };
        }
    }

    // Run memory leak detection test
    async runMemoryLeakTest(iterations = 10) {
        console.log(`💾 Starting memory leak test: ${iterations} iterations`);

        const memorySnapshots = [];

        for (let i = 0; i < iterations; i++) {
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const beforeMemory = process.memoryUsage();

            // Perform operations that might leak memory
            const gameSystem = new GameSystemIntegrator();
            await gameSystem.simulateCompleteGame(false, 'L1'); // AI vs AI

            // Create and destroy components
            const tempComponents = {
                rules: new RulesEngine(),
                ai: new AIBot(),
                ws: new MockWebSocketServer(),
                db: new MockDatabaseService()
            };

            // Perform some operations
            const testFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';
            tempComponents.rules.getLegalMoves(testFEN);
            tempComponents.ws.send('{"type":"test"}');

            const afterMemory = process.memoryUsage();

            memorySnapshots.push({
                iteration: i,
                beforeHeap: beforeMemory.heapUsed,
                afterHeap: afterMemory.heapUsed,
                heapGrowth: afterMemory.heapUsed - beforeMemory.heapUsed
            });

            this.performanceMonitor.recordMemory(`iteration_${i}`);

            // Brief pause
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Analyze memory growth trend
        const growthTrend = this.analyzeMemoryGrowth(memorySnapshots);

        return {
            iterations,
            memorySnapshots,
            growthTrend,
            avgGrowthPerIteration: growthTrend.avgGrowth,
            memoryLeakDetected: growthTrend.avgGrowth > 5 * 1024 * 1024 // 5MB per iteration threshold
        };
    }

    // Analyze memory growth patterns
    analyzeMemoryGrowth(snapshots) {
        if (snapshots.length < 2) return { avgGrowth: 0, trend: 'insufficient_data' };

        const growths = snapshots.map(s => s.heapGrowth);
        const totalGrowth = snapshots[snapshots.length - 1].afterHeap - snapshots[0].beforeHeap;
        const avgGrowth = totalGrowth / snapshots.length;

        // Calculate trend (positive = growing, negative = shrinking)
        let trendSum = 0;
        for (let i = 1; i < snapshots.length; i++) {
            trendSum += snapshots[i].afterHeap - snapshots[i - 1].afterHeap;
        }
        const trend = trendSum / (snapshots.length - 1);

        return {
            totalGrowth,
            avgGrowth,
            trend: trend > 1024 * 1024 ? 'growing' : trend < -1024 * 1024 ? 'shrinking' : 'stable',
            trendValue: trend
        };
    }
}

describe('⚡ Performance Integration Tests', () => {
    let loadTestRunner;
    let performanceMonitor;

    beforeEach(() => {
        loadTestRunner = new LoadTestRunner();
        performanceMonitor = new PerformanceMonitor();
        console.log('🔧 Performance integration test setup complete');
    });

    describe('🏁 Concurrent Games Performance', () => {

        /**
         * Test: Multiple concurrent games performance
         * Expected: System handles multiple games without significant degradation
         * Description: Tests system scalability under realistic load
         */
        it('should handle multiple concurrent games efficiently', async function() {
            this.timeout(30000); // Extended timeout for performance test

            console.log('🏁 Testing concurrent games performance...');

            try {
                const result = await loadTestRunner.runConcurrentGamesTest(5, 8);

                // Verify concurrent games completed successfully
                assert(result.completedGames >= 4,
                    `❌ Too many failed games\nExpected: >= 4 completed\nGot: ${result.completedGames}/${result.gameCount}`);

                // Verify reasonable performance
                assert(result.avgGameTime < 10000,
                    `❌ Games too slow\nExpected: < 10s avg\nGot: ${result.avgGameTime}ms`);

                // Verify total time is reasonable
                assert(result.totalTime < 20000,
                    `❌ Total time too long\nExpected: < 20s\nGot: ${result.totalTime}ms`);

                // Verify success rate
                const successRate = (result.completedGames / result.gameCount) * 100;
                assert(successRate >= 80,
                    `❌ Success rate too low\nExpected: >= 80%\nGot: ${successRate}%`);

                // Check performance summary
                const summary = loadTestRunner.performanceMonitor.getSummary();
                assert(summary.errorRate < 20,
                    `❌ Error rate too high\nExpected: < 20%\nGot: ${summary.errorRate}%`);

                console.log('✅ Concurrent games performance passed');
                console.log(`📊 ${result.completedGames}/${result.gameCount} games, ${result.avgGameTime}ms avg, ${successRate}% success`);

            } catch (error) {
                assert.fail(`❌ Concurrent games performance failed\nExpected: Efficient concurrent execution\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🤖 AI Performance Under Load', () => {

        /**
         * Test: AI bot performance under server load
         * Expected: AI maintains reasonable response times under load
         * Description: Tests AI scalability and response consistency
         */
        it('should maintain AI performance under load', async function() {
            this.timeout(25000); // Extended timeout for AI stress test

            console.log('🤖 Testing AI performance under load...');

            try {
                const result = await loadTestRunner.runAIStressTest(15, 3);

                // Verify AI requests completed successfully
                assert(result.successfulRequests >= 12,
                    `❌ Too many AI failures\nExpected: >= 12 successful\nGot: ${result.successfulRequests}/${result.totalRequests}`);

                // Verify success rate
                assert(result.successRate >= 80,
                    `❌ AI success rate too low\nExpected: >= 80%\nGot: ${result.successRate}%`);

                // Verify reasonable response times
                assert(result.avgRequestTime < 2000,
                    `❌ AI responses too slow\nExpected: < 2000ms avg\nGot: ${result.avgRequestTime}ms`);

                // Verify throughput is reasonable
                assert(result.requestsPerSecond > 0.5,
                    `❌ AI throughput too low\nExpected: > 0.5 req/s\nGot: ${result.requestsPerSecond} req/s`);

                console.log('✅ AI performance under load passed');
                console.log(`📊 ${result.successfulRequests}/${result.totalRequests} requests, ${result.avgRequestTime}ms avg, ${result.requestsPerSecond.toFixed(2)} req/s`);

            } catch (error) {
                assert.fail(`❌ AI performance under load failed\nExpected: Consistent AI performance\nGot Error: ${error.message}`);
            }
        });
    });

    describe('💾 Memory Usage and Leak Detection', () => {

        /**
         * Test: Memory usage doesn't leak during long sessions
         * Expected: Memory usage remains stable over time
         * Description: Tests for memory leaks in extended usage
         */
        it('should not leak memory during extended usage', async function() {
            this.timeout(20000); // Extended timeout for memory test

            console.log('💾 Testing memory leak detection...');

            try {
                const result = await loadTestRunner.runMemoryLeakTest(8);

                // Verify no significant memory leaks
                assert(result.memoryLeakDetected === false,
                    `❌ Memory leak detected\nExpected: No memory leak\nGot: ${result.avgGrowthPerIteration / 1024 / 1024}MB per iteration`);

                // Verify memory growth is reasonable (< 5MB per iteration)
                const avgGrowthMB = result.avgGrowthPerIteration / 1024 / 1024;
                assert(avgGrowthMB < 5,
                    `❌ Excessive memory growth\nExpected: < 5MB per iteration\nGot: ${avgGrowthMB.toFixed(2)}MB`);

                // Verify trend analysis
                assert(result.growthTrend.trend !== 'growing' || Math.abs(result.growthTrend.trendValue) < 2 * 1024 * 1024,
                    `❌ Concerning memory growth trend\nExpected: Stable or shrinking\nGot: ${result.growthTrend.trend} (${(result.growthTrend.trendValue / 1024 / 1024).toFixed(2)}MB trend)`);

                // Verify iterations completed
                assert(result.iterations === 8,
                    `❌ Incomplete memory test\nExpected: 8 iterations\nGot: ${result.iterations}`);

                console.log('✅ Memory leak detection passed');
                console.log(`📊 ${result.iterations} iterations, ${avgGrowthMB.toFixed(2)}MB avg growth, trend: ${result.growthTrend.trend}`);

            } catch (error) {
                assert.fail(`❌ Memory leak detection failed\nExpected: Stable memory usage\nGot Error: ${error.message}`);
            }
        });
    });

    describe('🌐 WebSocket Throughput Performance', () => {

        /**
         * Test: WebSocket throughput under heavy traffic
         * Expected: WebSocket maintains high message throughput
         * Description: Tests WebSocket performance with many simultaneous messages
         */
        it('should handle high WebSocket message throughput', async () => {
            console.log('🌐 Testing WebSocket throughput performance...');

            try {
                const webSocket = new MockWebSocketServer();
                const messageCount = 1000;
                const startTime = Date.now();

                // Send many messages rapidly
                for (let i = 0; i < messageCount; i++) {
                    const message = {
                        type: 'test_message',
                        id: i,
                        timestamp: Date.now(),
                        data: `Test message ${i}`.repeat(10) // Simulate realistic message size
                    };

                    webSocket.send(JSON.stringify(message));
                }

                const endTime = Date.now();
                const totalTime = endTime - startTime;
                const messagesPerSecond = (messageCount / totalTime) * 1000;

                // Verify high throughput
                assert(messagesPerSecond > 100,
                    `❌ WebSocket throughput too low\nExpected: > 100 msg/s\nGot: ${messagesPerSecond.toFixed(2)} msg/s`);

                // Verify all messages were sent
                assert(webSocket.sentMessages.length === messageCount,
                    `❌ Messages lost\nExpected: ${messageCount} messages\nGot: ${webSocket.sentMessages.length}`);

                // Verify message integrity
                const firstMessage = JSON.parse(webSocket.sentMessages[0]);
                const lastMessage = JSON.parse(webSocket.sentMessages[messageCount - 1]);

                assert(firstMessage.id === 0,
                    `❌ First message corrupted\nExpected: id=0\nGot: id=${firstMessage.id}`);
                assert(lastMessage.id === messageCount - 1,
                    `❌ Last message corrupted\nExpected: id=${messageCount - 1}\nGot: id=${lastMessage.id}`);

                console.log('✅ WebSocket throughput performance passed');
                console.log(`📊 ${messageCount} messages, ${messagesPerSecond.toFixed(2)} msg/s, ${totalTime}ms total`);

            } catch (error) {
                assert.fail(`❌ WebSocket throughput performance failed\nExpected: High message throughput\nGot Error: ${error.message}`);
            }
        });
    });

    describe('📈 Performance Degradation Analysis', () => {

        /**
         * Test: Component performance degradation analysis
         * Expected: Performance remains consistent over time
         * Description: Tests for performance degradation under sustained load
         */
        it('should maintain consistent performance over time', async function() {
            this.timeout(15000); // Extended timeout for degradation test

            console.log('📈 Testing performance consistency over time...');

            try {
                const rulesEngine = new RulesEngine();
                const aiBot = new AIBot();
                const iterations = 20;
                const performanceSamples = [];

                for (let i = 0; i < iterations; i++) {
                    const iterationStart = Date.now();

                    // Perform various operations
                    const testFEN = 'rnqknr/pppppp/6/6/6/PPPPPP/RNQKNR w - - 0 1';

                    // Rules Engine operations
                    const rulesStart = Date.now();
                    const legalMoves = rulesEngine.getLegalMoves(testFEN);
                    const move = legalMoves[0];
                    const validation = rulesEngine.validateMove(testFEN, move);
                    const moveResult = rulesEngine.applyMove(testFEN, move);
                    const rulesTime = Date.now() - rulesStart;

                    // AI Bot operation (every 4th iteration to avoid overwhelming)
                    let aiTime = 0;
                    if (i % 4 === 0) {
                        const aiStart = Date.now();
                        await aiBot.generateMove(testFEN, 'L1', 2000);
                        aiTime = Date.now() - aiStart;
                    }

                    const iterationTime = Date.now() - iterationStart;

                    performanceSamples.push({
                        iteration: i,
                        rulesTime,
                        aiTime,
                        totalTime: iterationTime,
                        legalMovesCount: legalMoves.length
                    });

                    performanceMonitor.recordTiming('rules_operation', rulesTime);
                    if (aiTime > 0) {
                        performanceMonitor.recordTiming('ai_operation', aiTime);
                    }
                }

                // Analyze performance degradation
                const degradationAnalysis = this.analyzePerformanceDegradation(performanceSamples);

                // Verify no significant degradation
                assert(degradationAnalysis.rulesDegradation < 50,
                    `❌ Rules Engine degradation too high\nExpected: < 50% degradation\nGot: ${degradationAnalysis.rulesDegradation}%`);

                assert(degradationAnalysis.overallTrend !== 'degrading',
                    `❌ Performance degrading over time\nExpected: Stable performance\nGot: ${degradationAnalysis.overallTrend}`);

                // Verify consistency
                assert(degradationAnalysis.rulesVariance < 100,
                    `❌ Rules Engine too inconsistent\nExpected: < 100ms variance\nGot: ${degradationAnalysis.rulesVariance}ms`);

                console.log('✅ Performance consistency analysis passed');
                console.log(`📊 ${iterations} iterations, Rules: ${degradationAnalysis.rulesDegradation}% degradation, Trend: ${degradationAnalysis.overallTrend}`);

            } catch (error) {
                assert.fail(`❌ Performance degradation analysis failed\nExpected: Consistent performance\nGot Error: ${error.message}`);
            }
        });

        // Helper method to analyze performance degradation
        analyzePerformanceDegradation(samples) {
            const firstQuarter = samples.slice(0, Math.floor(samples.length / 4));
            const lastQuarter = samples.slice(-Math.floor(samples.length / 4));

            const avgFirstRules = firstQuarter.reduce((sum, s) => sum + s.rulesTime, 0) / firstQuarter.length;
            const avgLastRules = lastQuarter.reduce((sum, s) => sum + s.rulesTime, 0) / lastQuarter.length;

            const rulesDegradation = ((avgLastRules - avgFirstRules) / avgFirstRules) * 100;

            // Calculate variance
            const allRulesTimes = samples.map(s => s.rulesTime);
            const avgRulesTime = allRulesTimes.reduce((sum, t) => sum + t, 0) / allRulesTimes.length;
            const rulesVariance = Math.sqrt(
                allRulesTimes.reduce((sum, t) => sum + Math.pow(t - avgRulesTime, 2), 0) / allRulesTimes.length
            );

            const overallTrend = rulesDegradation > 25 ? 'degrading' :
                                 rulesDegradation < -10 ? 'improving' : 'stable';

            return {
                rulesDegradation,
                rulesVariance,
                overallTrend,
                avgFirstRules,
                avgLastRules,
                samples: samples.length
            };
        }
    });

    after(() => {
        // Final performance summary
        if (loadTestRunner && loadTestRunner.performanceMonitor) {
            const summary = loadTestRunner.performanceMonitor.getSummary();
            console.log('🧹 Performance integration tests complete');
            console.log(`📊 Final Summary: ${summary.totalOperations} operations, ${summary.memoryIncreaseFormatted} memory increase, ${summary.errorRate.toFixed(1)}% error rate`);
        }
    });
});

// Export utilities for other integration tests
module.exports = {
    PerformanceMonitor,
    LoadTestRunner,
    testConcurrentPerformance: async (gameCount = 5) => {
        const runner = new LoadTestRunner();
        return await runner.runConcurrentGamesTest(gameCount, 8);
    },
    testAIPerformance: async (requestCount = 10) => {
        const runner = new LoadTestRunner();
        return await runner.runAIStressTest(requestCount, 3);
    },
    testMemoryUsage: async (iterations = 5) => {
        const runner = new LoadTestRunner();
        return await runner.runMemoryLeakTest(iterations);
    }
};