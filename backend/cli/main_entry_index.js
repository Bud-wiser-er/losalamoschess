const RulesEngine = require('../src/engine/index');
// AI Bot will be implemented later
// const AIBot = require('./ai-bot');

/**
 * Main entry point for game logic components
 * This file demonstrates how to use the Rules Engine
 * AI Bot will be added in a future iteration
 */

// Initialize components
const rulesEngine = new RulesEngine();
// const aiBot = new AIBot(); // To be implemented

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
    
    // AI Bot demonstration (placeholder for future implementation)
    console.log('\n6. AI Bot (To be implemented):');
    console.log('AI bot with levels L0-L3 will be added in next iteration');
    
    /* Future AI implementation:
    const botRequest = {
        fen: initialFEN,
        level: 'L1',
        msCap: 1000
    };
    
    const botMove = await aiBot.generateMove(botRequest);
    console.log('AI L1 move:', botMove);
    */
}

// Export for use by other modules
module.exports = {
    RulesEngine,
    // AIBot will be exported when implemented
    
    // Convenience functions for integration
    validateMove: (fen, uci) => rulesEngine.validateMove(fen, uci),
    applyMove: (fen, uci) => rulesEngine.applyMove(fen, uci),
    getLegalMoves: (fen) => rulesEngine.getLegalMoves(fen),
    // generateBotMove will be added when AI is implemented
};

// Run demo if this file is executed directly
if (require.main === module) {
    demonstrateGameLogic().catch(console.error);
}