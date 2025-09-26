# Byron - Source Code Documentation

## Overview

This directory contains the core implementation of Byron's Rules Engine and AI Bot for the Los Alamos Chess project. The code is organized into three main modules: the chess rules engine, the AI bot system, and command-line utilities.

## Directory Structure

```
src/
├── engine/              # Rules Engine - Core game logic
│   ├── index.js                # Main RulesEngine class (entry point)
│   ├── board-validator.js      # FEN/UCI/board validation
│   ├── constants.js            # Los Alamos variant constants
│   ├── game-state-checker.js   # Check/checkmate/stalemate detection
│   └── piece-movement.js       # Piece-specific move validation
│
├── ai-bot/              # AI Bot - Difficulty levels L0-L3
│   ├── index.js                # Main AIBot class (entry point)
│   ├── evaluator.js            # Position evaluation functions
│   └── strategies/             # Strategy pattern implementation
│       ├── random.js           # L0: Random move selection
│       ├── greedy.js           # L1: Greedy captures
│       ├── minimax.js          # L2: Minimax depth 2
│       └── enhanced.js         # L3: Enhanced minimax depth 3+
│
└── cli/                 # Command-line interface
    └── main_entry_index.js     # Demo and module exports
```

## Module Descriptions

### Rules Engine (`engine/`)

The Rules Engine implements all Los Alamos Chess variant rules and provides move validation, game state management, and position manipulation.

#### `index.js` - RulesEngine (Main Entry Point)
**Purpose:** Central orchestrator for all game logic operations

**Key Methods:**
```javascript
validateMove(fen, uci, options?)    // Validate move legality
applyMove(fen, uci, options?)       // Apply move and return new state
getLegalMoves(fen)                  // Generate all legal moves
parseFEN(fen)                       // Parse FEN to board object
generateFEN(board)                  // Convert board to FEN string
checkGameStatus(board)              // Determine game state
```

**Architecture:**
- Stateless design (no internal game state)
- Pure functions for predictable behavior
- Delegates to specialized modules

#### `board-validator.js` - BoardValidator
**Purpose:** Input validation and format checking

**Key Methods:**
```javascript
isValidFEN(fen)                     // Validate FEN format
isValidUCI(uci)                     // Validate UCI move notation
isValidSquare(square)               // Check square coordinates (a1-f6)
isValidPromotion(piece)             // Validate promotion piece (q/r/n only)
validateBoardDimensions(board)      // Ensure 6×6 board
```

**Validates:**
- FEN string format for 6×6 Los Alamos boards
- UCI move notation (e.g., "e2e4", "a5a6q")
- Square coordinates within a-f, 1-6 range
- Los Alamos variant constraints

#### `constants.js` - Constants
**Purpose:** Single source of truth for game rules

**Exports:**
```javascript
VARIANT_RULES: {
    NO_BISHOPS: true,
    NO_CASTLING: true,
    NO_EN_PASSANT: true,
    NO_DOUBLE_PAWN_MOVE: true,
    PROMOTION_PIECES: ['q', 'r', 'n']
}

PIECE_VALUES: {
    'p': 1, 'n': 3, 'r': 5, 'q': 9, 'k': 0
}

BOARD_SIZE: 6
FILES: ['a', 'b', 'c', 'd', 'e', 'f']
RANKS: ['1', '2', '3', '4', '5', '6']
INITIAL_FEN: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1'
```

#### `game-state-checker.js` - GameStateChecker
**Purpose:** Detect check, checkmate, and stalemate conditions

**Key Methods:**
```javascript
isInCheck(board, color)             // Check if king is in check
isCheckmate(board)                  // Detect checkmate
isStalemate(board)                  // Detect stalemate
hasLegalMoves(board, color)         // Check for any legal moves
canKingEscape(board, color)         // Determine if king can move to safety
```

**Functionality:**
- King safety analysis
- Game termination detection
- Legal move existence checking

#### `piece-movement.js` - PieceMovement
**Purpose:** Piece-specific movement validation

**Key Methods:**
```javascript
isValidPawnMove(board, from, to, piece)      // Single square only (Los Alamos)
isValidKnightMove(board, from, to)           // L-shaped moves
isValidRookMove(board, from, to)             // Straight lines
isValidQueenMove(board, from, to)            // Rook + Bishop moves
isValidKingMove(board, from, to)             // Single square any direction
canPieceAttackSquare(board, piece, square)   // Attack validation
```

**Implements:**
- Los Alamos pawn movement (single square only)
- Standard knight, rook, queen, king movement
- Capture validation
- Path obstruction checking

### AI Bot (`ai-bot/`)

The AI Bot implements four difficulty levels using the Strategy Pattern, with progressive intelligence from random moves to advanced minimax search.

#### `index.js` - AIBot (Main Entry Point)
**Purpose:** AI opponent orchestration and move generation

**Key Methods:**
```javascript
generateMove(request)               // Async move generation
cancelPendingRequest(gameId)        // Cancel ongoing computation
```

**Request Format:**
```javascript
{
    fen: String,        // Current position
    level: String,      // "L0", "L1", "L2", or "L3"
    msCap: Number,      // Time limit in milliseconds
    seed?: Number       // Optional for deterministic results
}
```

**Response Format:**
```javascript
{
    ok: Boolean,        // Success status
    move?: String,      // UCI move (if successful)
    eval?: Number,      // Position evaluation
    time: Number,       // Computation time in ms
    error?: String      // Error message (if failed)
}
```

**Architecture:**
- Creates own RulesEngine instance (composition)
- Manages strategy selection
- Enforces time limits (msCap)

#### `evaluator.js` - Evaluator
**Purpose:** Position evaluation for AI decision-making

**Key Methods:**
```javascript
evaluatePosition(fen)               // Evaluate from FEN
getMaterialScore(board)             // Count material value
getPositionalScore(board)           // Positional bonuses
evaluateBoard(board, color)         // Complete evaluation
```

**Evaluation Factors:**
- Material counting (piece values)
- Positional bonuses
- King safety
- Mobility considerations

#### Strategy Pattern (`strategies/`)

Each strategy implements the same interface but with different intelligence levels:

**Interface:**
```javascript
findBestMove(fen, msCap, seed?)     // Returns { move, eval }
```

##### `random.js` - L0: Random Strategy
**Difficulty:** Beginner  
**Algorithm:** Random legal move selection  
**Performance:** < 50ms average  
**Use Case:** Teaching absolute beginners

```javascript
// Pseudocode
function findBestMove(fen) {
    legalMoves = getLegalMoves(fen)
    return random(legalMoves)
}
```

##### `greedy.js` - L1: Greedy Strategy
**Difficulty:** Novice  
**Algorithm:** Single-ply greedy evaluation (captures prioritized)  
**Performance:** < 200ms average  
**Use Case:** Players learning tactics

```javascript
// Pseudocode
function findBestMove(fen) {
    legalMoves = getLegalMoves(fen)
    bestMove = null
    bestScore = -Infinity
    
    for each move in legalMoves {
        newPosition = applyMove(fen, move)
        score = evaluatePosition(newPosition)
        if (score > bestScore) {
            bestScore = score
            bestMove = move
        }
    }
    return bestMove
}
```

##### `minimax.js` - L2: Minimax Strategy
**Difficulty:** Intermediate  
**Algorithm:** Minimax with alpha-beta pruning (depth 2)  
**Performance:** < 1000ms with time cap  
**Use Case:** Competitive casual play

```javascript
// Pseudocode
function minimax(position, depth, alpha, beta, maximizing) {
    if (depth == 0) return evaluate(position)
    
    legalMoves = getLegalMoves(position)
    
    if (maximizing) {
        maxEval = -Infinity
        for each move in legalMoves {
            eval = minimax(applyMove(position, move), depth-1, alpha, beta, false)
            maxEval = max(maxEval, eval)
            alpha = max(alpha, eval)
            if (beta <= alpha) break  // Alpha-beta pruning
        }
        return maxEval
    } else {
        // Similar for minimizing
    }
}
```

##### `enhanced.js` - L3: Enhanced Strategy
**Difficulty:** Advanced  
**Algorithm:** Enhanced minimax (depth 3+) with transposition tables  
**Performance:** < 2000ms with time cap  
**Use Case:** Strong opposition for experienced players

**Enhancements:**
- Deeper search (3+ ply)
- Transposition table caching
- Check bonus weighting
- Improved evaluation function

### CLI (`cli/`)

#### `main_entry_index.js` - Main Entry Point
**Purpose:** Module exports and demonstration

**Exports:**
```javascript
module.exports = {
    RulesEngine,
    AIBot,
    
    // Convenience functions
    validateMove: (fen, uci) => rulesEngine.validateMove(fen, uci),
    applyMove: (fen, uci) => rulesEngine.applyMove(fen, uci),
    getLegalMoves: (fen) => rulesEngine.getLegalMoves(fen)
}
```

**Usage:**
```bash
# Run demo
node src/cli/main_entry_index.js
```

## Usage Examples

### Rules Engine

```javascript
const RulesEngine = require('./engine/index');

const engine = new RulesEngine();
const startFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

// Validate move
const validation = engine.validateMove(startFEN, 'e2e4');
console.log(validation);
// { valid: true, flags: { check: false, checkmate: false, stalemate: false } }

// Apply move
const result = engine.applyMove(startFEN, 'e2e4');
console.log(result.fen);
// New position FEN string

// Get legal moves
const moves = engine.getLegalMoves(startFEN);
console.log(moves);
// ['a2a3', 'b2b3', 'c2c3', ...]
```

### AI Bot

```javascript
const AIBot = require('./ai-bot/index');

const bot = new AIBot();

// Generate L2 move
const response = await bot.generateMove({
    fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    level: 'L2',
    msCap: 1000
});

console.log(response);
// { ok: true, move: 'e2e4', eval: 0.1, time: 450 }
```

## Design Patterns

### Strategy Pattern (AI Bot)
- **Interface:** `IStrategy.findBestMove()`
- **Concrete Strategies:** L0, L1, L2, L3
- **Context:** AIBot class selects strategy based on level

### Facade Pattern (RulesEngine)
- **Facade:** RulesEngine class
- **Subsystems:** PieceMovement, BoardValidator, GameStateChecker
- **Benefit:** Simple interface for complex game logic

### Composition (AIBot)
- AIBot creates and owns RulesEngine instance
- Each strategy creates and owns Evaluator instance
- Promotes loose coupling and testability

## Performance Considerations

### Rules Engine
- **Target:** < 5ms per move validation
- **Optimization:** Early validation failures
- **Memory:** Stateless design prevents memory leaks

### AI Bot
- **Time Limits:** Enforced via msCap parameter
- **Optimization:** Alpha-beta pruning reduces search space
- **Caching:** L3 uses transposition tables

## Error Handling

All modules return structured error responses:

```javascript
{
    ok: false,
    error: 'ERROR_CODE',
    details: 'Human-readable description'
}
```

**Common Error Codes:**
- `INVALID_FEN`: Malformed FEN string
- `INVALID_UCI`: Malformed UCI notation
- `ILLEGAL_MOVE`: Move violates rules
- `INVALID_LEVEL`: Unknown difficulty level
- `NO_CASTLING`: Castling attempted (prohibited in Los Alamos)
- `NO_EN_PASSANT`: En passant attempted (prohibited)
- `NO_DOUBLE_PAWN`: Double pawn move attempted (prohibited)

## Testing

Each module has corresponding test files in `/backend/unit-tests/`:

```
test-rules-engine.js        → engine/index.js
test-piece-movement.js      → engine/piece-movement.js
test-board-validator.js     → engine/board-validator.js
test-ai-bot.js              → ai-bot/index.js
test-ai-bot-stress.js       → ai-bot/ (performance)
```

**Coverage:**
- RulesEngine: 95%
- PieceMovement: 100%
- BoardValidator: 100%
- GameStateChecker: 90%
- AIBot: 85%

## Integration Points

### With WebSocket Server (Ethan)
```javascript
// WebSocket calls Rules Engine
const validation = rulesEngine.validateMove(currentFEN, move);
if (validation.valid) {
    const newState = rulesEngine.applyMove(currentFEN, move);
    // Broadcast to clients
}

// WebSocket calls AI Bot
const aiMove = await aiBot.generateMove({
    fen: currentFEN,
    level: 'L2',
    msCap: 1000
});
```

### With Database (Arno)
```javascript
// After move validation
const result = rulesEngine.applyMove(fen, move);
database.saveMove({
    gameId: gameId,
    move: move,
    fen: result.fen,
    timestamp: Date.now()
});
```

### With Frontend (Natasha)
```javascript
// Frontend receives via WebSocket
{
    type: 'BOARD_STATE',
    fen: result.fen,
    legalMoves: rulesEngine.getLegalMoves(result.fen),
    status: result.status
}
```

## Los Alamos Variant Implementation

This implementation strictly follows Los Alamos Chess rules:

**Board:**
- 6×6 grid (files a-f, ranks 1-6)
- No bishops in starting position

**Movement Rules:**
- Pawns: Single square forward only (no double move)
- No castling permitted
- No en passant captures
- Promotion: Queen, Rook, or Knight only

**Initial Position:**
```
rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1
```

## Development Guidelines

### Adding New Features

1. **New piece validation:** Add method to `piece-movement.js`
2. **New game rule:** Update `constants.js` and `board-validator.js`
3. **New AI strategy:** Create class in `strategies/` implementing `findBestMove()`
4. **New evaluation factor:** Extend `evaluator.js`

### Code Standards

- Use clear, descriptive variable names
- Add JSDoc comments for public methods
- Return structured objects (not primitives)
- Handle errors gracefully (no exceptions)
- Write tests for new functionality

### Performance Targets

- Move validation: < 5ms
- Legal move generation: < 10ms
- AI L0: < 50ms
- AI L1: < 200ms
- AI L2: < 1000ms (with cap)
- AI L3: < 2000ms (with cap)

## Related Documentation

- **Architecture Diagrams:** `/backend/docs/Diagrams/README.md`
- **Integration Guide:** `/backend/docs/EPE321_Backend_Planning_Integration_guide.pdf`
- **Main Backend README:** `/backend/README.md`
- **Test Documentation:** `/backend/unit-tests/`

---

**Byron Norval (21444758)** - Backend Game Logic Developer  
EPE 321 Software Engineering Project  
University of Pretoria  
September 2025