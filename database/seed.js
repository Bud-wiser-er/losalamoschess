// database/seed.js
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'losalamos_chess',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

async function seedDatabase() {
    console.log('Starting database seeding with test data...\n');
    
    try {
        const client = await pool.connect();
        console.log('OK: Connected to database');

        // Clear existing data (be careful in production!)
        console.log('Clearing existing test data...');
        await client.query('DELETE FROM game_move');
        await client.query('DELETE FROM game');
        await client.query('DELETE FROM audit_log');
        await client.query('DELETE FROM users WHERE email LIKE \'%@test.com\'');
        
        // Create test users
        console.log('Creating test users...');
        const testUsers = [
            {
                username: 'alice_test',
                email: 'alice@test.com',
                password: 'TestPassword123!',
                rating: 1400
            },
            {
                username: 'bob_test', 
                email: 'bob@test.com',
                password: 'TestPassword123!',
                rating: 1200
            },
            {
                username: 'charlie_test',
                email: 'charlie@test.com', 
                password: 'TestPassword123!',
                rating: 1600
            }
        ];

        const createdUsers = [];
        for (const user of testUsers) {
            const passwordHash = await bcrypt.hash(user.password, 12);
            
            const result = await client.query(`
                INSERT INTO users (username, email, password_hash, rating, is_online)
                VALUES ($1, $2, $3, $4, false)
                RETURNING id, username, email, rating
            `, [user.username, user.email, passwordHash, user.rating]);
            
            createdUsers.push(result.rows[0]);
            console.log(`   OK: Created user: ${user.username} (${user.email})`);
        }

        // Create a test game
        console.log('Creating test game...');
        const gameResult = await client.query(`
            INSERT INTO game (
                white_player_id, black_player_id, 
                white_clock_ms, black_clock_ms,
                current_fen, to_move, status, ply, version
            )
            VALUES ($1, $2, 300000, 300000, 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', 'w', 'active', 0, 1)
            RETURNING id, white_player_id, black_player_id
        `, [createdUsers[0].id, createdUsers[1].id]);

        const testGame = gameResult.rows[0];
        console.log(`   OK: Created game between ${createdUsers[0].username} (white) vs ${createdUsers[1].username} (black)`);

        // Add some test moves to the game
        console.log('Adding test moves...');
        const testMoves = [
            { 
                ply: 1, 
                uci: 'b1c3', 
                san: 'Nc3', 
                prev_fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
                next_fen: 'rnqknr/pppppp/6/6/PPPPPP/RNNKQR b - - 1 1'
            },
            { 
                ply: 2, 
                uci: 'b6c4', 
                san: 'Nc4', 
                prev_fen: 'rnqknr/pppppp/6/6/PPPPPP/RNNKQR b - - 1 1',
                next_fen: 'rnqknr/pppppp/6/6/PPnPPP/RNNKQR w - - 2 2'
            }
        ];

        for (const move of testMoves) {
            await client.query(`
                INSERT INTO game_move (
                    game_id, ply, by, uci, san, flags, 
                    prev_fen, next_fen, server_ms_spent
                )
                VALUES ($1, $2, 'human', $3, $4, '{}', $5, $6, 50)
            `, [testGame.id, move.ply, move.uci, move.san, move.prev_fen, move.next_fen]);
            
            console.log(`   OK: Added move ${move.ply}: ${move.san} (${move.uci})`);
        }

        // Update game state to match the last move
        await client.query(`
            UPDATE game 
            SET current_fen = $1, ply = $2, version = $3
            WHERE id = $4
        `, [testMoves[testMoves.length - 1].next_fen, testMoves.length, testMoves.length + 1, testGame.id]);

        // Add some audit log entries
        console.log('Adding audit log entries...');
        for (const user of createdUsers) {
            await client.query(`
                INSERT INTO audit_log (action, user_id, metadata, timestamp)
                VALUES ('USER_REGISTERED', $1, $2, NOW())
            `, [user.id, JSON.stringify({ email: user.email, username: user.username })]);
        }
        console.log('   OK: Added registration audit logs');

        // Final verification
        const statsResult = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE email LIKE '%@test.com') as test_users,
                (SELECT COUNT(*) FROM game) as games,
                (SELECT COUNT(*) FROM game_move) as moves,
                (SELECT COUNT(*) FROM audit_log) as audit_entries
        `);

        const stats = statsResult.rows[0];
        console.log('\nSeeding Results:');
        console.log(`   Test Users: ${stats.test_users}`);
        console.log(`   Games: ${stats.games}`);
        console.log(`   Moves: ${stats.moves}`);
        console.log(`   Audit Entries: ${stats.audit_entries}`);

        client.release();
        console.log('\nSUCCESS: Database seeding completed successfully!');
        console.log('\nINFO: Test credentials:');
        testUsers.forEach(user => {
            console.log(`   ${user.email} / Password: ${user.password}`);
        });

    } catch (error) {
        console.error('\nERROR: Database seeding failed:');
        console.error('Error:', error.message);
        
        if (error.code === '23505') {
            console.log('\nINFO: Duplicate key error - test users may already exist');
            console.log('   Try running scripts\\db-reset.cmd first to clean the database');
        }

        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };