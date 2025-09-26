# Chess Engine Binaries

This folder contains external chess engine executables required for the AI bot functionality.

## Fairy-Stockfish (Required for L4 - Expert Level Bot)

Fairy-Stockfish is a chess variant engine that supports Los Alamos 6×6 chess. It powers the L4 difficulty level, providing expert-strength gameplay with configurable ELO ratings.

### Why Fairy-Stockfish?

-  **Native Los Alamos support** - Understands 6×6 board, no bishops, no castling, no en passant
-  **ELO-based difficulty** - Adjustable strength from 1000-3000 ELO
-  **Battle-tested** - Based on Stockfish, one of the strongest chess engines in the world
-  **Large board support** - The "largeboard" version supports board sizes beyond standard 8×8

---

## Setup Instructions

### Step 1: Download Fairy-Stockfish

1. **Go to the releases page:**
   ```
   https://github.com/fairy-stockfish/Fairy-Stockfish/releases
   ```

2. **Download the Windows executable** (for Windows):
   - Look for: `fairy-stockfish-largeboard_x86-64-bmi2.exe`
   - **Important:** You MUST use the "largeboard" version for Los Alamos (6×6) support
   - The "bmi2" version is optimized for modern processors

3. **For other operating systems:**
   - Mac (Intel): `fairy-stockfish-largeboard_x86-64-modern`
   - Mac (Apple Silicon M1/M2/M3): `fairy-stockfish-largeboard_arm64`
   - Linux: `fairy-stockfish-largeboard_x86-64-modern`

### Step 2: Install to Project

1. **Rename the downloaded file** to:
   ```
   fairy-stockfish.exe  (Windows)
   fairy-stockfish      (Mac/Linux)
   ```

2. **Place it in this folder:**
   ```
   losalamoschess/backend/bin/fairy-stockfish.exe
   ```

3. **For Mac/Linux, make it executable:**
   ```bash
   chmod +x backend/bin/fairy-stockfish
   ```

### Step 3: Verify Installation

Run the test suite:

```bash
npm run test:byron:fairy-stockfish
```

**Expected output:**
```
ALL TESTS PASSED - Fairy-Stockfish is ready for integration!
```

---

## File Structure

```
backend/
├── bin/
│   ├── fairy-stockfish.exe    ← The engine binary (NOT committed to Git)
│   └── README.md               ← This file
├── src/
│   ├── ai-bot/
│   │   └── strategies/
│   │       └── L4Strategy.js   ← Uses this engine
│   └── unit-tests/
│       └── test-fairy-stockfish.js
└── package.json
```

---

## Git Configuration

⚠️ **Important:** The `fairy-stockfish.exe` file should **NOT** be committed to the repository.

This is already configured in `.gitignore`:
```
backend/bin/fairy-stockfish.exe
backend/bin/fairy-stockfish
```

**Why?**
- Binary executables are large (1-2 MB)
- Different team members may use different OS (Windows/Mac/Linux)
- Each developer should download the appropriate version for their system

---

## Troubleshooting

### ❌ Error: "Engine not found" or "ENOENT"

**Solution:** Verify the file exists at the correct path:
```bash
# Windows (in PowerShell)
Test-Path backend\bin\fairy-stockfish.exe

# Mac/Linux
ls -la backend/bin/fairy-stockfish
```

### ❌ Error: "Permission denied" (Mac/Linux)

**Solution:** Make the file executable:
```bash
chmod +x backend/bin/fairy-stockfish
```

### ❌ Error: "Variant not supported"

**Solution:** You downloaded the wrong version. Must use the **"largeboard"** variant:
- ✅ `fairy-stockfish-largeboard_x86-64-bmi2.exe`
- ❌ `fairy-stockfish_x86-64-bmi2.exe` (wrong - no largeboard support)

### ❌ Windows Defender blocks the file

**Solution:** 
1. Click "More info"
2. Click "Run anyway"
3. Or add an exception in Windows Security

---

## How It Works

The L4 bot strategy (`backend/src/ai-bot/strategies/L4Strategy.js`) communicates with Fairy-Stockfish using the UCI (Universal Chess Interface) protocol:

1. **Initialize engine** with Los Alamos variant
2. **Set ELO strength** (1000-3000)
3. **Send position** in FEN format
4. **Request best move** with time/depth limits
5. **Receive move** in UCI format (e.g., "d2d3")

The engine runs as a separate process and communicates via stdin/stdout.

---

## Resources

- **Fairy-Stockfish GitHub:** https://github.com/fairy-stockfish/Fairy-Stockfish
- **UCI Protocol Specification:** http://wbec-ridderkerk.nl/html/UCIProtocol.html
- **Los Alamos Chess Rules:** See project documentation

---

## Team Notes

**For Byron (AI Developer):**
- L4Strategy.js handles all UCI communication
- Engine path is relative: `path.join(__dirname, '..', 'bin', 'fairy-stockfish.exe')`
- Always validate moves against our rules engine before applying

**For Ethan (Backend Networking):**
- Bot moves are async - handle with proper timeout limits
- Engine must be initialized once, reused for all games
- Graceful shutdown: call `engine.quit()` on server stop

**For New Team Members:**
- Download the engine as part of setup
- Run `npm run test:byron:fairy-stockfish` to verify
- Engine is optional for frontend/database work

---

*Last Updated: September 2025*
*Maintained by: Byron Norval (AI Bot Developer)*