// database/test-connection.js
// Tests PostgreSQL database connection and verifies schema setup
require('dotenv').config();
const { Pool } = require('pg');

// Create connection pool with fallback defaults
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'losalamos_chess',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  // Connection timeout and retry settings
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 1 // Only need 1 connection for testing
});

async function testConnection() {
  let client = null;
  
  try {
    console.log('Testing database connection...');
    console.log(`Connecting to: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
    console.log(`Database: ${process.env.DB_NAME || 'losalamos_chess'}`);
    console.log(`User: ${process.env.DB_USER || 'postgres'}`);
    console.log('');

    // Get client from pool with timeout
    client = await pool.connect();
    console.log('SUCCESS: Database connected successfully!');
    
    // Test basic query and get PostgreSQL version info
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    const currentTime = result.rows[0].current_time;
    const version = result.rows[0].postgres_version.split(' ')[0];
    
    console.log(`Current time: ${currentTime}`);
    console.log(`PostgreSQL version: ${version}`);
    console.log('');

    // Check if database has required tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('Tables found in database:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      console.log(`Total tables: ${tablesResult.rows.length}`);
    } else {
      console.log('WARNING: No tables found in database');
      console.log('You may need to run the schema setup:');
      console.log('   node database/setup.js');
      console.log('   or run: scripts\\db-reset.cmd');
    }
    
    console.log('');
    console.log('SUCCESS: Database test completed successfully!');
    console.log('Database is ready for use.');
    
  } catch (error) {
    console.error('ERROR: Database connection failed');
    console.error(`Error code: ${error.code || 'UNKNOWN'}`);
    console.error(`Error message: ${error.message}`);
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