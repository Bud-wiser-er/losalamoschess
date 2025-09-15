const { Pool } = require('pg');

// Database configuration
const config = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'losalamos_chess',
    password: process.env.DB_PASSWORD || 'your_password',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
const pool = new Pool(config);

// Test connection on startup
pool.on('connect', (client) => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Database connection error:', err);
    process.exit(1);
});

// Export pool and utility functions
module.exports = {
    pool,
    
    // Execute a query
    async query(text, params) {
        const start = Date.now();
        try {
            const result = await pool.query(text, params);
            const duration = Date.now() - start;
            console.log('Executed query', { text, duration, rows: result.rowCount });
            return result;
        } catch (error) {
            console.error('Database query error:', { text, params, error: error.message });
            throw error;
        }
    },

    // Get a client from the pool for transactions
    async getClient() {
        const client = await pool.connect();
        const query = client.query;
        const release = client.release;

        // Set a timeout of 5 seconds, after which we will log this client's last query
        const timeout = setTimeout(() => {
            console.error('A client has been checked out for more than 5 seconds!');
            console.error(`The last executed query on this client was: ${client.lastQuery}`);
        }, 5000);

        // Monkey patch the query method to keep track of the last query executed
        client.query = (...args) => {
            client.lastQuery = args;
            return query.apply(client, args);
        };

        client.release = () => {
            clearTimeout(timeout);
            // Call the actual 'release' method
            release.apply(client);
        };

        return client;
    },

    // Transaction wrapper
    async withTransaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    // Close all connections
    async close() {
        await pool.end();
        console.log('Database pool closed');
    }
};