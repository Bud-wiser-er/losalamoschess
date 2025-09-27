// database/tests/db-core-tests.js
// Core Database Unit Tests - Based on Group Design Document Table 3
// Modified to work with proper relative path imports when in tests/ subdirectory

const path = require('path');

// Import TestFramework with correct relative path
// This works whether the file is in /database/tests/ or /database/
let TestFramework;
try {
    // Try parent directory first (when file is in tests/ subdirectory)
    TestFramework = require('../test-framework');
} catch (error) {
    // Fallback to same directory (when file is in database/ root)
    TestFramework = require('./test-framework');
}

const bcrypt = require('bcrypt');

/**
 * Register all core database functionality tests
 * These tests validate basic CRUD operations, constraints, and data integrity
 * 
 * @param {TestFramework} framework - The test framework instance to register tests with
 */
function registerCoreTests(framework) {
    
    // DB-01: User Creation with Password Hashing
    framework.addTest(
        'DB-01',
        'Fresh schema: createUser() - Row inserted with hashed password',
        async (client) => {
            const userData = {
                username: 'testuser_' + Date.now(),
                email: `test_${Date.now()}@example.com`,
                password: 'testpassword123',
                rating: 1200
            };

            // Hash password as DatabaseService would
            const passwordHash = await bcrypt.hash(userData.password, 12);

            const insertQuery = `
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id, username, email, rating, created_at
            `;

            const result = await client.query(insertQuery, [
                userData.username,
                userData.email,
                passwordHash,
                userData.rating
            ]);

            const user = result.rows[0];
            
            // Verify user was created with all required fields
            const assertions = [
                TestFramework.assert.notNull(user.id, 'User ID should be generated'),
                TestFramework.assert.equals(user.username, userData.username, 'Username should match'),
                TestFramework.assert.equals(user.email, userData.email, 'Email should match'),
                TestFramework.assert.equals(user.rating, userData.rating, 'Rating should match'),
                TestFramework.assert.notNull(user.created_at, 'Created timestamp should be set')
            ];

            // Verify password was hashed (not stored as plain text)
            const userWithHash = await client.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
            const storedHash = userWithHash.rows[0].password_hash;
            const hashValid = await bcrypt.compare(userData.password, storedHash);
            
            assertions.push(TestFramework.assert.isTrue(hashValid, 'Password should be properly hashed'));
            assertions.push(TestFramework.assert.isTrue(storedHash !== userData.password, 'Password should not be stored as plain text'));

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'User created with properly hashed password' };
        }
    );

    // DB-02: Duplicate Email Prevention (FIXED - Better Isolation)
    framework.addTest(
        'DB-02',
        'Duplicate email prevention: Second user with same email should be rejected',
        async (client) => {
            const baseEmail = `duplicate_test_${Date.now()}@example.com`;
            const passwordHash = await bcrypt.hash('password123', 12);

            // Create first user
            const firstUserQuery = `
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;

            const firstUser = await client.query(firstUserQuery, [
                'user1_' + Date.now(),
                baseEmail,
                passwordHash,
                1200
            ]);

            const firstUserId = firstUser.rows[0].id;
            
            // Verify first user was created
            if (!firstUserId) {
                return { success: false, message: 'Failed to create first user for duplicate test' };
            }

            // Attempt to create second user with same email - should fail
            try {
                await client.query(firstUserQuery, [
                    'user2_' + Date.now(),
                    baseEmail, // Same email as first user
                    passwordHash,
                    1300
                ]);
                
                return { success: false, message: 'Duplicate email was accepted when it should have been rejected', expected: 'constraint violation', actual: 'no error' };
            } catch (error) {
                // Check if it's the expected unique constraint violation
                if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
                    return { success: true, message: 'Duplicate email correctly rejected with constraint violation' };
                } else {
                    return { success: false, message: `Unexpected error type: ${error.message}`, expected: 'unique constraint violation', actual: error.code };
                }
            }
        }
    );

    // DB-03: Game Creation with Initial State
    framework.addTest(
        'DB-03',
        'Game creation: New game created with correct initial FEN and metadata',
        async (client) => {
            // First create users for the game
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();
            
            const user1Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`player1_${timestamp}`, `player1_${timestamp}@example.com`, passwordHash, 1200]);

            const user2Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`player2_${timestamp}`, `player2_${timestamp}@example.com`, passwordHash, 1300]);

            const player1Id = user1Result.rows[0].id;
            const player2Id = user2Result.rows[0].id;

            // Create game with initial Los Alamos FEN
            const initialFen = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
            const gameData = {
                variant: 'LOS_ALAMOS',
                currentFen: initialFen,
                status: 'active',
                whitePlayerId: player1Id,
                blackPlayerId: player2Id
            };

            const gameQuery = `
                INSERT INTO game (variant, current_fen, status, white_player_id, black_player_id, version)
                VALUES ($1, $2, $3, $4, $5, 1)
                RETURNING id, variant, current_fen, status, white_player_id, black_player_id, version, created_at
            `;

            const gameResult = await client.query(gameQuery, [
                gameData.variant,
                gameData.currentFen,
                gameData.status,
                gameData.whitePlayerId,
                gameData.blackPlayerId
            ]);

            const game = gameResult.rows[0];

            const assertions = [
                TestFramework.assert.notNull(game.id, 'Game ID should be generated'),
                TestFramework.assert.equals(game.variant, 'LOS_ALAMOS', 'Game variant should be LOS_ALAMOS'),
                TestFramework.assert.equals(game.current_fen, initialFen, 'Initial FEN should be correct'),
                TestFramework.assert.equals(game.status, 'active', 'Game status should be active'),
                TestFramework.assert.equals(game.white_player_id, player1Id, 'White player ID should match'),
                TestFramework.assert.equals(game.black_player_id, player2Id, 'Black player ID should match'),
                TestFramework.assert.equals(game.version, 1, 'Initial version should be 1'),
                TestFramework.assert.notNull(game.created_at, 'Created timestamp should be set')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Game created with correct initial state' };
        }
    );

    // DB-04: Move Addition with Version Control
    framework.addTest(
        'DB-04',
        'Move addition: Moves stored with correct sequence and game version tracking',
        async (client) => {
            // Create users and game first
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();
            
            const user1Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`moveplayer1_${timestamp}`, `moveplayer1_${timestamp}@example.com`, passwordHash, 1200]);

            const user2Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`moveplayer2_${timestamp}`, `moveplayer2_${timestamp}@example.com`, passwordHash, 1300]);

            const player1Id = user1Result.rows[0].id;
            const player2Id = user2Result.rows[0].id;

            const gameResult = await client.query(`
                INSERT INTO game (variant, current_fen, status, white_player_id, black_player_id, version)
                VALUES ('LOS_ALAMOS', 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'active', $1, $2, 1)
                RETURNING id
            `, [player1Id, player2Id]);

            const gameId = gameResult.rows[0].id;

            // Add first move using game_move table structure
            const move1Data = {
                gameId: gameId,
                ply: 1,
                uci: 'e2e3',
                san: 'e3',
                prev_fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
                next_fen: 'rnqknr/pppppp/6/6/PPPP1P/RNQKPR w - - 0 2'
            };

            const moveQuery = `
                INSERT INTO game_move (game_id, ply, by, uci, san, flags, prev_fen, next_fen)
                VALUES ($1, $2, 'human', $3, $4, '{}', $5, $6)
                RETURNING game_id, ply, created_at
            `;

            const moveResult = await client.query(moveQuery, [
                move1Data.gameId,
                move1Data.ply,
                move1Data.uci,
                move1Data.san,
                move1Data.prev_fen,
                move1Data.next_fen
            ]);

            const move = moveResult.rows[0];

            // Update game version after move
            await client.query(`
                UPDATE game SET version = version + 1, current_fen = $1 WHERE id = $2
            `, [move1Data.next_fen, gameId]);

            // Verify game version was updated
            const updatedGameResult = await client.query(`
                SELECT version, current_fen FROM game WHERE id = $1
            `, [gameId]);

            const updatedGame = updatedGameResult.rows[0];

            const assertions = [
                TestFramework.assert.notNull(move.game_id, 'Move should reference correct game'),
                TestFramework.assert.equals(move.game_id, gameId, 'Move should reference correct game'),
                TestFramework.assert.equals(move.ply, 1, 'Move ply should be correct'),
                TestFramework.assert.notNull(move.created_at, 'Move timestamp should be set'),
                TestFramework.assert.equals(updatedGame.version, 2, 'Game version should increment after move'),
                TestFramework.assert.equals(updatedGame.current_fen, move1Data.next_fen, 'Game FEN should update after move')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Move added with correct version control' };
        }
    );

    // DB-05: Optimistic Locking Mechanism
    framework.addTest(
        'DB-05',
        'Optimistic locking: Concurrent game updates prevented by version mismatch',
        async (client) => {
            // Create users and game
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();
            
            const user1Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`lockplayer1_${timestamp}`, `lockplayer1_${timestamp}@example.com`, passwordHash, 1200]);

            const user2Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`lockplayer2_${timestamp}`, `lockplayer2_${timestamp}@example.com`, passwordHash, 1300]);

            const player1Id = user1Result.rows[0].id;
            const player2Id = user2Result.rows[0].id;

            const gameResult = await client.query(`
                INSERT INTO game (variant, current_fen, status, white_player_id, black_player_id, version)
                VALUES ('LOS_ALAMOS', 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'active', $1, $2, 1)
                RETURNING id, version
            `, [player1Id, player2Id]);

            const gameId = gameResult.rows[0].id;
            const initialVersion = gameResult.rows[0].version;

            // Simulate first update (should succeed)
            const firstUpdateResult = await client.query(`
                UPDATE game 
                SET current_fen = 'rnqknr/pppppp/6/6/PPPP1P/RNQKPR w - - 0 2', version = version + 1
                WHERE id = $1 AND version = $2
                RETURNING version
            `, [gameId, initialVersion]);

            const firstUpdateSuccess = firstUpdateResult.rowCount === 1;
            const newVersion = firstUpdateResult.rows[0]?.version;

            // Simulate concurrent update with stale version (should fail)
            const secondUpdateResult = await client.query(`
                UPDATE game 
                SET current_fen = 'rnqknr/pppppp/6/6/PP1PPP/RNQKNR w - - 0 2', version = version + 1
                WHERE id = $1 AND version = $2
                RETURNING version
            `, [gameId, initialVersion]); // Using stale version

            const secondUpdateFailed = secondUpdateResult.rowCount === 0;

            const assertions = [
                TestFramework.assert.isTrue(firstUpdateSuccess, 'First update with correct version should succeed'),
                TestFramework.assert.equals(newVersion, 2, 'Version should increment after successful update'),
                TestFramework.assert.isTrue(secondUpdateFailed, 'Second update with stale version should fail'),
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Optimistic locking working correctly' };
        }
    );

    // DB-06: Game History Retrieval
    framework.addTest(
        'DB-06',
        'Game history: Complete move history retrievable in correct order',
        async (client) => {
            // Create users and game
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();
            
            const user1Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`histplayer1_${timestamp}`, `histplayer1_${timestamp}@example.com`, passwordHash, 1200]);

            const user2Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`histplayer2_${timestamp}`, `histplayer2_${timestamp}@example.com`, passwordHash, 1300]);

            const player1Id = user1Result.rows[0].id;
            const player2Id = user2Result.rows[0].id;

            const gameResult = await client.query(`
                INSERT INTO game (variant, current_fen, status, white_player_id, black_player_id, version)
                VALUES ('LOS_ALAMOS', 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'active', $1, $2, 1)
                RETURNING id
            `, [player1Id, player2Id]);

            const gameId = gameResult.rows[0].id;

    // DB-06: Game History Retrieval
    framework.addTest(
        'DB-06',
        'Game history: Complete move history retrievable in correct order',
        async (client) => {
            // Create users and game
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();
            
            const user1Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`histplayer1_${timestamp}`, `histplayer1_${timestamp}@example.com`, passwordHash, 1200]);

            const user2Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`histplayer2_${timestamp}`, `histplayer2_${timestamp}@example.com`, passwordHash, 1300]);

            const player1Id = user1Result.rows[0].id;
            const player2Id = user2Result.rows[0].id;

            const gameResult = await client.query(`
                INSERT INTO game (variant, current_fen, status, white_player_id, black_player_id, version)
                VALUES ('LOS_ALAMOS', 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'active', $1, $2, 1)
                RETURNING id
            `, [player1Id, player2Id]);

            const gameId = gameResult.rows[0].id;

            // Add multiple moves using game_move table structure
            const moves = [
                { ply: 1, uci: 'e2e3', san: 'e3' },
                { ply: 2, uci: 'e5e4', san: 'e4' },
                { ply: 3, uci: 'f2f3', san: 'f3' }
            ];

            for (const move of moves) {
                await client.query(`
                    INSERT INTO game_move (game_id, ply, by, uci, san, flags, prev_fen, next_fen)
                    VALUES ($1, $2, 'human', $3, $4, '{}', $5, $6)
                `, [gameId, move.ply, move.uci, move.san, 
                    'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', // prev_fen (simplified for test)
                    'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1'  // next_fen (simplified for test)
                ]);
            }

            // Retrieve game history
            const historyResult = await client.query(`
                SELECT ply, san, uci
                FROM game_move 
                WHERE game_id = $1 
                ORDER BY ply ASC
            `, [gameId]);

            const history = historyResult.rows;

            const assertions = [
                TestFramework.assert.arrayLength(history, 3, 'Should retrieve all 3 moves'),
                TestFramework.assert.equals(history[0].ply, 1, 'First move should have ply 1'),
                TestFramework.assert.equals(history[1].ply, 2, 'Second move should have ply 2'),
                TestFramework.assert.equals(history[2].ply, 3, 'Third move should have ply 3'),
                TestFramework.assert.equals(history[0].san, 'e3', 'First move notation should be correct'),
                TestFramework.assert.equals(history[1].san, 'e4', 'Second move notation should be correct'),
                TestFramework.assert.equals(history[2].san, 'f3', 'Third move notation should be correct')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Game history retrieved correctly in order' };
        }
    );

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Game history retrieved correctly in order' };
        }
    );

    // DB-07: Audit Logging Functionality
    framework.addTest(
        'DB-07',
        'Audit logging: User actions properly logged with metadata',
        async (client) => {
            // Create a user first
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();
            
            const userResult = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`audituser_${timestamp}`, `audituser_${timestamp}@example.com`, passwordHash, 1200]);

            const userId = userResult.rows[0].id;

            // Create audit log entry
            const auditData = {
                action: 'USER_CREATED',
                userId: userId,
                metadata: {
                    username: `audituser_${timestamp}`,
                    email: `audituser_${timestamp}@example.com`,
                    rating: 1200,
                    timestamp: new Date().toISOString()
                },
                ipAddress: '127.0.0.1'
            };

            const auditQuery = `
                INSERT INTO audit_log (action, user_id, metadata, ip_address)
                VALUES ($1, $2, $3, $4)
                RETURNING id, action, user_id, metadata, ip_address, timestamp
            `;

            const auditResult = await client.query(auditQuery, [
                auditData.action,
                auditData.userId,
                JSON.stringify(auditData.metadata),
                auditData.ipAddress
            ]);

            const auditLog = auditResult.rows[0];

            const assertions = [
                TestFramework.assert.notNull(auditLog.id, 'Audit log ID should be generated'),
                TestFramework.assert.equals(auditLog.action, auditData.action, 'Action should match'),
                TestFramework.assert.equals(auditLog.user_id, auditData.userId, 'User ID should match'),
                TestFramework.assert.equals(auditLog.ip_address, auditData.ipAddress, 'IP address should match'),
                TestFramework.assert.notNull(auditLog.timestamp, 'Timestamp should be set'),
                TestFramework.assert.notNull(auditLog.metadata, 'Metadata should be stored')
            ];

            // Verify metadata contains expected fields
            const metadata = auditLog.metadata;
            if (metadata && metadata.username) {
                assertions.push(TestFramework.assert.isTrue(
                    metadata.username === `audituser_${timestamp}`,
                    'Audit metadata should contain username'
                ));
            } else {
                assertions.push({ success: false, message: 'Audit metadata missing or invalid', expected: 'username field', actual: metadata });
            }

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Audit log created with correct metadata' };
        }
    );
}

module.exports = { registerCoreTests };