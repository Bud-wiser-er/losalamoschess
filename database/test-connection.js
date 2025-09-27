/**
 * Database Connection Test Utility
 *
 * Validates PostgreSQL database connectivity and verifies that the schema
 * has been properly initialized. Provides diagnostic information for
 * troubleshooting connection issues.
 *
 * Usage: node database/test-connection.js
 */

require('dotenv').config();
const { Pool } = require('pg');

/**
 * Connection pool configured specifically for testing purposes
 * Uses minimal connections and shorter timeouts for quick feedback
 */
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'losalamos_chess',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,

  // Testing-optimized connection settings
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 1 // Single connection sufficient for testing
});

/**
 * Execute database connection test with comprehensive diagnostics
 *
 * @returns {Promise<void>}
 */
async function testConnection() {
  let client = null;

  try {
    console.log('Initiating database connection test...');
    console.log(`Target: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
    console.log(`Database: ${process.env.DB_NAME || 'losalamos_chess'}`);
    console.log(`User: ${process.env.DB_USER || 'postgres'}`);
    console.log('');

    // Establish database connection
    client = await pool.connect();
    console.log('Database connection established successfully');

    // Verify database functionality with basic query
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    const currentTime = result.rows[0].current_time;
    const version = result.rows[0].postgres_version.split(' ')[0];

    console.log(`Current server time: ${currentTime}`);
    console.log(`PostgreSQL version: ${version}`);
    console.log('');

    // Verify schema installation by checking for tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log('Schema verification - Tables found:');
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
      console.log(`Total tables: ${tablesResult.rows.length}`);
    } else {
      console.log('WARNING: No tables detected in database');
      console.log('Schema may not be initialized. Consider running:');
      console.log('  node database/setup.js');
      console.log('  npm run db:setup');
    }

    console.log('');
    console.log('Database test completed successfully');
    console.log('Database is operational and ready for use');

  } catch (error) {
    console.error('Database connection test failed');
    console.error(`Error type: ${error.code || 'UNKNOWN'}`);
    console.error(`Details: ${error.message}`);
    console.log('');
    
    // Provide specific troubleshooting based on error type
    switch (error.code) {
      case 'ECONNREFUSED':
        console.log('TROUBLESHOOTING - Connection refused:');
        console.log('  1. Make sure PostgreSQL is running');
        console.log('  2. Check if port 5432 is correct');
        console.log('  3. Verify your .env file settings');
        console.log('  4. Try: services.msc -> PostgreSQL -> Start');
        break;
        
      case '3D000':
        console.log('TROUBLESHOOTING - Database does not exist:');
        console.log('  Create the database manually:');
        console.log('  psql -U postgres -c "CREATE DATABASE losalamos_chess;"');
        console.log('  Or run: scripts\\db-reset.cmd');
        break;
        
      case '28P01':
        console.log('TROUBLESHOOTING - Authentication failed:');
        console.log('  1. Check your password in .env file');
        console.log('  2. Ensure user exists and has permissions');
        console.log('  3. Try connecting manually: psql -U postgres');
        break;
        
      case 'ENOTFOUND':
        console.log('TROUBLESHOOTING - Host not found:');
        console.log('  1. Check DB_HOST in .env file');
        console.log('  2. Ensure localhost is correct');
        console.log('  3. Try IP address: 127.0.0.1');
        break;
        
      default:
        console.log('TROUBLESHOOTING - General database error:');
        console.log('  1. Check your .env file configuration');
        console.log('  2. Verify PostgreSQL is installed and running');
        console.log('  3. Run: scripts\\validate-env.cmd');
        break;
    }
    
    process.exit(1);
    
  } finally {
    // Clean up resources
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
  process.exit(1);
});

// Run the test
testConnection();