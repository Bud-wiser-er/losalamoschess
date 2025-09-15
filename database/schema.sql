-- database/schema.sql
-- Creates the Los Alamos Chess database structure

-- Users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rating INTEGER DEFAULT 1000,
    is_online BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    refresh_token VARCHAR(255)
);

-- Games table
CREATE TABLE games (
    game_id SERIAL PRIMARY KEY,
    player1_id INTEGER REFERENCES users(user_id),
    player2_id INTEGER REFERENCES users(user_id),
    winner_id INTEGER REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    fen_position TEXT DEFAULT 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    version INTEGER DEFAULT 0 -- For preventing race conditions
);

-- Game moves table (one-to-many with games)
CREATE TABLE game_moves (
    move_id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(game_id) ON DELETE CASCADE,
    move_number INTEGER,
    player_id INTEGER REFERENCES users(user_id),
    move_notation VARCHAR(10), -- Like 'e2e4'
    fen_after TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friends table (many-to-many relationship)
CREATE TABLE friendships (
    friendship_id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(user_id),
    user2_id INTEGER REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id)
);

-- Audit log table (for tracking changes)
CREATE TABLE audit_log (
    log_id SERIAL PRIMARY KEY,
    table_name VARCHAR(50),
    operation VARCHAR(10), -- 'INSERT', 'UPDATE', 'DELETE'
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_games_players ON games(player1_id, player2_id);
CREATE INDEX idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX idx_friendships_users ON friendships(user1_id, user2_id);