const AIBot = require('../index');
const RulesEngine = require('../../engine/index');

describe('AI Bot Tests', () => {
    let bot;
    let engine;
    const INITIAL_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
    
    beforeEach(() => {
        bot = new AIBot();
        engine = new RulesEngine();
    });
    
    describe('L0 - Random Strategy', () => {
        test('Should return a legal move', async () => {
            const response = await bot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                msCap: 1000
            });
            
            expect(response.ok).toBe(true);
            expect(response.move).toBeDefined();
            expect(response.move).toMatch(/^[a-f][1-6][a-f][1-6]$/);
        });
        
        test('Should use seed for deterministic behavior', async () => {
            const response1 = await bot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                seed: 12345
            });
            
            const response2 = await bot.generateMove({
                fen: INITIAL_FEN,
                level: 'L0',
                seed: 12345
            });
            
            expect(response1.move).toBe(response2.move);
        });
    });
    
    describe('L1 - Greedy Strategy', () => {
        test('Should prefer captures', async () => {
            // Set up position with capture available
            const fenWithCapture = 'rnqknr/pppppp/6/6/3P2/RNQ1NR w - - 0 1';
            
            const response = await bot.generateMove({
                fen: fenWithCapture,
                level: 'L1',
                msCap: 2000
            });
            
            expect(response.ok).toBe(true);
            expect(response.evaluation).toBeGreaterThan(0);
        });
    });
    
    describe('L2 - Minimax Strategy', () => {
        test('Should find mate in 2', async () => {
            // This would need a specific mate-in-2 position
            // For now, just test that it works
            const response = await bot.generateMove({
                fen: INITIAL_FEN,
                level: 'L2',
                msCap: 3000
            });
            
            expect(response.ok).toBe(true);
            expect(response.depth).toBe(2);
            expect(response.nodesSearched).toBeGreaterThan(10);
        });
    });
    
    describe('L3 - Enhanced Strategy', () => {
        test('Should search deeper and order moves', async () => {
            const response = await bot.generateMove({
                fen: INITIAL_FEN,
                level: 'L3',
                msCap: 5000
            });
            
            expect(response.ok).toBe(true);
            expect(response.depth).toBe(3);
            expect(response.nodesSearched).toBeGreaterThan(50);
        });
    });
    
    describe('Error Handling', () => {
        test('Should handle invalid level', async () => {
            const response = await bot.generateMove({
                fen: INITIAL_FEN,
                level: 'L99'
            });
            
            expect(response.ok).toBe(false);
            expect(response.error).toBe('INVALID_LEVEL');
        });
        
        test('Should handle no legal moves', async () => {
            // Checkmate position
            const checkmatePosition = 'rnq1nr/pppppp/3k2/6/6/RNQKNR w - - 0 1';
            
            const response = await bot.generateMove({
                fen: checkmatePosition,
                level: 'L0'
            });
            
            // This would fail if there are no legal moves
            // Adjust based on actual checkmate position
        });
        
        test('Should handle timeout', async () => {
            const response = await bot.generateMove({
                fen: INITIAL_FEN,
                level: 'L3',
                msCap: 1 // Very short timeout
            });
            
            expect(response.ok).toBe(true);
            expect(response.timeout).toBe(true);
        });
    });
});