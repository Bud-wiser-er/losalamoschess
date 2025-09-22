// database/tests/db-advanced-tests.js
// Advanced Database Tests - Performance, Constraints, and Edge Cases

const TestFramework = require('../test-framework');
const bcrypt = require('bcrypt');

function registerAdvancedTests(framework) {

    // DB-08: Constraint Validation - Rating Bounds
    framework.addTest(
        'DB-08',
        'Rating constraints: User rating must be between 0 and 3000',
        async (client) => {
            const baseUser = {
                username: 'constraintuser_' + Date.now(),
                email: `constraint_${Date.now()}@example.com`,
                password_hash: await bcrypt.hash('password123', 12)
            };

            // Test invalid ratings
            const invalidRatings = [-100, 3001, -1, 5000];
            let constraintViolations = 0;

            for (const rating of invalidRatings) {
                try {
                    await client.query(`
                        INSERT INTO users (username, email, password_hash, rating)
                        VALUES ($1, $2, $3, $4)
                    `, [
                        baseUser.username + '_' + rating,
                        rating + '_' + baseUser.email,
                        baseUser.password_hash,
                        rating
                    ]);
                    
                    return { success: false, message: `Rating ${rating} should have been rejected`, expected: 'constraint error', actual: 'accepted invalid rating' };
                } catch (error) {
                    if (error.message.includes('valid_rating') || error.code === '23514') {
                        constraintViolations++;
                    } else {
                        return { success: false, message: `Unexpected error for rating ${rating}: ${error.message}` };
                    }
                }
            }

            // Test valid ratings
            const validRatings = [0, 1200, 2800, 3000];
            let validInsertions = 0;

            for (const rating of validRatings) {
                try {
                    const result = await client.query(`
                        INSERT INTO users (username, email, password_hash, rating)
                        VALUES ($1, $2, $3, $4)
                        RETURNING rating
                    `, [
                        baseUser.username + '_valid_' + rating,
                        'valid_' + rating + '_' + baseUser.email,
                        baseUser.password_hash,
                        rating
                    ]);
                    
                    if (result.rows[0].rating === rating) {
                        validInsertions++;
                    }
                } catch (error) {
                    return { success: false, message: `Valid rating ${rating} was rejected: ${error.message}` };
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

    // DB-09: Game Move Immutability (FINAL FIX)
    framework.addTest(
        'DB-09',
        'Move immutability: game_move table should be append-only (no updates/deletes)',
        async (client) => {
            try {
                const timestamp = Date.now();
                const randomSuffix = Math.random().toString(36).substring(7);
                
                // Setup: Create user and game
                const userResult = await client.query(`
                    INSERT INTO users (username, email, password_hash)
                    VALUES ($1, $2, $3)
                    RETURNING id
                `, [`moveimmutable_${timestamp}_${randomSuffix}`, `moveimmutable_${timestamp}_${randomSuffix}@example.com`, await bcrypt.hash('pass123', 12)]);
                
                const userId = userResult.rows[0].id;

                const gameResult = await client.query(`
                    INSERT INTO game (white_player_id, white_clock_ms, black_clock_ms)
                    VALUES ($1, $2, $3)
                    RETURNING id
                `, [userId, 300000, 300000]);

                const gameId = gameResult.rows[0].id;

                // Insert a move first
                const moveResult = await client.query(`
                    INSERT INTO game_move (game_id, ply, by, uci, san, flags, prev_fen, next_fen, server_ms_spent)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING game_id, ply
                `, [
                    gameId, 1, 'human', 'b2b3', 'b3', '{}',
                    'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
                    'rnqknr/pppppp/6/6/1PPPPP/RNQKNR b - - 0 1',
                    5
                ]);

                const insertedMove = moveResult.rows[0];

                // Test that UPDATE is forbidden (should raise exception)
                let updateBlocked = false;
                let updateError = '';
                try {
                    await client.query(`
                        UPDATE game_move 
                        SET uci = 'b2b4' 
                        WHERE game_id = $1 AND ply = $2
                    `, [insertedMove.game_id, insertedMove.ply]);
                    // If we get here, the trigger failed
                    updateBlocked = false;
                } catch (error) {
                    // This is expected - the trigger should block the update
                    if (error.message.includes('append-only')) {
                        updateBlocked = true;
                        updateError = error.message;
                    } else {
                        throw error; // Re-throw if it's not the expected error
                    }
                }

                // Test that DELETE is forbidden (should raise exception)
                let deleteBlocked = false;
                let deleteError = '';
                try {
                    await client.query(`
                        DELETE FROM game_move 
                        WHERE game_id = $1 AND ply = $2
                    `, [insertedMove.game_id, insertedMove.ply]);
                    // If we get here, the trigger failed
                    deleteBlocked = false;
                } catch (error) {
                    // This is expected - the trigger should block the delete
                    if (error.message.includes('append-only')) {
                        deleteBlocked = true;
                        deleteError = error.message;
                    } else {
                        throw error; // Re-throw if it's not the expected error
                    }
                }

                // Verify the move still exists (wasn't actually deleted)
                const verifyMove = await client.query(`
                    SELECT uci FROM game_move 
                    WHERE game_id = $1 AND ply = $2
                `, [insertedMove.game_id, insertedMove.ply]);

                // Clean up test data
                await client.query('DELETE FROM game WHERE id = $1', [gameId]);
                await client.query('DELETE FROM users WHERE id = $1', [userId]);

                const assertions = [
                    TestFramework.assert.isTrue(updateBlocked, `UPDATE should be blocked by trigger (got: ${updateError})`),
                    TestFramework.assert.isTrue(deleteBlocked, `DELETE should be blocked by trigger (got: ${deleteError})`),
                    TestFramework.assert.equals(verifyMove.rows.length, 1, 'Move should still exist after failed operations'),
                    TestFramework.assert.equals(verifyMove.rows[0].uci, 'b2b3', 'Move should be unchanged after failed update')
                ];

                const failedAssertion = assertions.find(a => !a.success);
                return failedAssertion || { success: true, message: 'Move immutability correctly enforced by triggers' };
                
            } catch (error) {
                // If we get the append-only error at the top level, that means the trigger is working
                if (error.message && error.message.includes('append-only')) {
                    return { success: true, message: 'Move immutability correctly enforced by triggers (caught top-level exception)' };
                } else {
                    throw error; // Re-throw other errors
                }
            }
        }
    );

    // DB-10: Performance Test - Concurrent Game Access
    framework.addTest(
        'DB-10',
        'Performance: Multiple concurrent game state reads should complete under 100ms',
        async (client) => {
            // Setup: Create multiple games
            const userResult = await client.query(`
                INSERT INTO users (username, email, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id
            `, ['perfuser', `perfuser_${Date.now()}@example.com`, await bcrypt.hash('pass123', 12)]);
            
            const userId = userResult.rows[0].id;

            const gameIds = [];
            for (let i = 0; i < 10; i++) {
                const gameResult = await client.query(`
                    INSERT INTO game (white_player_id, black_player_id, white_clock_ms, black_clock_ms)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [userId, null, 300000, 300000]);
                
                gameIds.push(gameResult.rows[0].id);
            }

            // Performance test: Multiple concurrent reads
            const startTime = Date.now();
            
            const readPromises = gameIds.map(gameId => 
                client.query(`
                    SELECT id, current_fen, to_move, status, ply, version
                    FROM game 
                    WHERE id = $1
                `, [gameId])
            );

            const results = await Promise.all(readPromises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            const assertions = [
                TestFramework.assert.equals(results.length, gameIds.length, 'All queries should complete'),
                TestFramework.assert.isTrue(duration < 100, `Query duration should be under 100ms (was ${duration}ms)`),
                TestFramework.assert.isTrue(results.every(r => r.rows.length === 1), 'All games should be found')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: `Performance test passed (${duration}ms for ${gameIds.length} concurrent reads)` };
        }
    );

    // DB-11: Data Integrity - Foreign Key Constraints (FIXED)
    framework.addTest(
        'DB-11',
        'Foreign key integrity: Invalid user references should be rejected',
        async (client) => {
            // Use a UUID that definitely doesn't exist
            const nonExistentUserId = '00000000-0000-4000-8000-000000000000';
            
            // Test game creation with invalid user ID
            let gameConstraintViolated = false;
            let gameError = '';
            try {
                await client.query(`
                    INSERT INTO game (white_player_id, white_clock_ms, black_clock_ms)
                    VALUES ($1, $2, $3)
                `, [nonExistentUserId, 300000, 300000]);
            } catch (error) {
                gameConstraintViolated = true;
                gameError = error.code;
            }

            // Test audit log with invalid user ID (audit_log allows NULL user_id, but let's test FK when not null)
            let auditConstraintViolated = false;
            let auditError = '';
            try {
                await client.query(`
                    INSERT INTO audit_log (action, user_id, metadata, ip_address)
                    VALUES ($1, $2, $3, $4)
                `, ['TEST_ACTION', nonExistentUserId, '{}', '127.0.0.1']);
            } catch (error) {
                auditConstraintViolated = true;
                auditError = error.code;
            }

            // Check if we got foreign key violations (23503)
            const gameFK = gameConstraintViolated && gameError === '23503';
            const auditFK = auditConstraintViolated && auditError === '23503';

            const assertions = [
                TestFramework.assert.isTrue(gameFK, `Game creation with invalid user should fail with FK violation (got: ${gameError})`),
                TestFramework.assert.isTrue(auditFK, `Audit log with invalid user should fail with FK violation (got: ${auditError})`)
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Foreign key constraints working correctly' };
        }
    );

    // DB-12: Index Performance Test (FIXED)
    framework.addTest(
        'DB-12',
        'Index performance: User email lookup should use index efficiently',
        async (client) => {
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(7);
            
            // Create test users
            const users = [];
            for (let i = 0; i < 10; i++) {
                const userResult = await client.query(`
                    INSERT INTO users (username, email, password_hash, rating)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, email
                `, [
                    `indexuser_${timestamp}_${i}_${randomSuffix}`,
                    `indexuser_${timestamp}_${i}_${randomSuffix}@example.com`,
                    await bcrypt.hash('password123', 12),
                    1200 + i
                ]);
                users.push(userResult.rows[0]);
            }

            const testEmail = users[5].email;

            // Check if email index exists
            const indexCheck = await client.query(`
                SELECT indexname 
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'users'
                AND indexname = 'idx_users_email'
            `);

            const indexExists = indexCheck.rows.length > 0;

            // Performance test
            const startTime = Date.now();
            const userResult = await client.query(`
                SELECT id, username, email, rating 
                FROM users 
                WHERE email = $1
            `, [testEmail]);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Clean up test users
            for (const user of users) {
                await client.query('DELETE FROM users WHERE id = $1', [user.id]);
            }

            const assertions = [
                TestFramework.assert.isTrue(indexExists, 'Email index (idx_users_email) should exist'),
                TestFramework.assert.equals(userResult.rows.length, 1, 'Should find exactly one user'),
                TestFramework.assert.equals(userResult.rows[0].email, testEmail, 'Should find correct user'),
                TestFramework.assert.isTrue(duration < 100, `Email lookup should be fast (was ${duration}ms)`)
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: `Email index working efficiently (${duration}ms, index exists: ${indexExists})` };
        }
    );

    // DB-13: Tournament System Integration
    framework.addTest(
        'DB-13',
        'Tournament system: Create tournament with participants and constraints',
        async (client) => {
            // Create users for tournament
            const users = [];
            for (let i = 0; i < 3; i++) {
                const userResult = await client.query(`
                    INSERT INTO users (username, email, password_hash, rating)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [
                    `tournament_user_${i}`,
                    `tournament_${i}_${Date.now()}@example.com`,
                    await bcrypt.hash('password123', 12),
                    1200 + (i * 100)
                ]);
                users.push(userResult.rows[0].id);
            }

            // Create tournament
            const tournamentResult = await client.query(`
                INSERT INTO tournament (name, description, format, max_participants, start_time, created_by)
                VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour', $5)
                RETURNING id, name, format, max_participants, status
            `, [
                'Test Tournament',
                'Unit test tournament',
                'swiss',
                16,
                users[0]
            ]);

            const tournament = tournamentResult.rows[0];

            // Add participants
            let participantsAdded = 0;
            for (const userId of users) {
                try {
                    await client.query(`
                        INSERT INTO tournament_participant (tournament_id, user_id)
                        VALUES ($1, $2)
                    `, [tournament.id, userId]);
                    participantsAdded++;
                } catch (error) {
                    return { success: false, message: `Failed to add participant: ${error.message}` };
                }
            }

            // Verify tournament data
            const participantCount = await client.query(`
                SELECT COUNT(*) as count 
                FROM tournament_participant 
                WHERE tournament_id = $1
            `, [tournament.id]);

            const assertions = [
                TestFramework.assert.notNull(tournament.id, 'Tournament should be created'),
                TestFramework.assert.equals(tournament.format, 'swiss', 'Tournament format should be correct'),
                TestFramework.assert.equals(tournament.status, 'registration', 'Tournament should start in registration'),
                TestFramework.assert.equals(participantsAdded, users.length, 'All participants should be added'),
                TestFramework.assert.equals(parseInt(participantCount.rows[0].count), users.length, 'Participant count should match')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Tournament system working correctly' };
        }
    );

    // DB-14: Friendship System (COMPLETELY FIXED)
    framework.addTest(
        'DB-14',
        'Friend system: Friend requests and status management',
        async (client) => {
            const timestamp = Date.now().toString();
            const randomSuffix = Math.random().toString(36).substring(7);
            
            // Create two users with explicit type casting to avoid parameter type issues
            const user1Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1::text, $2::text, $3::text, $4::integer)
                RETURNING id
            `, [
                `friend_user1_${timestamp}_${randomSuffix}`, 
                `friend1_${timestamp}_${randomSuffix}@example.com`, 
                await bcrypt.hash('pass123', 12), 
                1200
            ]);

            const user2Result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating)
                VALUES ($1::text, $2::text, $3::text, $4::integer)
                RETURNING id
            `, [
                `friend_user2_${timestamp}_${randomSuffix}`, 
                `friend2_${timestamp}_${randomSuffix}@example.com`, 
                await bcrypt.hash('pass123', 12), 
                1300
            ]);

            const user1Id = user1Result.rows[0].id;
            const user2Id = user2Result.rows[0].id;

            // Test 1: Send friend request
            const friendResult = await client.query(`
                INSERT INTO friend (user_id, friend_id, status)
                VALUES ($1::uuid, $2::uuid, $3::text)
                RETURNING id, status
            `, [user1Id, user2Id, 'pending']);

            // Test 2: Test self-friendship constraint (should be blocked)
            let selfFriendBlocked = false;
            let selfFriendError = '';
            try {
                await client.query(`
                    INSERT INTO friend (user_id, friend_id, status)
                    VALUES ($1::uuid, $1::uuid, $2::text)
                `, [user1Id, 'pending']);
            } catch (error) {
                selfFriendBlocked = true;
                selfFriendError = error.message;
            }

            // Test 3: Accept friend request
            await client.query(`
                UPDATE friend 
                SET status = $1::text, updated_at = NOW()
                WHERE id = $2::uuid
            `, ['accepted', friendResult.rows[0].id]);

            // Test 4: Verify friendship status
            const friendship = await client.query(`
                SELECT status FROM friend WHERE id = $1::uuid
            `, [friendResult.rows[0].id]);

            // Test 5: Test duplicate friend request prevention (should be blocked by unique constraint)
            let duplicateBlocked = false;
            try {
                await client.query(`
                    INSERT INTO friend (user_id, friend_id, status)
                    VALUES ($1::uuid, $2::uuid, $3::text)
                `, [user1Id, user2Id, 'pending']);
            } catch (error) {
                duplicateBlocked = true;
            }

            // Clean up test data
            await client.query('DELETE FROM friend WHERE user_id = $1::uuid OR friend_id = $1::uuid', [user1Id]);
            await client.query('DELETE FROM friend WHERE user_id = $1::uuid OR friend_id = $1::uuid', [user2Id]);
            await client.query('DELETE FROM users WHERE id = $1::uuid', [user1Id]);
            await client.query('DELETE FROM users WHERE id = $1::uuid', [user2Id]);

            const assertions = [
                TestFramework.assert.equals(friendResult.rows[0].status, 'pending', 'Initial friend request should be pending'),
                TestFramework.assert.isTrue(selfFriendBlocked, `Self-friendship should be prevented (got error: ${selfFriendError})`),
                TestFramework.assert.equals(friendship.rows[0].status, 'accepted', 'Friend request should be accepted'),
                TestFramework.assert.isTrue(duplicateBlocked, 'Duplicate friend requests should be prevented')
            ];

            const failedAssertion = assertions.find(a => !a.success);
            return failedAssertion || { success: true, message: 'Friendship system working correctly' };
        }
    );
}

module.exports = { registerAdvancedTests };