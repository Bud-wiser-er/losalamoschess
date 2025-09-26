/*
 * Author: Byron Norval
 * Student Number: 21444758
 * Last Modified: 26/09/2025
 * File: main_entry_index.js
 * 
 * Description: 
 * Main entry point and demonstration for Byron's game logic components.
 * Includes Rules Engine and AI Bot with all difficulty levels (L0-L3).
 * DO NOT USE THIS FOR INTERGRATION PEOPLE
 * DO NOT DO NOT DO NOT
 * 
 * Part of: EPE 321 Group Project - Los Alamos Chess Platform
 */

const RulesEngine = require('../src/engine/index');
const AIBot = require('../src/ai-bot/index');

/**
 * Main entry point for game logic components
 * Demonstrates how to use the Rules Engine and AI Bot
 **/

// Initialize components
const rulesEngine = new RulesEngine();
const aiBot = new AIBot();

// Example usage
async function demonstrateGameLogic() {
    console.log('Los Alamos Chess - Game Logic Demo');
    console.log('==================================');
    
    // Starting position
    const initialFEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
    console.log('Initial position:', initialFEN);
    
    // Test move validation
    console.log('\n1. Testing move validation:');
    const moveTest1 = rulesEngine.validateMove(initialFEN, 'b2b3');
    console.log('b2b3 (valid pawn move):', moveTest1);
    
    const moveTest2 = rulesEngine.validateMove(initialFEN, 'b2b4');
    console.log('b2b4 (invalid double pawn):', moveTest2);
    
    const moveTest3 = rulesEngine.validateMove(initialFEN, 'e1g1');
    console.log('e1g1 (invalid castling):', moveTest3);
    
    // Apply a valid move
    console.log('\n2. Applying move:');
    const newState = rulesEngine.applyMove(initialFEN, 'b2b3');
    console.log('After b2b3:', newState);
    
    // Get legal moves
    console.log('\n3. Legal moves from start:');
    const legalMoves = rulesEngine.getLegalMoves(initialFEN);
    console.log('Number of legal moves:', legalMoves.length);
    console.log('First few moves:', legalMoves.slice(0, 10));
    
    // Test a game sequence
    console.log('\n4. Testing game sequence:');
    let currentFEN = initialFEN;
    const moves = ['d2d3', 'd5d4', 'e2e3', 'e5e4'];
    
    for (const move of moves) {
        const validation = rulesEngine.validateMove(currentFEN, move);
        if (validation.valid) {
            const result = rulesEngine.applyMove(currentFEN, move);
            console.log(`Move ${move}: ${validation.valid ? 'Valid' : 'Invalid'}`);
            console.log(`  New FEN: ${result.fen}`);
            console.log(`  Status: ${result.status}${result.flags.check ? ' (Check)' : ''}`);
            currentFEN = result.fen;
        } else {
            console.log(`Move ${move}: Invalid - ${validation.error}`);
        }
    }
    
    // Test promotion
    console.log('\n5. Testing pawn promotion:');
    const promotionFEN = 'rnqkn1/P5/6/6/6/RNQKNR w - - 0 1';
    const promotionMove = rulesEngine.validateMove(promotionFEN, 'a5a6q');
    console.log('Promotion to queen:', promotionMove);
    
    if (promotionMove.valid) {
        const promoted = rulesEngine.applyMove(promotionFEN, 'a5a6q');
        console.log('After promotion:', promoted.fen);
    }
    
    // AI Bot demonstration
    console.log('\n6. AI Bot Testing:');
    console.log('Testing all difficulty levels...\n');
    
    const levels = ['L0', 'L1', 'L2', 'L3'];
    for (const level of levels) {
        console.log(`Testing ${level}:`);
        const botResponse = await aiBot.generateMove({
            fen: initialFEN,
            level: level,
            msCap: 1000
        });
        
        if (botResponse.ok) {
            console.log(`  Move: ${botResponse.move}`);
            console.log(`  Evaluation: ${botResponse.evaluation}`);
            console.log(`  Depth: ${botResponse.depth}`);
            console.log(`  Nodes: ${botResponse.nodes}`);
            console.log(`  Time: ${botResponse.timeMs}ms\n`);
        } else {
            console.log(`  Error: ${botResponse.error}`);
        }
    }
    
    // Demonstrate bot game
    console.log('\n7. Bot vs Bot Game (L1 vs L2):');
    currentFEN = initialFEN;
    let moveCount = 0;
    const maxMoves = 10;
    
    while (moveCount < maxMoves) {
        const botLevel = moveCount % 2 === 0 ? 'L1' : 'L2';
        const botMove = await aiBot.generateMove({
            fen: currentFEN,
            level: botLevel,
            msCap: 500
        });
        
        if (!botMove.ok) {
            console.log(`Game ended: ${botMove.error}`);
            break;
        }
        
        const result = rulesEngine.applyMove(currentFEN, botMove.move);
        console.log(`Move ${moveCount + 1} (${botLevel}): ${botMove.move} - ${result.status}`);
        
        if (result.status !== 'ONGOING') {
            console.log(`Game Over: ${result.status}`);
            break;
        }
        
        currentFEN = result.fen;
        moveCount++;
    }
}

// Export for use by other modules
module.exports = {
    RulesEngine,
    AIBot,
    
    // Convenience functions for integration
    validateMove: (fen, uci) => rulesEngine.validateMove(fen, uci),
    applyMove: (fen, uci) => rulesEngine.applyMove(fen, uci),
    getLegalMoves: (fen) => rulesEngine.getLegalMoves(fen),
    generateBotMove: (request) => aiBot.generateMove(request)
};

if (require.main === module) {
    demonstrateGameLogic().catch(console.error);
}