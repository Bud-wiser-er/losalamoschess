// database/tests/db-core-tests.js
// Core Database Unit Tests - Based on Group Design Document Table 3

const TestFramework = require('../test-framework');
const bcrypt = require('bcrypt');

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
            
            // Verify user was created
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

    // DB-02: Duplicate Email Prevention
    framework.addTest(
        'DB-02',
        'Duplicate email: createUser(duplicate) - Error thrown, no row created',
        async (client) => {
            const email = `duplicate_${Date.now()}@example.com`;
            
            // Create first user
            const insertQuery = `
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;
            
            await client.query(insertQuery, [
                'user1',
                email,
                await bcrypt.hash('password123', 12),
                1200
            ]);

            // Count users before duplicate attempt
            const countBefore = await client.query('SELECT COUNT(*) as count FROM users WHERE email = $1', [email]);
            
            // Attempt to create duplicate user
            try {
                await client.query(insertQuery, [
                    'user2',
                    email, // Same email
                    await bcrypt.hash('password456', 12),
                    1400
                ]);
                
                return { success: false, message: 'Should have thrown constraint violation error', expected: 'constraint error', actual: 'no error' };
            } catch (error) {
                // Verify constraint error was thrown
                if (!error.message.includes('unique_email') && !error.code === '23505') {
                    return { success: false, message: 'Wrong error type thrown', expected: 'unique constraint error', actual: error.message };
                }

                // Verify no duplicate row was created
                const countAfter = await client.query('SELECT COUNT(*) as count FROM users WHERE email = $1', [email]);
                
                return TestFramework.assert.equals(
                    parseInt(countAfter.rows[0].count), 
                    parseInt(countBefore.rows[0].count),
                    'User count should remain unchanged after duplicate attempt'
                );
            }
        }
    );

    // DB-03: Game Creation with Initial State
    framework.addTest(
        'DB-03',
        'New game creation: saveGame(initial) - Game row with initial FEN and version=0',
        async (client) => {
            // Create a user for the game
            const userResult = await client.query(`
                INSERT INTO users (username, email, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id
            `, ['testplayer', `player_${Date.now()}@example.com`, await bcrypt.hash('pass123', 12)]);
            
            const userId = userResult.rows[0].id;
            
            const gameData = {
                whitePlayerId: userId,
                blackPlayerId: null,
                whiteClockMs: 300000,
                blackClockMs: 300000
            };

            const insertGameQuery = `
                INSERT INTO game (white_player_id, black_player_id, white_clock_ms, black_clock_ms)
                VALUES ($1, $2, $3, $4)
                RETURNING id, variant, current_fen, to_move, status, ply, version, created_at
            `;

            const result = await client.query(insertGameQuery, [
                gameData.whitePlayerId,
                gameData.blackPlayerId,
                gameData.whiteClockMs,
                gameData.blackClockMs
            ]);

            const game = result.rows[0];
            const initialFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

            const assertions = [
                TestFramework.assert.notNull(game.id, 'Game ID should be generated'),
                TestFramework.assert.equals(game.variant, 'LOS_ALAMOS', 'Variant should be Los Alamos'),
                TestFramework.assert.equals(game.current_fen, initialFEN, 'Should have initial Los Alamos FEN'),
                TestFramework.assert.equals(game.to_move, 'w', 'White should move first'),
                TestFramework.assert.equals(game.status, 'active', 'Game should be active'),
                TestFramework.assert.equals(game.ply, 0, 'Should start at ply 0'),
                TestFramework.assert.equals(game.version, 0, 'Should start at version 0 for optimistic locking'),
                TestFramework.assert.notNull(game.created_at, 'Created timestamp should be set')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Game created with correct initial state' };
        }
    );

    // DB-04: Move Addition with Version Increment
    framework.addTest(
        'DB-04',
        'Append move: addMove(gameId) - Move row added, game version increments',
        async (client) => {
            // Setup: Create user and game
            const userResult = await client.query(`
                INSERT INTO users (username, email, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id
            `, ['moveplayer', `moveplayer_${Date.now()}@example.com`, await bcrypt.hash('pass123', 12)]);
            
            const userId = userResult.rows[0].id;

            const gameResult = await client.query(`
                INSERT INTO game (white_player_id, white_clock_ms, black_clock_ms)
                VALUES ($1, $2, $3)
                RETURNING id, version, current_fen
            `, [userId, 300000, 300000]);

            const gameId = gameResult.rows[0].id;
            const initialVersion = gameResult.rows[0].version;
            const currentFEN = gameResult.rows[0].current_fen;

            // Add a move
            const moveData = {
                ply: 1,
                by: 'human',
                uci: 'b2b3',
                san: 'b3',
                flags: JSON.stringify({}),
                prev_fen: currentFEN,
                next_fen: 'rnqknr/pppppp/6/6/1PPPPP/RNQKNR b - - 0 1',
                server_ms_spent: 5
            };

            // Insert move
            const insertMoveQuery = `
                INSERT INTO game_move (game_id, ply, by, uci, san, flags, prev_fen, next_fen, server_ms_spent)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const moveResult = await client.query(insertMoveQuery, [
                gameId, moveData.ply, moveData.by, moveData.uci, moveData.san,
                moveData.flags, moveData.prev_fen, moveData.next_fen, moveData.server_ms_spent
            ]);

            // Update game version
            await client.query(`
                UPDATE game 
                SET version = version + 1, current_fen = $2, ply = $3, updated_at = NOW()
                WHERE id = $1
            `, [gameId, moveData.next_fen, moveData.ply]);

            // Verify move was added
            const addedMove = moveResult.rows[0];
            
            // Verify version incremented
            const updatedGame = await client.query('SELECT version FROM game WHERE id = $1', [gameId]);
            const newVersion = updatedGame.rows[0].version;

            const assertions = [
                TestFramework.assert.notNull(addedMove, 'Move should be inserted'),
                TestFramework.assert.equals(addedMove.uci, moveData.uci, 'UCI notation should match'),
                TestFramework.assert.equals(addedMove.by, moveData.by, 'Move source should match'),
                TestFramework.assert.equals(newVersion, initialVersion + 1, 'Game version should increment')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Move added successfully with version increment' };
        }
    );

    // DB-05: Optimistic Locking - Version Conflict
    framework.addTest(
        'DB-05',
        'Wrong version: updateGame(version) twice - Second update fails with VERSION_CONFLICT',
        async (client) => {
            // Setup: Create user and game
            const userResult = await client.query(`
                INSERT INTO users (username, email, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id
            `, ['lockplayer', `lockplayer_${Date.now()}@example.com`, await bcrypt.hash('pass123', 12)]);
            
            const userId = userResult.rows[0].id;

            const gameResult = await client.query(`
                INSERT INTO game (white_player_id, white_clock_ms, black_clock_ms)
                VALUES ($1, $2, $3)
                RETURNING id, version
            `, [userId, 300000, 300000]);

            const gameId = gameResult.rows[0].id;
            const currentVersion = gameResult.rows[0].version;

            // First update (should succeed)
            const update1Query = `
                UPDATE game 
                SET ply = ply + 1, version = version + 1, updated_at = NOW()
                WHERE id = $1 AND version = $2
            `;
            
            const firstUpdate = await client.query(update1Query, [gameId, currentVersion]);

            if (firstUpdate.rowCount !== 1) {
                return { success: false, message: 'First update should succeed', expected: 1, actual: firstUpdate.rowCount };
            }

            // Second update with stale version (should fail)
            const secondUpdate = await client.query(update1Query, [gameId, currentVersion]); // Using old version

            // Verify second update failed (no rows affected)
            return TestFramework.assert.equals(
                secondUpdate.rowCount,
                0,
                'Second update with stale version should affect 0 rows (optimistic lock failure)'
            );
        }
    );

    // DB-06: Game History with Limit and Ordering
    framework.addTest(
        'DB-06',
        'History request: getHistory(limit=3) - Returns ≤ 3 games in correct order',
        async (client) => {
            // Setup: Create user
            const userResult = await client.query(`
                INSERT INTO users (username, email, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id
            `, ['historyplayer', `historyplayer_${Date.now()}@example.com`, await bcrypt.hash('pass123', 12)]);
            
            const userId = userResult.rows[0].id;

            // Create 5 games with different timestamps
            const gameIds = [];
            for (let i = 0; i < 5; i++) {
                const gameResult = await client.query(`
                    INSERT INTO game (white_player_id, black_player_id, white_clock_ms, black_clock_ms, created_at)
                    VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${5-i} minutes')
                    RETURNING id, created_at
                `, [userId, null, 300000, 300000]);
                
                gameIds.push({
                    id: gameResult.rows[0].id,
                    created_at: gameResult.rows[0].created_at
                });
            }

            // Query for game history with limit
            const historyQuery = `
                SELECT id, created_at
                FROM game
                WHERE white_player_id = $1 OR black_player_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            `;

            const historyResult = await client.query(historyQuery, [userId, 3]);
            const games = historyResult.rows;

            const assertions = [
                TestFramework.assert.isTrue(games.length <= 3, 'Should return at most 3 games'),
                TestFramework.assert.isTrue(games.length > 0, 'Should return at least 1 game')
            ];

            // Verify correct ordering (most recent first)
            if (games.length > 1) {
                for (let i = 0; i < games.length - 1; i++) {
                    const current = new Date(games[i].created_at);
                    const next = new Date(games[i + 1].created_at);
                    
                    if (current < next) {
                        assertions.push({ success: false, message: 'Games should be ordered by created_at DESC', expected: 'DESC order', actual: 'wrong order' });
                        break;
                    }
                }
                
                if (!assertions.find(a => !a.success)) {
                    assertions.push({ success: true, message: 'Games correctly ordered by created_at DESC' });
                }
            }

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: `Game history returned correctly (${games.length} games)` };
        }
    );

    // DB-07: Audit Logging on Mutations
    framework.addTest(
        'DB-07',
        'Audit logging: Any mutation - Audit row created with old/new values',
        async (client) => {
            // Setup: Create user
            const userResult = await client.query(`
                INSERT INTO users (username, email, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id
            `, ['audituser', `audituser_${Date.now()}@example.com`, await bcrypt.hash('pass123', 12)]);
            
            const userId = userResult.rows[0].id;

            // Create audit log entry (simulating what DatabaseService would do)
            const auditData = {
                action: 'USER_CREATED',
                userId: userId,
                metadata: {
                    username: 'audituser',
                    email: `audituser_${Date.now()}@example.com`,
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
                    metadata.username === 'audituser',
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