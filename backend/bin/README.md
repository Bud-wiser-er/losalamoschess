# Chess Engine Binaries

This folder contains external chess engine executables required for the AI bot functionality.

## Fairy-Stockfish (Required for L4 - Expert Level Bot)

Fairy-Stockfish is a chess variant engine that supports Los Alamos 6×6 chess. It powers the L4 difficulty level, providing expert-strength gameplay with configurable ELO ratings.

### Why Fairy-Stockfish?

- LETS GOOOOO: **Native Los Alamos support** - Understands 6×6 board, no bishops, no castling, no en passant
- LETS GOOOOO: **ELO-based difficulty** - Adjustable strength from 1000-3000 ELO
- LETS GOOOOO: **Battle-tested** - Based on Stockfish, one of the strongest chess engines in the world
- LETS GOOOOO: **Large board support** - The "largeboard" version supports board sizes beyond standard 8×8

---

## Quick Setup (For Team Members)

### Step 1: Download Fairy-Stockfish

1. Go to: https://github.com/fairy-stockfish/Fairy-Stockfish/releases
2. Download the appropriate file for your OS:
   - **Windows:** `fairy-stockfish-largeboard_x86-64-bmi2.exe`
   - **Mac (Intel):** `fairy-stockfish-largeboard_x86-64-modern`
   - **Mac (Apple Silicon):** `fairy-stockfish-largeboard_arm64`
   - **Linux:** `fairy-stockfish-largeboard_x86-64-modern`

**IMPORTANT:** You MUST download the "largeboard" version for Los Alamos (6×6) support.

### Step 2: Install to Project

1. **Rename** the downloaded file to:
   - Windows: `fairy-stockfish.exe`
   - Mac/Linux: `fairy-stockfish`

2. **Place it** in this folder:
   ```
   losalamoschess/backend/bin/fairy-stockfish.exe  (Windows)
   losalamoschess/backend/bin/fairy-stockfish      (Mac/Linux)
   ```

3. **For Mac/Linux only** - Make it executable:
   ```bash
   chmod +x backend/bin/fairy-stockfish
   ```

### Step 3: Verify Installation

Run the verification test:
```bash
npm run test:byron:fairy-stockfish
```

**Expected output:**
```
LETS GOOOOO: ALL TESTS PASSED - Fairy-Stockfish is ready for integration!
```

---

## File Structure

```
backend/
├── bin/
│   ├── fairy-stockfish.exe    ← The engine binary (NOT in Git)
│   └── README.md               ← This file
├── src/
│   ├── ai-bot/
│   │   └── strategies/
│   │       └── L4Strategy.js   ← Uses this engine
│   └── unit-tests/
│       ├── test-fairy-stockfish.js
│       └── test-fairy-integration-stress.js
└── package.json
```

---

## Git Configuration

WARNING **The `fairy-stockfish.exe` file is NOT committed to Git.**

This is configured in `.gitignore`:
```
backend/bin/fairy-stockfish.exe
backend/bin/fairy-stockfish
```

**Why not commit it?**
- Binary executables are large (1-2 MB)
- Different OS need different binaries (Windows/Mac/Linux)
- Security - executables shouldn't be in repos
- Each developer downloads the version for their system

---

## Using L4 in Your Code

### Backend (Byron's AI Bot)

```javascript
const AIBot = require('./src/ai-bot/index');
const aiBot = new AIBot();

// Generate L4 move at ELO 1800
const response = await aiBot.generateMove({
    fen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
    level: 'L4',
    elo: 1800,
    msCap: 3000
});

console.log(response);
// { ok: true, move: 'd2d3', elo: 1800, evaluation: 0.15, depth: 12, nodes: 45000 }
```

### WebSocket (Ethan's Integration)

```javascript
// When client requests bot move
socket.on('botMoveRequest', async (data) => {
    const { fen, level, elo } = data;
    
    const botResponse = await aiBot.generateMove({
        fen: fen,
        level: level,
        elo: elo || 2000,  // Default to 2000 if not specified
        msCap: 3000
    });
    
    if (botResponse.ok) {
        socket.emit('botMove', {
            move: botResponse.move,
            evaluation: botResponse.evaluation,
            elo: botResponse.elo
        });
    }
});
```

### Frontend (Natasha's UI)

Add L4 to difficulty selector:
```javascript
const difficulties = [
    { value: 'L0', label: 'Beginner', description: 'Random moves' },
    { value: 'L1', label: 'Novice', description: 'Basic strategy' },
    { value: 'L2', label: 'Intermediate', description: 'Tactical play' },
    { value: 'L3', label: 'Advanced', description: 'Strategic depth' },
    { value: 'L4', label: 'Expert', description: 'Stockfish Engine', hasElo: true }
];

// When L4 is selected, show ELO slider (1000-3000)
```

---

## Troubleshooting

### Error: "Engine not found" or "ENOENT"

**Solution:** Verify the file exists at the correct path:
```bash
# Windows (in PowerShell)
Test-Path backend\bin\fairy-stockfish.exe

# Mac/Linux
ls -la backend/bin/fairy-stockfish
```

If missing, download it again from the releases page.

### Error: "Permission denied" (Mac/Linux)

**Solution:** Make the file executable:
```bash
chmod +x backend/bin/fairy-stockfish
```

### Error: "Variant not supported"

**Solution:** You downloaded the wrong version. Must use the **"largeboard"** variant:
- LETS GOOOOO: `fairy-stockfish-largeboard_x86-64-bmi2.exe`
- PROBLEM: `fairy-stockfish_x86-64-bmi2.exe` (wrong - no largeboard support)

### Windows Defender blocks the file

**Solution:** 
1. Click "More info"
2. Click "Run anyway"
3. Or add an exception in Windows Security

### Bot always uses random moves (fallback)

**Check:**
1. Engine path is correct
2. Engine file has correct permissions
3. Run `npm run test:byron:fairy-integration` to verify

---

## Performance Notes

- **L4 search time:** ~2 seconds per move (configurable)
- **Memory usage:** ~10MB for engine process
- **CPU usage:** High during search, idle otherwise
- **Startup time:** ~200ms first initialization

---

## For Developers

### Running Tests

```bash
# Basic engine test (8 tests)
npm run test:byron:fairy-stockfish

# Integration with rules engine (33 tests)
npm run test:byron:fairy-integration

# Full stress test (42 tests)
npm run test:byron:fairy-stockfish-stress

# L4 bot functionality (25 tests)
npm run test:byron:l4-bot
```

### Cleanup on Server Shutdown

**Important:** Always cleanup on shutdown to close the engine process:

```javascript
// In your server shutdown handler
process.on('SIGTERM', async () => {
    await aiBot.cleanup();
    process.exit(0);
});
```

---

## Resources

- **Fairy-Stockfish GitHub:** https://github.com/fairy-stockfish/Fairy-Stockfish
- **UCI Protocol Specification:** http://wbec-ridderkerk.nl/html/UCIProtocol.html
- **Los Alamos Chess Rules:** See project documentation

---

*Last Updated: September 26, 2025*
*Maintained by: Byron Norval (AI Bot Developer)*