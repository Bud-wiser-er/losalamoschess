Los Alamos Chess - Backend

Overview

This backend implementation provides the core game logic and AI components for the Los Alamos Chess Platform (EPE 321 project). It implements the complete rules engine for the 6×6 Los Alamos chess variant and provides an AI bot with four difficulty levels.

Byron's Implementation Components

This backend section specifically implements Byron's responsibilities from the EPE 321 project:

1. Rules Engine
- Complete Los Alamos Chess variant implementation (6×6 board, no bishops, no castling, no en passant)
- Move validation and legal move generation
- FEN (Forsyth-Edwards Notation) parsing and generation for 6×6 boards  
- Game state management including check, checkmate, and stalemate detection
- Threefold repetition and fifty-move rule implementation
- Performance target: Move validation + application ≤ 5ms on development machines

2. AI Bot System
- Four difficulty levels (L0-L3) with progressive intelligence:
  - L0: Random move selection (Beginner)
  - L1: Greedy single-ply evaluation (Novice) 
  - L2: Minimax with 2-ply lookahead (Intermediate)
  - L3: Enhanced minimax with alpha-beta pruning (Advanced)
- Seedable RNG for deterministic testing
- Time-bounded computation with configurable millisecond caps
- UCI move format input/output integration

Project Structure

backend/
├── src/
│   ├── ai-bot/           AI Bot implementation
│   │   ├── index.js      Main AI interface
│   │   ├── evaluator.js  Position evaluation functions
│   │   └── strategies/   Difficulty level implementations
│   ├── engine/           Rules Engine core
│   │   ├── index.js      Main Rules Engine interface
│   │   ├── board-validator.js    Board state validation
│   │   ├── constants.js  Game constants and definitions
│   │   ├── game-state-checker.js Game termination detection
│   │   └── piece-movement.js     Piece movement logic
│   └── cli/              Command-line interface
│       └── main_entry_index.js
├── unit-tests/           Comprehensive test suite
│   ├── stress-test.js            Rules Engine stress tests
│   ├── test-ai-bot-stress.js     AI Bot stress tests
│   ├── test-ai-bot.js            AI Bot unit tests
│   ├── test-board-validator.js   Board validation tests
│   ├── test-file-loading.js      Module loading tests
│   ├── test-piece-movement.js    Piece movement tests
│   └── test-rules-engine.js      Rules Engine unit tests
└── docs/
    └── EPE321_Backend_Planning_Integration_guide.pdf

Key Features

Los Alamos Chess Variant Rules
- 6×6 board with files a-f and ranks 1-6
- No bishops in the starting position
- No castling allowed
- No en passant captures
- Promotion to Queen, Rook, or Knight only
- Initial FEN: rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1

Integration Points
This backend integrates with other team components:
- Frontend (Natasha): Provides game state and move validation APIs
- Database (Arno): Supplies game data persistence and retrieval
- Security (Elizabeth): Integrates with JWT authentication and RBAC
- Networking (Ethan): Supports real-time WebSocket communication

Installation & Setup

Prerequisites
- Node.js v18+ (as specified in project engines)
- npm or yarn package manager

Installation
Install dependencies:
npm install

Run Rules Engine tests:
node backend/unit-tests/test-rules-engine.js

Run AI Bot stress tests:
node backend/unit-tests/test-ai-bot-stress.js

Run complete stress test suite:
node backend/unit-tests/stress-test.js

Usage Examples

Rules Engine Usage
const RulesEngine = require('../src/engine/index.js');

const engine = new RulesEngine();

Initialize game from starting position
const initialFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
engine.setPosition(initialFEN);

Validate and apply a move
const move = 'b2b3';  UCI format
const result = engine.makeMove(move);

if (result.legal) {
    console.log('New position:', result.fen);
    console.log('Game status:', result.status);
} else {
    console.log('Illegal move:', result.error);
}

AI Bot Usage
const AIBot = require('./src/ai-bot/index.js');

const bot = new AIBot();

Generate AI move at difficulty level 2
const request = {
    fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    level: 2,      L0-L3 difficulty
    msCap: 1000    Maximum thinking time in milliseconds
};

const response = bot.generateMove(request);

if (response.ok) {
    console.log('AI suggests:', response.move);
    console.log('Evaluation:', response.eval);
    console.log('Time taken:', response.time, 'ms');
} else {
    console.log('Error:', response.error);
}

Testing

Test Coverage
The backend includes comprehensive test suites with 98.64% success rate across:

- 220+ total tests covering extreme conditions and edge cases
- Stress testing for performance under load
- Memory stability testing (1000+ iterations)
- Concurrency testing for parallel requests
- Invalid input validation testing
- Error recovery and resilience testing

Running Tests

Run individual test suites:
node backend/unit-tests/test-rules-engine.js
node backend/unit-tests/test-ai-bot.js
node backend/unit-tests/test-board-validator.js
node backend/unit-tests/test-piece-movement.js

Run comprehensive stress tests:
node backend/unit-tests/stress-test.js
node backend/unit-tests/test-ai-bot-stress.js

Test Results Summary
- Total Tests: 220
- Tests Passed: 217  
- Success Rate: 98.64%
- Known Issues: 3 tests related to castling rejection, check detection, and complete game sequences

API Interfaces

Rules Engine Interface
Main methods:
engine.setPosition(fen)           Set board position
engine.makeMove(uciMove)          Validate and apply move
engine.getLegalMoves()            Get all legal moves
engine.isCheck()                  Check if king is in check
engine.isCheckmate()              Check for checkmate
engine.isStalemate()              Check for stalemate
engine.generateFEN()              Export current position as FEN

AI Bot Interface  
Generate AI move:
bot.generateMove({
    fen: string,      Current position
    level: 0-3,       Difficulty level
    msCap: number     Time limit in milliseconds
})

Returns: { ok, move, eval, time, error }

Documentation

For complete implementation details, integration guidelines, and technical specifications, refer to:

EPE321_Backend_Planning_Integration_guide.pdf

This document contains:
- Detailed technical specifications
- Integration points with other components
- Performance benchmarks and testing results
- Architecture decisions and rationale
- API contracts and data formats
- Acceptance criteria and delivery requirements

Development Guidelines

Code Organization
- Modular design with clear separation of concerns
- Object-oriented architecture with well-defined interfaces
- Deterministic behavior with seedable randomization for testing
- Error handling with comprehensive validation and graceful failures

Performance Requirements
- Move validation: ≤ 5ms per operation
- AI move generation: Configurable time budgets (msCap parameter)
- Memory usage: Stable under load (< 50MB growth over 1000 iterations)
- Concurrency: Thread-safe operations for parallel requests

Integration Standards
- UCI move format for external communication
- FEN notation for position representation  
- JSON interfaces for API communication
- Error codes and status messages for debugging

Team Integration

This backend component integrates seamlessly with:

- Natasha (Frontend): React-based UI components receive validated game states
- Arno (Database): PostgreSQL persistence layer stores game data and statistics  
- Lizzy (Security): JWT authentication and RBAC authorization
- Ethan (Networking): WebSocket real-time communication and bot orchestration

License & Academic Use

This implementation is part of the EPE 321 Software Engineering course project at the University of Pretoria. Please refer to the university's academic policies regarding use and distribution.

Byron Norval (21444758) - Backend Game Logic Developer  
EPE 321 Software Engineering Project  
University of Pretoria  
September 2025