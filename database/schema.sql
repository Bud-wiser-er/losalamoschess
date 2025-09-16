-- Los Alamos Chess Database Schema
-- Updated for Security Integration Requirements

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS bot_run CASCADE;
DROP TABLE IF EXISTS game_move CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS idempotency CASCADE;
DROP TABLE IF EXISTS friend CASCADE;
DROP TABLE IF EXISTS tournament_participant CASCADE;
DROP TABLE IF EXISTS tournament CASCADE;
DROP TABLE IF EXISTS game CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table with security enhancements
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rating INTEGER DEFAULT 1200,
    is_online BOOLEAN DEFAULT FALSE,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    reset_token VARCHAR(255),
    reset_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Security constraints
    CONSTRAINT unique_email UNIQUE (email),
    CONSTRAINT unique_username UNIQUE (username),
    CONSTRAINT valid_rating CHECK (rating >= 0 AND rating <= 3000)
);

-- Games table (Los Alamos variant)
CREATE TABLE game (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant TEXT NOT NULL DEFAULT 'LOS_ALAMOS' CHECK (variant = 'LOS_ALAMOS'),
    current_fen TEXT NOT NULL DEFAULT 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    to_move CHAR(1) NOT NULL DEFAULT 'w' CHECK (to_move IN ('w', 'b')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'mate', 'stalemate', 'draw')),
    ply INTEGER NOT NULL DEFAULT 0,
    white_player_id UUID REFERENCES users(id) ON DELETE SET NULL,
    black_player_id UUID REFERENCES users(id) ON DELETE SET NULL,
    white_clock_ms INTEGER NOT NULL DEFAULT 300000, -- 5 minutes
    black_clock_ms INTEGER NOT NULL DEFAULT 300000, -- 5 minutes
    version INTEGER NOT NULL DEFAULT 0, -- For optimistic locking
    winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game moves (append-only audit trail)
CREATE TABLE game_move (
    game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    ply INTEGER NOT NULL,
    by TEXT NOT NULL CHECK (by IN ('human', 'bot')),
    uci TEXT NOT NULL, -- Universal Chess Interface notation
    san TEXT NOT NULL, -- Standard Algebraic Notation (server-derived)
    flags JSONB NOT NULL DEFAULT '{}', -- check, mate, capture, promotion flags
    prev_fen TEXT NOT NULL,
    next_fen TEXT NOT NULL,
    server_ms_spent INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (game_id, ply)
);

-- Bot decision audit
CREATE TABLE bot_run (
    game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    ply INTEGER NOT NULL,
    request JSONB NOT NULL, -- BotRequest DTO
    reply JSONB NOT NULL,   -- BotReply DTO
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (game_id, ply)
);

-- Security audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotency for API calls
CREATE TABLE idempotency (
    key TEXT PRIMARY KEY,
    game_id UUID NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Friends system
CREATE TABLE friend (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- Tournaments
CREATE TABLE tournament (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    format TEXT NOT NULL DEFAULT 'swiss' CHECK (format IN ('swiss', 'knockout', 'round_robin')),
    max_participants INTEGER NOT NULL DEFAULT 16,
    status TEXT NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'active', 'completed')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament participants
CREATE TABLE tournament_participant (
    tournament_id UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    eliminated_at TIMESTAMPTZ,
    final_rank INTEGER,
    PRIMARY KEY (tournament_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_online ON users(is_online);

CREATE INDEX idx_game_players ON game(white_player_id, black_player_id);
CREATE INDEX idx_game_status ON game(status);
CREATE INDEX idx_game_created ON game(created_at);

CREATE INDEX idx_game_move_game ON game_move(game_id);
CREATE INDEX idx_game_move_created ON game_move(created_at);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);

CREATE INDEX idx_friend_user ON friend(user_id);
CREATE INDEX idx_friend_status ON friend(status);

CREATE INDEX idx_tournament_status ON tournament(status);
CREATE INDEX idx_tournament_start ON tournament(start_time);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_game_updated_at BEFORE UPDATE ON game FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_friend_updated_at BEFORE UPDATE ON friend FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_tournament_updated_at BEFORE UPDATE ON tournament FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Prevent game_move updates (append-only)
CREATE OR REPLACE FUNCTION forbid_game_move_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'game_move table is append-only. Updates and deletes are not permitted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_forbid_move_upd
    BEFORE UPDATE OR DELETE ON game_move
    FOR EACH ROW
    EXECUTE FUNCTION forbid_game_move_mutation();