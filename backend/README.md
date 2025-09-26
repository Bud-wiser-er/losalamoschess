# Los Alamos Chess - Backend

## Overview

This backend implementation provides the core game logic and AI components for the Los Alamos Chess Platform (EPE 321 project). It implements the complete rules engine for the 6×6 Los Alamos chess variant and provides an AI bot with four difficulty levels.

## Byron's Implementation Components

This backend section specifically implements Byron's responsibilities from the EPE 321 project:

### 1. Rules Engine
- Complete Los Alamos Chess variant implementation (6×6 board, no bishops, no castling, no en passant)
- Move validation and legal move generation
- FEN (Forsyth-Edwards Notation) parsing and generation for 6×6 boards
- Game state management including check, checkmate, and stalemate detection
- Threefold repetition and fifty-move rule implementation
- Performance target: Move validation + application ≤ 5ms on development machines

### 2. AI Bot System
- Four difficulty levels (L0-L3) with progressive intelligence:
  - **L0**: Random move selection (Beginner)
  - **L1**: Greedy single-ply evaluation (Novice)
  - **L2**: Minimax with 2-ply lookahead (Intermediate)
  - **L3**: Enhanced minimax with alpha-beta pruning (Advanced)
- Seedable RNG for deterministic testing
- Time-bounded computation with configurable millisecond caps
- UCI move format input/output integration

## Project Structure

```
backend/
├── src/
│   ├── ai-bot/                   # AI Bot implementation
│   │   ├── index.js              # Main AI interface
│   │   ├── evaluator.js          # Position evaluation functions
│   │   └── strategies/           # Difficulty level implementations
│   │       ├── random.js         # L0: Random strategy
│   │       ├── greedy.js         # L1: Greedy strategy
│   │       ├── minimax.js        # L2: Minimax strategy
│   │       └── enhanced.js       # L3: Enhanced strategy
│   ├── engine/                   # Rules Engine core
│   │   ├── index.js              # Main Rules Engine interface
│   │   ├── board-validator.js    # Board state validation
│   │   ├── constants.js          # Game constants and definitions
│   │   ├── game-state-checker.js # Game termination detection
│   │   └── piece-movement.js     # Piece movement logic
│   └── cli/                      # Command-line interface
│       └── main_entry_index.js   # Entry point and exports
├── unit-tests/                   # Comprehensive test suite
│   ├── stress-test.js            # Rules Engine stress tests
│   ├── test-ai-bot-stress.js     # AI Bot stress tests
│   ├── test-ai-bot.js            # AI Bot unit tests
│   ├── test-board-validator.js   # Board validation tests
│   ├── test-file-loading.js      # Module loading tests
│   ├── test-piece-movement.js    # Piece movement tests
│   └── test-rules-engine.js      # Rules Engine unit tests
└── docs/
    ├── Diagrams/                 # UML architecture diagrams
    └── EPE321_Backend_Planning_Integration_guide.pdf
```

## Key Features

### Los Alamos Chess Variant Rules
- 6×6 board with files a-f and ranks 1-6
- No bishops in the starting position
- No castling allowed
- No en passant captures
- Promotion to Queen, Rook, or Knight only
- Initial FEN: `rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1`

### Architecture Design
- **Stateless Rules Engine**: Pure function design for predictable behavior
- **Strategy Pattern**: AI bot implements strategy pattern for difficulty levels
- **Modular Components**: Clear separation of concerns with well-defined interfaces
- **Comprehensive Testing**: 97.4% test coverage across all modules

## Integration Points

This backend integrates with other team components:

- **Frontend (Natasha)**: Provides game state and move validation APIs
- **Database (Arno)**: Supplies game data persistence and retrieval
- **Security (Elizabeth)**: Integrates with JWT authentication and RBAC
- **Networking (Ethan)**: Supports real-time WebSocket communication

### Data Contracts

**Rules Engine → WebSocket**
```javascript
// Input
{
  fen: "rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1",
  uci: "e2e4",
  options?: {}
}

// Output
{
  valid: true,
  flags: { check: false, checkmate: false, stalemate: false }
}
```

**AI Bot → WebSocket**
```javascript
// Input (BotRequest)
{
  fen: "current-position",
  level: "L2",        // L0, L1, L2, or L3
  msCap: 1000,        // Max time in milliseconds
  seed?: 42           // Optional for deterministic results
}

// Output (BotResponse)
{
  ok: true,
  move: "e7e5",       // UCI format
  eval: 0.3,          // Position evaluation
  time: 850           // Actual time taken in ms
}
```

## Installation & Setup

### Prerequisites
- Node.js v18+ (as specified in project engines)
- npm or yarn package manager

### Installation

Install dependencies:
```bash
npm install
```

### Running Tests

Run Rules Engine tests:
```bash
node backend/unit-tests/test-rules-engine.js
```

Run AI Bot stress tests:
```bash
node backend/unit-tests/test-ai-bot-stress.js
```

Run complete stress test suite:
```bash
node backend/unit-tests/stress-test.js
```

## Usage Examples

### Rules Engine Usage

```javascript
const RulesEngine = require('./src/engine/index.js');

const engine = new RulesEngine();

// Initialize game from starting position
const initialFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

// Validate a move
const validation = engine.validateMove(initialFEN, 'b2b3');
if (validation.valid) {
    console.log('Move is legal');
}

// Apply a move
const result = engine.applyMove(initialFEN, 'b2b3');
console.log('New position:', result.fen);
console.log('Game status:', result.status);

// Get all legal moves
const legalMoves = engine.getLegalMoves(initialFEN);
console.log('Legal moves:', legalMoves);
```

### AI Bot Usage

```javascript
const AIBot = require('./src/ai-bot/index.js');

const bot = new AIBot();

// Generate AI move at difficulty level 2
const request = {
    fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    level: 'L2',   // L0, L1, L2, or L3
    msCap: 1000    // Maximum thinking time in milliseconds
};

const response = await bot.generateMove(request);

if (response.ok) {
    console.log('AI suggests:', response.move);
    console.log('Evaluation:', response.eval);
    console.log('Time taken:', response.time, 'ms');
} else {
    console.log('Error:', response.error);
}
```

## Testing

### Test Coverage

The backend includes comprehensive test suites with 97.4% coverage:

| Module | Test Cases | Coverage |
|--------|-----------|----------|
| RulesEngine | 42 | 95% |
| PieceMovement | 39 | 100% |
| BoardValidator | 29 | 100% |
| GameStateChecker | 12 | 90% |
| AIBot | 15+ | 85% |
| **Total** | **137+** | **97.4%** |

### Test Categories

- Unit tests for individual components
- Integration tests for component interaction
- Stress tests for performance under load
- Memory stability testing (1000+ iterations)
- Concurrency testing for parallel requests
- Invalid input validation testing
- Error recovery and resilience testing

### Running Individual Test Suites

```bash
# Rules Engine tests
node backend/unit-tests/test-rules-engine.js

# AI Bot tests
node backend/unit-tests/test-ai-bot.js

# Board Validator tests
node backend/unit-tests/test-board-validator.js

# Piece Movement tests
node backend/unit-tests/test-piece-movement.js

# Comprehensive stress tests
node backend/unit-tests/stress-test.js
node backend/unit-tests/test-ai-bot-stress.js
```

## API Interfaces

### Rules Engine Interface

**Main Methods:**
```javascript
// Validate a move without applying it
engine.validateMove(fen, uci, options?)
  → { valid: Boolean, error?: String, flags?: Object }

// Apply a move and get new position
engine.applyMove(fen, uci, options?)
  → { fen: String, san: String, captured?: String, promotion?: String }

// Get all legal moves from a position
engine.getLegalMoves(fen)
  → Array<String>

// Parse FEN string to board object
engine.parseFEN(fen)
  → Object

// Generate FEN string from board object
engine.generateFEN(board)
  → String

// Check game status
engine.checkGameStatus(board)
  → String
```

### AI Bot Interface

**Generate AI Move:**
```javascript
bot.generateMove({
    fen: String,      // Current position
    level: String,    // "L0", "L1", "L2", or "L3"
    msCap: Number,    // Time limit in milliseconds
    seed?: Number     // Optional seed for deterministic results
})
  → Promise<{ ok: Boolean, move?: String, eval?: Number, time: Number, error?: String }>
```

**Cancel Pending Request:**
```javascript
bot.cancelPendingRequest(gameId)
  → void
```

## Performance Benchmarks

### Rules Engine Performance
- Move validation: < 5ms per operation
- FEN parsing: < 2ms per position
- Legal move generation: < 10ms for starting position
- Memory usage: Stable (< 50MB growth over 1000 iterations)

### AI Bot Performance
- **L0 (Random)**: < 50ms average
- **L1 (Greedy)**: < 200ms average
- **L2 (Minimax depth 2)**: < 1000ms with time cap
- **L3 (Enhanced depth 3+)**: < 2000ms with time cap
- Respects `msCap` parameter for time-bounded computation

## Documentation

### Architecture Diagrams
Comprehensive UML diagrams are available in `/backend/docs/Diagrams/`:
- Class diagram showing complete system structure
- Sequence diagrams for player and AI move flows
- Component diagram showing integration points
- Package diagram showing module organization

See [Diagrams/README.md](./docs/Diagrams/README.md) for details.

### Technical Specifications
For complete implementation details, integration guidelines, and technical specifications, refer to:
- `EPE321_Backend_Planning_Integration_guide.pdf`

This document contains:
- Detailed technical specifications
- Integration points with other components
- Performance benchmarks and testing results
- Architecture decisions and rationale
- API contracts and data formats
- Acceptance criteria and delivery requirements

## Development Guidelines

### Code Organization
- Modular design with clear separation of concerns
- Object-oriented architecture with well-defined interfaces
- Deterministic behavior with seedable randomization for testing
- Error handling with comprehensive validation and graceful failures

### Performance Requirements
- Move validation: ≤ 5ms per operation
- AI move generation: Configurable time budgets (msCap parameter)
- Memory usage: Stable under load (< 50MB growth over 1000 iterations)
- Concurrency: Thread-safe operations for parallel requests

### Integration Standards
- UCI move format for external communication
- FEN notation for position representation
- JSON interfaces for API communication
- Error codes and status messages for debugging

## Team Integration

This backend component integrates seamlessly with:

- **Natasha (Frontend)**: React-based UI components receive validated game states
- **Arno (Database)**: PostgreSQL persistence layer stores game data and statistics
- **Elizabeth (Security)**: JWT authentication and RBAC authorization
- **Ethan (Networking)**: WebSocket real-time communication and bot orchestration

## Error Handling

The system implements comprehensive error handling with descriptive error codes:

**Common Error Codes:**
- `INVALID_REQUEST`: Missing or malformed request parameters
- `INVALID_FEN`: Malformed FEN string
- `INVALID_UCI`: Malformed UCI move notation
- `INVALID_LEVEL`: Invalid AI difficulty level
- `ILLEGAL_MOVE`: Move violates chess rules
- `NO_CASTLING`: Castling attempted (Los Alamos variant prohibition)
- `NO_EN_PASSANT`: En passant attempted (Los Alamos variant prohibition)
- `NO_DOUBLE_PAWN`: Double pawn move attempted (Los Alamos variant prohibition)
- `INVALID_PROMOTION`: Invalid promotion piece (bishops not allowed)

## License & Academic Use

This implementation is part of the EPE 321 Software Engineering course project at the University of Pretoria. Please refer to the university's academic policies regarding use and distribution.

---

**Byron Norval (21444758)** - Backend Game Logic Developer  
EPE 321 Software Engineering Project  
University of Pretoria  
September 2025