// database/setup.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'losalamos_chess',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

async function setupDatabase() {
    console.log('Starting database schema setup...\n');
    
    try {
        // Read the schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            console.error('ERROR: schema.sql file not found at:', schemaPath);
            console.log('INFO: Make sure database/schema.sql exists in your project');
            process.exit(1);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');
        console.log('OK: Schema file loaded successfully');
        
        // Connect to database
        const client = await pool.connect();
        console.log('OK: Connected to database');
        console.log(`Database: ${process.env.DB_NAME || 'losalamos_chess'}`);
        console.log(`Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}\n`);

        // Execute the schema
        console.log('Executing schema...');
        await client.query(schema);
        console.log('OK: Schema executed successfully');

        // Verify tables were created
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('\nTables created:');
        if (tablesResult.rows.length > 0) {
            tablesResult.rows.forEach(row => {
                console.log(`   OK: ${row.table_name}`);
            });
        } else {
            console.log('   WARNING: No tables found - there might be an issue with the schema');
        }

        // Check indexes
        const indexResult = await client.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename IN ('users', 'game', 'game_move', 'audit_log')
            ORDER BY indexname
        `);

        if (indexResult.rows.length > 0) {
            console.log('\nIndexes created:');
            indexResult.rows.forEach(row => {
                console.log(`   OK: ${row.indexname}`);
            });
        }

        client.release();
        console.log('\nSUCCESS: Database setup completed successfully!');
        console.log('INFO: You can now run "npm run db:test" to verify the connection');

    } catch (error) {
        console.error('\nERROR: Database setup failed:');
        console.error('Error:', error.message);
        
        if (error.code === '3D000') {
            console.log('\nINFO: Database does not exist. Create it first with:');
            console.log(`   psql -U ${process.env.DB_USER || 'postgres'} -c "CREATE DATABASE ${process.env.DB_NAME || 'losalamos_chess'};"`);
        } else if (error.code === 'ECONNREFUSED') {
            console.log('\nINFO: Connection refused. Make sure:');
            console.log('   1. PostgreSQL is running');
            console.log('   2. Your .env file has correct database settings');
            console.log('   3. The database user has proper permissions');
        } else if (error.code === '28P01') {
            console.log('\nINFO: Authentication failed:');
            console.log('   1. Check your password in .env file');
            console.log('   2. Make sure the database user exists');
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