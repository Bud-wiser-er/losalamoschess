/**
 * Base Repository Class
 * Provides common database operations that all repositories can extend
 */

class BaseRepository {
    constructor(databaseService) {
        this.db = databaseService;
    }

    /**
     * Execute a raw query
     */
    async query(text, params = []) {
        return await this.db.connection.query(text, params);
    }

    /**
     * Execute within a transaction
     */
    async withTransaction(callback) {
        return await this.db.connection.withTransaction(callback);
    }

    /**
     * Find a single record by ID
     */
    async findById(tableName, id) {
        const query = `SELECT * FROM ${tableName} WHERE id = $1`;
        const result = await this.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Find multiple records with optional conditions
     */
    async findMany(tableName, conditions = {}, limit = null, orderBy = 'created_at DESC') {
        let query = `SELECT * FROM ${tableName}`;
        const params = [];
        let paramCount = 1;

        // Add WHERE conditions
        if (Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions).map(key => {
                params.push(conditions[key]);
                return `${key} = $${paramCount++}`;
            }).join(' AND ');
            
            query += ` WHERE ${whereClause}`;
        }

        // Add ORDER BY
        if (orderBy) {
            query += ` ORDER BY ${orderBy}`;
        }

        // Add LIMIT
        if (limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(limit);
        }

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Create a new record
     */
    async create(tableName, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

        const query = `
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;

        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Update a record by ID
     */
    async update(tableName, id, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        
        const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');
        values.push(id); // Add ID for WHERE clause

        const query = `
            UPDATE ${tableName} 
            SET ${setClause}, updated_at = NOW()
            WHERE id = $${values.length}
            RETURNING *
        `;

        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Delete a record by ID
     */
    async delete(tableName, id) {
        const query = `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`;
        const result = await this.query(query, [id]);
        return result.rows[0];
    }

    /**
     * Check if a record exists
     */
    async exists(tableName, conditions = {}) {
        let query = `SELECT EXISTS(SELECT 1 FROM ${tableName}`;
        const params = [];
        let paramCount = 1;

        if (Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions).map(key => {
                params.push(conditions[key]);
                return `${key} = $${paramCount++}`;
            }).join(' AND ');
            
            query += ` WHERE ${whereClause}`;
        }

        query += `)`;

        const result = await this.query(query, params);
        return result.rows[0].exists;
    }

    /**
     * Count records with optional conditions
     */
    async count(tableName, conditions = {}) {
        let query = `SELECT COUNT(*) FROM ${tableName}`;
        const params = [];
        let paramCount = 1;

        if (Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions).map(key => {
                params.push(conditions[key]);
                return `${key} = $${paramCount++}`;
            }).join(' AND ');
            
            query += ` WHERE ${whereClause}`;
        }

        const result = await this.query(query, params);
        return parseInt(result.rows[0].count);
    }

    /**
     * Execute a paginated query
     */
    async paginate(tableName, { page = 1, limit = 10, conditions = {}, orderBy = 'created_at DESC' }) {
        const offset = (page - 1) * limit;
        
        // Get total count
        const totalCount = await this.count(tableName, conditions);
        
        // Get paginated results
        let query = `SELECT * FROM ${tableName}`;
        const params = [];
        let paramCount = 1;

        // Add WHERE conditions
        if (Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions).map(key => {
                params.push(conditions[key]);
                return `${key} = $${paramCount++}`;
            }).join(' AND ');
            
            query += ` WHERE ${whereClause}`;
        }

        // Add ORDER BY, LIMIT, OFFSET
        query += ` ORDER BY ${orderBy} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        const result = await this.query(query, params);
        
        return {
            data: result.rows,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: page * limit < totalCount,
                hasPrevPage: page > 1
            }
        };
    }
}

module.exports = BaseRepository;