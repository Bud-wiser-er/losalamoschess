// database/tests/db-advanced-tests.js
// Advanced Database Tests - Performance, Constraints, and Edge Cases
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
 * Register all advanced database functionality tests
 * These tests validate constraints, performance, edge cases, and advanced features
 * 
 * @param {TestFramework} framework - The test framework instance to register tests with
 */
function registerAdvancedTests(framework) {

    // DB-08: Constraint Validation - Rating Bounds
    framework.addTest(
        'DB-08',
        'Rating constraints: User rating must be between 0 and 3000',
        async (client) => {
            const timestamp = Date.now();
            const baseUser = {
                username: 'constraintuser_' + timestamp,
                email: `constraint_${timestamp}@example.com`,
                password_hash: await bcrypt.hash('password123', 12)
            };

            // Test invalid ratings - these should all be rejected
            const invalidRatings = [-100, 3001, -1, 5000];
            let constraintViolations = 0;

            for (let i = 0; i < invalidRatings.length; i++) {
                const rating = invalidRatings[i];
                
                // Use a separate transaction for each test to avoid rollback issues
                try {
                    // Use a savepoint to isolate this operation
                    await client.query('SAVEPOINT test_invalid_rating');
                    
                    await client.query(`
                        INSERT INTO users (username, email, password_hash, rating)
                        VALUES ($1, $2, $3, $4)
                    `, [
                        baseUser.username + '_invalid_' + rating + '_' + i,
                        'invalid_' + rating + '_' + i + '_' + baseUser.email,
                        baseUser.password_hash,
                        rating
                    ]);
                    
                    // If we get here, the constraint didn't work
                    await client.query('ROLLBACK TO SAVEPOINT test_invalid_rating');
                    return { success: false, message: `Rating ${rating} should have been rejected`, expected: 'constraint error', actual: 'accepted invalid rating' };
                    
                } catch (error) {
                    // Rollback to the savepoint to clear the error state
                    await client.query('ROLLBACK TO SAVEPOINT test_invalid_rating');
                    
                    if (error.message.includes('valid_rating') || error.code === '23514') {
                        constraintViolations++;
                    } else {
                        return { success: false, message: `Unexpected error for rating ${rating}: ${error.message}` };
                    }
                }
            }

            // Test valid ratings - these should all be accepted
            const validRatings = [0, 1200, 2800, 3000];
            let validInsertions = 0;

            for (let i = 0; i < validRatings.length; i++) {
                const rating = validRatings[i];
                try {
                    const result = await client.query(`
                        INSERT INTO users (username, email, password_hash, rating)
                        VALUES ($1, $2, $3, $4)
                        RETURNING rating
                    `, [
                        baseUser.username + '_valid_' + rating + '_' + i,
                        'valid_' + rating + '_' + i + '_' + baseUser.email,
                        baseUser.password_hash,
                        rating
                    ]);
                    
                    if (result.rows[0].rating === rating) {
                        validInsertions++;
                    }
                } catch (error) {
                    return { success: false, message: `Valid rating ${rating} was rejected: ${error.message}`, expected: 'accepted', actual: 'rejected' };
                }
            }

            const assertions = [
                TestFramework.assert.equals(constraintViolations, invalidRatings.length, 'All invalid ratings should be rejected'),
                TestFramework.assert.equals(validInsertions, validRatings.length, 'All valid ratings should be accepted')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Rating constraints working correctly' };
        }
    );

    // DB-09: Move Immutability Enforcement
    framework.addTest(
        'DB-09',
        'Move immutability: Moves cannot be modified after creation',
        async (client) => {
            // Create users and game for moves
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();
            
            const user1Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`immuteplayer1_${timestamp}`, `immuteplayer1_${timestamp}@example.com`, passwordHash, 1200]);

            const user2Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`immuteplayer2_${timestamp}`, `immuteplayer2_${timestamp}@example.com`, passwordHash, 1300]);

            const player1Id = user1Result.rows[0].id;
            const player2Id = user2Result.rows[0].id;

            const gameResult = await client.query(`
                INSERT INTO game (variant, current_fen, status, white_player_id, black_player_id, version)
                VALUES ('LOS_ALAMOS', 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'active', $1, $2, 1)
                RETURNING id
            `, [player1Id, player2Id]);

            const gameId = gameResult.rows[0].id;

            // Create a move
            const moveResult = await client.query(`
                INSERT INTO game_move (game_id, ply, by, uci, san, flags, prev_fen, next_fen)
                VALUES ($1, 1, 'human', 'e2e3', 'e3', '{}', $2, $3)
                RETURNING game_id, san
            `, [gameId, 
                'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', // prev_fen
                'rnqknr/pppppp/6/6/PPPP1P/RNQKPR w - - 0 2'   // next_fen
            ]);

            const originalNotation = moveResult.rows[0].san;

            // Attempt to modify the move - this should fail if triggers are in place
            // Note: This test assumes you have triggers to prevent move modifications
            try {
                const updateResult = await client.query(`
                    UPDATE game_move 
                    SET san = 'e4', uci = 'e2e4'
                    WHERE game_id = $1 AND ply = 1
                `, [gameId]);

                // If update succeeded, check if the move was actually changed
                const verifyResult = await client.query(`
                    SELECT san, uci FROM game_move WHERE game_id = $1 AND ply = 1
                `, [gameId]);

                const updatedMove = verifyResult.rows[0];

                // Check if move was actually modified
                if (updatedMove.san !== originalNotation || updatedMove.uci !== 'e2e3') {
                    return { success: false, message: 'Move was modified when it should be immutable', expected: 'no change', actual: 'move changed' };
                } else {
                    return { success: true, message: 'Move remained immutable (trigger protection working)' };
                }

            } catch (error) {
                // If update failed due to trigger or constraint, that's what we want
                if (error.message.includes('prevent') || error.message.includes('immutable') || error.message.includes('append-only') || error.code === 'P0001') {
                    return { success: true, message: 'Move modification correctly prevented by database trigger' };
                } else {
                    // Unexpected error
                    return { success: false, message: `Unexpected error during move modification: ${error.message}` };
                }
            }
        }
    );

    // DB-10: Performance Benchmark - Bulk Operations
    framework.addTest(
        'DB-10',
        'Performance: Bulk user creation within acceptable time limits',
        async (client) => {
            const startTime = Date.now();
            const userCount = 100;
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();

            // Bulk insert users
            for (let i = 0; i < userCount; i++) {
                await client.query(`
                    INSERT INTO users (username, email, password_hash, rating)
                    VALUES ($1, $2, $3, $4)
                `, [
                    `perfuser${i}_${timestamp}`,
                    `perfuser${i}_${timestamp}@example.com`,
                    passwordHash,
                    1200 + (i % 800) // Vary ratings from 1200 to 1999
                ]);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Verify all users were created
            const countResult = await client.query(`
                SELECT COUNT(*) as count FROM users WHERE username LIKE $1
            `, [`perfuser%_${timestamp}`]);

            const createdCount = parseInt(countResult.rows[0].count);

            // Performance target: Should create 100 users in under 10 seconds
            const performanceTarget = 10000; // 10 seconds in milliseconds

            const assertions = [
                TestFramework.assert.equals(createdCount, userCount, 'All users should be created'),
                TestFramework.assert.isTrue(duration < performanceTarget, `Bulk creation should complete within ${performanceTarget}ms`)
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { 
                success: true, 
                message: `Performance test passed: ${userCount} users created in ${duration}ms` 
            };
        }
    );

    // DB-11: Foreign Key Integrity
    framework.addTest(
        'DB-11',
        'Foreign key integrity: Cannot create game with non-existent players',
        async (client) => {
            // Generate fake UUIDs that don't exist in the database
            const fakePlayerId1 = '00000000-0000-0000-0000-000000000001';
            const fakePlayerId2 = '00000000-0000-0000-0000-000000000002';

            // Attempt to create game with non-existent player IDs
            try {
                await client.query(`
                    INSERT INTO game (variant, current_fen, status, white_player_id, black_player_id, version)
                    VALUES ('LOS_ALAMOS', 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'active', $1, $2, 1)
                `, [fakePlayerId1, fakePlayerId2]);

                return { success: false, message: 'Game creation with non-existent players should have failed', expected: 'foreign key violation', actual: 'game created' };

            } catch (error) {
                // Check if it's a foreign key constraint violation
                if (error.code === '23503' || error.message.includes('foreign key') || error.message.includes('violates')) {
                    return { success: true, message: 'Foreign key constraint correctly prevented game creation with non-existent players' };
                } else {
                    return { success: false, message: `Unexpected error type: ${error.message}`, expected: 'foreign key violation', actual: error.code };
                }
            }
        }
    );

    // DB-12: Index Performance Optimization
    framework.addTest(
        'DB-12',
        'Index performance: Email lookup should be fast with proper indexing',
        async (client) => {
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();

            // Create several users to test index performance
            const userCount = 50;
            for (let i = 0; i < userCount; i++) {
                await client.query(`
                    INSERT INTO users (username, email, password_hash, rating)
                    VALUES ($1, $2, $3, $4)
                `, [
                    `indexuser${i}_${timestamp}`,
                    `indexuser${i}_${timestamp}@example.com`,
                    passwordHash,
                    1200 + i
                ]);
            }

            // Test email lookup performance
            const testEmail = `indexuser25_${timestamp}@example.com`;
            const startTime = Date.now();

            const lookupResult = await client.query(`
                SELECT id, username, email, rating FROM users WHERE email = $1
            `, [testEmail]);

            const endTime = Date.now();
            const lookupDuration = endTime - startTime;

            // Performance target: Email lookup should complete in under 100ms
            const performanceTarget = 100;

            const assertions = [
                TestFramework.assert.arrayLength(lookupResult.rows, 1, 'Should find exactly one user'),
                TestFramework.assert.equals(lookupResult.rows[0].email, testEmail, 'Should find correct user'),
                TestFramework.assert.isTrue(lookupDuration < performanceTarget, `Email lookup should complete within ${performanceTarget}ms`)
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { 
                success: true, 
                message: `Index performance test passed: Email lookup completed in ${lookupDuration}ms` 
            };
        }
    );

    // DB-13: Tournament System Functionality
    framework.addTest(
        'DB-13',
        'Tournament system: Tournament creation and player enrollment',
        async (client) => {
            const timestamp = Date.now();
            const passwordHash = await bcrypt.hash('password123', 12);

            // First create a user to be the tournament creator (required for foreign key)
            const creatorResult = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [
                `tournamentcreator_${timestamp}`,
                `tournamentcreator_${timestamp}@example.com`,
                passwordHash,
                1500
            ]);

            const creatorId = creatorResult.rows[0].id;

            // Create tournament
            const tournamentResult = await client.query(`
                INSERT INTO tournament (name, description, start_time, end_time, status, max_participants, created_by)
                VALUES ($1, $2, NOW() + INTERVAL '1 day', NOW() + INTERVAL '7 days', 'registration', 16, $3)
                RETURNING id, name, status, max_participants
            `, [
                `Test Tournament ${timestamp}`,
                `Tournament for testing purposes - ${timestamp}`,
                creatorId // Use real user ID instead of fake UUID
            ]);

            const tournament = tournamentResult.rows[0];

            // Create test users for enrollment
            const players = [];

            for (let i = 0; i < 3; i++) {
                const playerResult = await client.query(`
                    INSERT INTO users (username, email, password_hash, rating)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [
                    `tourneyplayer${i}_${timestamp}`,
                    `tourneyplayer${i}_${timestamp}@example.com`,
                    passwordHash,
                    1400 + (i * 100)
                ]);
                players.push(playerResult.rows[0].id);
            }

            // Enroll players in tournament
            for (const playerId of players) {
                await client.query(`
                    INSERT INTO tournament_participant (tournament_id, user_id, joined_at)
                    VALUES ($1, $2, NOW())
                `, [tournament.id, playerId]);
            }

            // Verify tournament and enrollments
            const participantCountResult = await client.query(`
                SELECT COUNT(*) as count FROM tournament_participant WHERE tournament_id = $1
            `, [tournament.id]);

            const participantCount = parseInt(participantCountResult.rows[0].count);

            const assertions = [
                TestFramework.assert.notNull(tournament.id, 'Tournament ID should be generated'),
                TestFramework.assert.equals(tournament.status, 'registration', 'Tournament status should be registration'),
                TestFramework.assert.equals(tournament.max_participants, 16, 'Max participants should be set correctly'),
                TestFramework.assert.equals(participantCount, 3, 'All 3 players should be enrolled'),
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Tournament system functioning correctly' };
        }
    );

    // DB-14: Friendship System Management
    framework.addTest(
        'DB-14',
        'Friendship system: Friend requests and acceptance workflow',
        async (client) => {
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();

            // Create two users for friendship test
            const user1Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id, username
            `, [`frienduser1_${timestamp}`, `frienduser1_${timestamp}@example.com`, passwordHash, 1500]);

            const user2Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id, username
            `, [`frienduser2_${timestamp}`, `frienduser2_${timestamp}@example.com`, passwordHash, 1600]);

            const user1Id = user1Result.rows[0].id;
            const user2Id = user2Result.rows[0].id;

            // Send friend request from user1 to user2
            const friendRequestResult = await client.query(`
                INSERT INTO friend (user_id, friend_id, status, created_at)
                VALUES ($1, $2, 'pending', NOW())
                RETURNING id, status, created_at
            `, [user1Id, user2Id]);

            const friendRequest = friendRequestResult.rows[0];

            // Accept friend request
            const acceptResult = await client.query(`
                UPDATE friend 
                SET status = 'accepted', updated_at = NOW()
                WHERE id = $1
                RETURNING status, updated_at
            `, [friendRequest.id]);

            const acceptedFriendship = acceptResult.rows[0];

            // Verify friendship exists both ways (reciprocal)
            const friendshipCheckResult = await client.query(`
                SELECT user_id, friend_id, status FROM friend 
                WHERE (user_id = $1 AND friend_id = $2) 
                   OR (user_id = $2 AND friend_id = $1)
            `, [user1Id, user2Id]);

            const friendships = friendshipCheckResult.rows;

            const assertions = [
                TestFramework.assert.notNull(friendRequest.id, 'Friend request ID should be generated'),
                TestFramework.assert.equals(acceptedFriendship.status, 'accepted', 'Friendship should be accepted'),
                TestFramework.assert.notNull(acceptedFriendship.updated_at, 'Updated timestamp should be set'),
                TestFramework.assert.arrayLength(friendships, 1, 'Should have one friendship record'),
                TestFramework.assert.equals(friendships[0].status, 'accepted', 'Friendship status should be accepted')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Friendship system working correctly' };
        }
    );

    // DB-15: Data Consistency Under Load
    framework.addTest(
        'DB-15',
        'Data consistency: Multiple concurrent operations maintain integrity',
        async (client) => {
            const passwordHash = await bcrypt.hash('password123', 12);
            const timestamp = Date.now();

            // Create users for load test
            const user1Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`loaduser1_${timestamp}`, `loaduser1_${timestamp}@example.com`, passwordHash, 1200]);

            const user2Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [`loaduser2_${timestamp}`, `loaduser2_${timestamp}@example.com`, passwordHash, 1300]);

            const player1Id = user1Result.rows[0].id;
            const player2Id = user2Result.rows[0].id;

            // Create multiple games simultaneously to test consistency
            const gameCreationPromises = [];
            const gameCount = 5;

            for (let i = 0; i < gameCount; i++) {
                const gamePromise = client.query(`
                    INSERT INTO game (variant, current_fen, status, white_player_id, black_player_id, version)
                    VALUES ('LOS_ALAMOS', 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'active', $1, $2, 1)
                    RETURNING id
                `, [player1Id, player2Id]);
                gameCreationPromises.push(gamePromise);
            }

            // Execute all game creations concurrently
            const gameResults = await Promise.all(gameCreationPromises);

            // Verify all games were created with unique IDs
            const gameIds = gameResults.map(result => result.rows[0].id);
            const uniqueGameIds = new Set(gameIds);

            // Check database consistency
            const gameCountResult = await client.query(`
                SELECT COUNT(*) as count FROM game 
                WHERE white_player_id = $1 AND black_player_id = $2 
                AND created_at > NOW() - INTERVAL '1 minute'
            `, [player1Id, player2Id]);

            const actualGameCount = parseInt(gameCountResult.rows[0].count);

            const assertions = [
                TestFramework.assert.equals(gameIds.length, gameCount, 'All game creation promises should resolve'),
                TestFramework.assert.equals(uniqueGameIds.size, gameCount, 'All game IDs should be unique'),
                TestFramework.assert.isTrue(actualGameCount >= gameCount, 'Database should contain at least the created games')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Data consistency maintained under concurrent load' };
        }
    );
}

module.exports = { registerAdvancedTests };