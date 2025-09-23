# Los Alamos Chess - Database Layer
## Overview

The database layer provides persistent storage and data management for the Los Alamos Chess platform. Built with PostgreSQL, it implements comprehensive data validation, audit logging, optimistic locking, and security constraints.

### Key Features

- **Los Alamos Chess Variant Support** - Schema optimized for 6x6 board gameplay
- **Optimistic Locking** - Version-controlled game state management
- **Audit Trail** - Complete change history for security and debugging
- **Data Integrity** - Comprehensive constraints and foreign key relationships
- **Performance Optimized** - Strategic indexing for high-frequency queries
- **Append-Only Move Log** - Immutable game history with trigger protection

## Directory Structure

```
database/
├── README.md                    # This file
├── schema.sql                   # Complete database schema definition
├── connection.js                # Database connection and configuration
├── setup.js                     # Schema deployment and initialization
├── seed.js                      # Test data generation
├── test-connection.js           # Connection diagnostics and health check
├── create-test-dirs.js          # Test directory structure setup
├── run-tests.js                 # Test suite orchestration
├── test-framework.js            # Custom testing framework
├── test-db.js                   # Legacy test compatibility
├── reports/                     # Generated test reports
│   └── test-report-*.md         # Timestamped test results
├── logs/                        # Test execution logs
├── tests/                       # Test suite implementation
│   ├── db-core-tests.js         # Core functionality tests
│   └── db-advanced-tests.js     # Advanced feature tests
└── .gitkeep files              # Directory preservation
```

## Core Files Description

### Schema and Configuration

#### `schema.sql`
**Purpose:** Complete PostgreSQL database schema definition  
**Contents:**
- Table definitions with constraints and relationships
- Indexes for performance optimization
- Triggers for data integrity enforcement
- Default values and check constraints

**Key Tables:**
- `users` - User accounts with security fields
- `game` - Game state with Los Alamos variant support
- `game_move` - Append-only move history
- `friend` - Social connection management
- `tournament` - Tournament system support
- `audit_log` - Security and change tracking

#### `connection.js`
**Purpose:** Database connection pool management  
**Features:**
- Connection pooling for performance
- Environment-based configuration
- Error handling and retry logic
- Health check capabilities

### Database Management

#### `setup.js`
**Purpose:** Database schema deployment and initialization  
**Usage:**
```bash
node database/setup.js
# or
npm run db:setup
```

**Operations:**
- Reads and executes schema.sql
- Creates all tables, indexes, and constraints
- Validates schema deployment
- Error reporting and rollback

#### `seed.js`
**Purpose:** Test data population for development  
**Usage:**
```bash
node database/seed.js
# or
npm run db:seed
```

**Test Data:**
- Sample user accounts with hashed passwords
- Example games in various states
- Tournament and friendship test scenarios
- Realistic move sequences

#### `test-connection.js`
**Purpose:** Database connectivity diagnostics  
**Usage:**
```bash
node database/test-connection.js
# or
npm run db:test
```

**Diagnostics:**
- Connection parameter validation
- PostgreSQL version detection
- Table existence verification
- Performance timing analysis

### Testing Infrastructure

#### `run-tests.js`
**Purpose:** Main test suite orchestration  
**Usage:**
```bash
node database/run-tests.js
```

**Features:**
- Comprehensive test execution
- Detailed reporting with timestamps
- Environment validation
- Test result aggregation

#### `test-framework.js`
**Purpose:** Custom database testing framework  
**Capabilities:**
- Transaction-based test isolation
- Constraint violation testing
- Performance benchmarking
- Detailed assertion library

#### `tests/db-core-tests.js`
**Purpose:** Core functionality validation  
**Test Coverage:**
- User creation and authentication
- Game state management
- Move addition and validation
- Optimistic locking mechanisms

#### `tests/db-advanced-tests.js`
**Purpose:** Advanced feature validation  
**Test Coverage:**
- Data integrity constraints
- Performance benchmarks
- Security validations
- Tournament and social features

## Database Schema

### Core Tables

#### Users Table
```sql
users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rating INTEGER DEFAULT 1200 CHECK (rating >= 0 AND rating <= 3000),
    is_online BOOLEAN DEFAULT FALSE,
    refresh_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### Game Table
```sql
game (
    id UUID PRIMARY KEY,
    variant TEXT DEFAULT 'LOS_ALAMOS' CHECK (variant = 'LOS_ALAMOS'),
    current_fen TEXT DEFAULT 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    to_move CHAR(1) DEFAULT 'w' CHECK (to_move IN ('w', 'b')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'mate', 'stalemate', 'draw')),
    white_player_id UUID REFERENCES users(id),
    black_player_id UUID REFERENCES users(id),
    version INTEGER DEFAULT 0, -- Optimistic locking
    created_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### Game Move Table (Append-Only)
```sql
game_move (
    game_id UUID REFERENCES game(id) ON DELETE CASCADE,
    ply INTEGER NOT NULL,
    by TEXT CHECK (by IN ('human', 'bot')),
    uci TEXT NOT NULL,
    san TEXT NOT NULL,
    flags JSONB DEFAULT '{}',
    prev_fen TEXT NOT NULL,
    next_fen TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (game_id, ply)
)
```

### Data Integrity Features

#### Triggers
- **Move Immutability**: Prevents UPDATE/DELETE on game_move table
- **Timestamp Updates**: Automatic updated_at field management
- **Audit Logging**: Automatic change tracking

#### Constraints
- **Rating Bounds**: User ratings between 0-3000
- **Self-Friendship Prevention**: Users cannot friend themselves
- **Unique Constraints**: Email and username uniqueness
- **Foreign Key Integrity**: Referential data consistency

## Environment Configuration

Create a `.env` file in the project root:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=los_alamos_chess
DB_USER=postgres
DB_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_key
PORT=3000
NODE_ENV=development
```

## Installation and Setup

### Prerequisites
- PostgreSQL 15+
- Node.js 18+
- npm or yarn package manager

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Initialize database:**
   ```bash
   npm run db:setup
   ```

4. **Verify installation:**
   ```bash
   npm run db:test
   ```

5. **Run test suite:**
   ```bash
   node database/run-tests.js
   ```

6. **Add test data (optional):**
   ```bash
   npm run db:seed
   ```

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `db:setup` | `node database/setup.js` | Create database schema |
| `db:test` | `node database/test-connection.js` | Test database connection |
| `db:seed` | `node database/seed.js` | Add test data |
| `db:reset` | `node database/setup.js` | Reset database schema |

## Testing

### Test Execution
```bash
# Run complete test suite
node database/run-tests.js

# Run specific test categories
node database/tests/db-core-tests.js
node database/tests/db-advanced-tests.js
```

### Test Coverage

The test suite validates:

- **DB-01**: User creation with password hashing
- **DB-02**: Duplicate email prevention
- **DB-03**: Game creation with initial state
- **DB-04**: Move addition with version control
- **DB-05**: Optimistic locking mechanisms
- **DB-06**: Game history retrieval
- **DB-07**: Audit logging functionality
- **DB-08**: Rating constraint validation
- **DB-09**: Move immutability enforcement
- **DB-10**: Performance benchmarks
- **DB-11**: Foreign key integrity
- **DB-12**: Index performance optimization
- **DB-13**: Tournament system functionality
- **DB-14**: Friendship system management

### Test Reports

Test results are automatically generated in `database/reports/` with detailed:
- Pass/fail status for each test
- Performance metrics
- Error details and stack traces
- Coverage analysis

## Performance Considerations

### Indexing Strategy
- **Primary Keys**: UUID-based for distributed scalability
- **Email Index**: Fast user lookup by email
- **Game Indexes**: Optimized for player and status queries
- **Move Index**: Efficient game history retrieval

### Connection Pooling
- Configurable connection limits
- Automatic connection cleanup
- Health check monitoring

### Query Optimization
- Prepared statements for security
- Strategic use of EXPLAIN ANALYZE
- Minimal data transfer patterns

## Security Features

### Authentication
- bcrypt password hashing (salt rounds: 12)
- JWT token management with refresh capabilities
- Session invalidation support

### Authorization
- Row-level security considerations
- Audit trail for all mutations
- IP address logging for security events

### Data Protection
- Input sanitization at database level
- SQL injection prevention through parameterized queries
- Constraint-based data validation

## Troubleshooting

### Common Issues

**Connection Refused:**
```bash
# Check PostgreSQL service
sudo systemctl status postgresql
# or on Windows
services.msc
```

**Permission Denied:**
```bash
# Verify user privileges
psql -U postgres -c "\du"
```

**Schema Deployment Fails:**
```bash
# Check database existence
psql -U postgres -l | grep los_alamos_chess
```

**Test Failures:**
```bash
# Run diagnostics
node database/test-connection.js
# Check detailed report in database/reports/
```

### Performance Issues

**Slow Queries:**
```sql
-- Enable query logging
SET log_statement = 'all';
SET log_min_duration_statement = 1000; -- Log queries > 1s
```

**Connection Pool Exhaustion:**
- Review pool size configuration
- Check for connection leaks
- Monitor active connections

## Development Workflow

### Schema Changes
1. Update `schema.sql`
2. Test changes locally: `npm run db:setup`
3. Run test suite: `node database/run-tests.js`
4. Update migration scripts if needed

### Adding Tests
1. Add test cases to appropriate file in `tests/`
2. Follow existing pattern for assertions
3. Ensure test isolation and cleanup
4. Update documentation

### Performance Monitoring
1. Use `EXPLAIN ANALYZE` for query optimization
2. Monitor test performance metrics
3. Profile connection pool usage
4. Track database growth patterns

## Integration

This database layer integrates with:
- **Byron's Rules Engine**: Game state validation and move processing
- **Elizabeth's Security Layer**: User authentication and authorization
- **Ethan's WebSocket Server**: Real-time game state synchronization
- **Nastasha's Frontend**: User interface data requirements

## Contributing

### Code Standards
- Use consistent SQL formatting
- Follow Node.js naming conventions
- Include comprehensive error handling
- Document complex queries

### Testing Requirements
- All new features require test coverage
- Performance tests for query changes
- Integration tests for schema modifications
- Regression tests for bug fixes

## Support

For database-related issues:
1. Check the troubleshooting section
2. Review test reports in `database/reports/`
3. Examine logs in `database/logs/`
4. Run diagnostic tools: `npm run db:test`

---

**Maintainer**: Arno Meyer (Database & Persistence)  
**Course**: EPE321 Software Engineering  
**Institution**: University of Pretoria  
**Last Updated**: September 2025