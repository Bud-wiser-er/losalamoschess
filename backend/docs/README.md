# Byron Architecture Diagrams

This folder contains comprehensive UML diagrams documenting Byron's Rules Engine and AI Bot implementation for the Los Alamos Chess project.

## Folder Structure

```
Diagrams/
├── out/                           # Exported SVG diagrams
│   ├── Byron_Architecture_Updated.svg
│   ├── Byron_Component_Architecture.svg
│   └── Error_Handling.svg
├── uml.puml                       # Main class diagram (PlantUML)
├── sequence_diagram.puml          # Interaction flows (PlantUML)
├── component_architecture.puml    # System architecture (PlantUML)
├── Backend Guide.pdf              # Development guidelines
├── EPE321_Backend_Planning_Integration_guide.pdf
└── README.md                      # This file
```

## Diagram Overview

### 1. **Byron_Architecture_Updated.svg**
**Source:** `uml.puml`

**Shows:**
- Complete class structure (RulesEngine, AIBot, Strategies)
- Strategy Pattern implementation (L0, L1, L2, L3)
- Helper classes (PieceMovement, BoardValidator, GameStateChecker, Evaluator)
- Data Transfer Objects (BotRequest, BotResponse, MoveValidation)
- All relationships (composition, inheritance, dependencies)

**Key Classes:**
- `RulesEngine` - Main rules validation and move application
- `AIBot` - AI opponent with 4 difficulty levels
- `IStrategy` - Strategy interface for different AI levels
- `Evaluator` - Position evaluation for AI

### 2. **Byron_Component_Architecture.svg**
**Source:** `component_architecture.puml`

**Shows:**
- Byron's integration with other system components
- Interface contracts with Frontend (Natasha), WebSocket (Ethan), Database (Arno)
- Data flow between components
- Module organization and dependencies

**Integration Points:**
- Rules API: `validateMove()`, `applyMove()`, `getLegalMoves()`
- Bot API: `generateMove()`, `cancelPendingRequest()`

### 3. **Error_Handling.svg**
**Source:** `sequence_diagram.puml`

**Shows:**
- Error handling flows for various scenarios
- Validation pipeline
- Error codes and responses

## How to Use These Diagrams

### For Documentation:
1. **Design Document** - Include class and component diagrams
2. **API Documentation** - Reference interface specifications
3. **Integration Guide** - Use component diagram for team coordination
4. **Presentations** - Export SVGs for slides

### For Development:
1. **Code Structure Reference** - See how classes relate
2. **Integration Planning** - Understand interface contracts
3. **Debugging** - Follow sequence diagrams for data flow

## Editing PlantUML Diagrams

### Prerequisites:
```bash
# Install PlantUML extension for VS Code
# Or use online editor: http://www.plantuml.com/plantuml/uml/
```

### Rendering Diagrams:

**Option 1: VS Code (Recommended)**
1. Install "PlantUML" extension
2. Open `.puml` file
3. Press `Alt+D` to preview
4. Right-click preview → Export to SVG/PNG

**Option 2: Command Line**
```bash
# Install PlantUML
npm install -g node-plantuml

# Generate SVG
puml generate -t svg uml.puml -o out/

# Generate PNG
puml generate -t png uml.puml -o out/
```

**Option 3: Online**
- Visit: http://www.plantuml.com/plantuml/uml/
- Paste PlantUML code
- Download rendered diagram

### Updating Diagrams:
1. Edit `.puml` source file
2. Re-render to SVG/PNG
3. Place output in `out/` folder
4. Commit both source and rendered files

## Key Implementation Details

### Byron's Architecture:

**Rules Engine Module:**
- Stateless, pure function design
- Validates Los Alamos variant rules
- Performance target: <5ms per move validation

**AI Bot Module:**
- Strategy Pattern for difficulty levels
- Async move generation
- Time-capped computation (msCap)
- Deterministic with seed support

**Los Alamos Variant Rules:**
- 6×6 board (files a-f, ranks 1-6)
- No bishops, no castling, no en passant
- Single pawn moves only
- Promotion to Q/R/N only

### Test Coverage:
- **Overall:** 97.4%
- RulesEngine: 95%
- PieceMovement: 100%
- BoardValidator: 100%
- GameStateChecker: 90%
- AIBot: 85%

## Related Documentation

- **Backend Guide.pdf** - Development standards and practices
- **Integration Guide** - EPE321_Backend_Planning_Integration_guide.pdf
- **Byron Source Code** - `/backend/src/engine/` and `/backend/src/ai-bot/`
- **Test Files** - `/backend/unit-tests/`

## Diagram Legend

### UML Notation:
- `*--` (Filled diamond) = Composition (owns/creates)
- `o--` (Hollow diamond) = Aggregation (has reference)
- `..>` (Dashed arrow) = Dependency (uses)
- `<|..` (Dashed arrow with triangle) = Interface implementation
- `<|--` (Solid arrow with triangle) = Inheritance

### Color Coding:
- **Light Blue** = Main classes (RulesEngine, AIBot)
- **Light Green** = Strategy classes (L0-L3)
- **Light Yellow** = Helper classes (Validators, Evaluator)

## Changes from Original Design

These diagrams reflect the **actual implementation**, not the original design document:

**Major Changes:**
1. AIBot is now a separate class (not part of RulesEngine)
2. Strategy Pattern implemented with 4 separate classes
3. New Evaluator class for position evaluation
4. AIBot creates its own RulesEngine (composition, not injection)
5. Methods return structured Objects instead of void
6. AIBot.generateMove() is async (returns Promise)

**New Methods Added:**
- `RulesEngine.getLegalMoves(fen)` - Returns all legal moves
- `RulesEngine.parseFEN(fen)` - Parses FEN to board object
- `RulesEngine.generateFEN(board)` - Converts board to FEN
- `AIBot.cancelPendingRequest(gameId)` - Cancel AI calculation

**New Classes:**
- `Evaluator` - Position evaluation
- `RandomStrategy` (L0) - Random moves
- `GreedyStrategy` (L1) - Greedy captures
- `MinimaxStrategy` (L2) - Minimax depth 2
- `EnhancedStrategy` (L3) - Enhanced minimax depth 3+

## Integration Contracts

### RulesEngine → WebSocket (Ethan)

**Input:**
```javascript
{
  fen: "rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1",
  uci: "e2e4",
  options?: {}
}
```

**Output:**
```javascript
{
  valid: true,
  flags: {
    check: false,
    checkmate: false,
    stalemate: false
  }
}
```

### AIBot → WebSocket (Ethan)

**Input (BotRequest):**
```javascript
{
  fen: "current-position",
  level: "L2",        // L0, L1, L2, or L3
  msCap: 1000,        // Max time in ms
  seed?: 42           // Optional for deterministic results
}
```

**Output (BotResponse):**
```javascript
{
  ok: true,
  move: "e7e5",       // UCI format
  eval: 0.3,          // Position evaluation
  time: 850           // Actual time taken
}
```

## Documentation Checklist

Use these diagrams for:

- [x] Software Requirements Specification (SRS)
- [x] Design Document
- [x] API Documentation
- [x] Integration Guide
- [x] Testing Report
- [x] Final Presentation
- [x] Code Review Sessions

## Support

**For questions about:**
- **Diagram structure** → See `uml.puml` with annotations
- **Integration points** → See `component_architecture.puml`
- **Data flows** → See `sequence_diagram.puml`
- **Implementation** → See `/backend/src/` source code

---

*Last Updated: Based on Byron implementation with 97.4% test coverage*  
*All diagrams reflect actual code structure in `/backend/src/`*