// database/test-connection.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'losalamos_chess',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log(`📍 Connecting to: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
    console.log(`🗄️  Database: ${process.env.DB_NAME || 'losalamos_chess'}`);
    console.log(`👤 User: ${process.env.DB_USER || 'postgres'}`);
    
    const client = await pool.connect();
    console.log('✅ Database connected successfully!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('🕐 Current time:', result.rows[0].current_time);
    console.log('🐘 PostgreSQL version:', result.rows[0].postgres_version.split(' ')[0]);
    
    // Test if our database exists and has tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('📋 Tables found:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('⚠️  No tables found - you may need to run the schema setup');
    }
    
    client.release();
    console.log('🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('  1. Make sure PostgreSQL is running');
      console.log('  2. Check if the port 5432 is correct');
      console.log('  3. Verify your .env file has the correct settings');
    } else if (error.code === '3D000') {
      console.log('\n💡 Database does not exist. Create it with:');
      console.log('  psql -U postgres -c "CREATE DATABASE losalamos_chess;"');
    } else if (error.code === '28P01') {
      console.log('\n💡 Authentication failed:');
      console.log('  1. Check your password in .env file');
      console.log('  2. Make sure the user exists and has permissions');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();