/**
 * Database Connection Pool Configuration
 *
 * Provides a centralized PostgreSQL connection pool with proper error handling
 * and configuration management for the Los Alamos Chess platform.
 *
 * Environment Variables Required:
 * - DB_USER: Database username (default: postgres)
 * - DB_HOST: Database host (default: localhost)
 * - DB_NAME: Database name (default: losalamos_chess)
 * - DB_PASSWORD: Database password (required)
 * - DB_PORT: Database port (default: 5432)
 */

require('dotenv').config();
const { Pool } = require('pg');

/**
 * PostgreSQL connection pool instance
 * Configured for optimal performance and reliability
 */
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'losalamos_chess',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,

  // Connection pool optimization settings
  max: 20,                      // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,     // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000 // Connection timeout threshold
});

/**
 * Global error handler for unexpected database connection issues
 * Ensures application fails fast on critical database problems
 */
pool.on('error', (err, client) => {
  console.error('Critical database pool error:', err.message);
  process.exit(-1);
});

/**
 * Execute a parameterized query with performance monitoring
 *
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result object
 * @throws {Error} Database execution errors
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log query performance for monitoring (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Query executed in ${duration}ms - ${result.rowCount} rows affected`);
    }

    return result;
  } catch (error) {
    console.error('Database query failed:', error.message);
    throw error;
  }
};

/**
 * Acquire a dedicated client from the connection pool
 * Use for transactions or multiple related queries
 *
 * @returns {Promise<Object>} Database client instance
 */
const getClient = async () => {
  return await pool.connect();
};

/**
 * Gracefully close the database connection pool
 * Should be called during application shutdown
 *
 * @returns {Promise<void>}
 */
const closePool = async () => {
  await pool.end();
};

module.exports = {
  query,
  getClient,
  pool,
  closePool
};