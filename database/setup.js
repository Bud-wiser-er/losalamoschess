/**
 * Database Schema Setup Utility
 *
 * Initializes the Los Alamos Chess database schema by executing the SQL
 * schema file and verifying proper table and index creation.
 *
 * This script should be run once during initial setup or when resetting
 * the database to a clean state.
 *
 * Usage: node database/setup.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Database connection pool for schema setup operations
 */
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'losalamos_chess',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

/**
 * Main database schema setup function
 * Reads and executes the schema.sql file to create all required tables and indexes
 *
 * @returns {Promise<void>}
 * @throws {Error} If schema file is missing or database operation fails
 */
async function setupDatabase() {
    console.log('Initializing database schema setup...\n');

    try {
        // Locate and validate schema file
        const schemaPath = path.join(__dirname, 'schema.sql');

        if (!fs.existsSync(schemaPath)) {
            console.error('CRITICAL: Schema file not found at:', schemaPath);
            console.error('Please ensure database/schema.sql exists in your project');
            process.exit(1);
        }

        // Load schema content
        const schema = fs.readFileSync(schemaPath, 'utf8');
        console.log('Schema file loaded successfully');

        // Establish database connection
        const client = await pool.connect();
        console.log('Database connection established');
        console.log(`Target database: ${process.env.DB_NAME || 'losalamos_chess'}`);
        console.log(`Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}\n`);

        // Execute schema creation
        console.log('Executing database schema...');
        await client.query(schema);
        console.log('Schema execution completed successfully');

        // Verify table creation
        const tablesResult = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('\nCreated tables:');
        if (tablesResult.rows.length > 0) {
            tablesResult.rows.forEach(row => {
                console.log(`  - ${row.table_name}`);
            });
        } else {
            console.log('  WARNING: No tables detected - schema execution may have failed');
        }

        // Verify index creation
        const indexResult = await client.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename IN ('users', 'game', 'game_move', 'audit_log')
            ORDER BY indexname
        `);

        if (indexResult.rows.length > 0) {
            console.log('\nCreated indexes:');
            indexResult.rows.forEach(row => {
                console.log(`  - ${row.indexname}`);
            });
        }

        client.release();
        console.log('\nDatabase schema setup completed successfully');
        console.log('Next step: Run "npm run db:test" to verify the connection');

    } catch (error) {
        console.error('\nDatabase setup failed:', error.message);

        // Provide specific troubleshooting guidance based on error type
        if (error.code === '3D000') {
            console.error('\nDatabase does not exist. Create it manually:');
            console.error(`  psql -U ${process.env.DB_USER || 'postgres'} -c "CREATE DATABASE ${process.env.DB_NAME || 'losalamos_chess'};"`);
        } else if (error.code === 'ECONNREFUSED') {
            console.error('\nConnection refused. Verify:');
            console.error('  1. PostgreSQL service is running');
            console.error('  2. Database configuration in .env file');
            console.error('  3. Network connectivity to database host');
        } else if (error.code === '28P01') {
            console.error('\nAuthentication failed. Check:');
            console.error('  1. Database password in .env file');
            console.error('  2. User account exists and has proper permissions');
        }

        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };