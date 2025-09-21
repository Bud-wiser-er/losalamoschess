// AI Bot Diagnostic Test
// backend/unit-tests/debug-ai-bot.js

const RulesEngine = require('../src/engine/index');

console.log('='.repeat(60));
console.log('AI BOT DIAGNOSTIC TEST');
console.log('='.repeat(60));

const INITIAL_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

// Test 1: Load AI Bot
console.log('\n1. LOADING AI BOT');
console.log('-'.repeat(40));

let AIBot, aiBot;
try {
    AIBot = require('../src/ai-bot/index');
    console.log('Yeah baby:AI Bot class loaded');
    
    aiBot = new AIBot();
    console.log('Yeah baby:AI Bot instance created');
    console.log('Strategies available:', Object.keys(aiBot.strategies));
} catch (error) {
    console.log('WRONG ( FIX IT)Failed to load AI Bot:', error.message);
    console.log('Stack:', error.stack);
    process.exit(1);
}

// Test 2: Test individual strategy loading
console.log('\n2. TESTING STRATEGY LOADING');
console.log('-'.repeat(40));

const strategyTests = [
    { name: 'L0', file: '../src/ai-bot/strategies/random' },
    { name: 'L1', file: '../src/ai-bot/strategies/greedy' },
    { name: 'L2', file: '../src/ai-bot/strategies/minimax' },
    { name: 'L3', file: '../src/ai-bot/strategies/enhanced' }
];

for (const test of strategyTests) {
    try {
        const Strategy = require(test.file);
        const strategy = new Strategy(new RulesEngine());
        console.log(`Yeah baby:${test.name} strategy loaded`);
        
        // Test if strategy has required methods
        if (typeof strategy.findBestMove === 'function') {
            console.log(`  Yeah baby:${test.name} has findBestMove method`);
        } else {
            console.log(`  WRONG ( FIX IT)${test.name} missing findBestMove method`);
        }
    } catch (error) {
        console.log(`WRONG ( FIX IT)${test.name} strategy failed:`, error.message);
    }
}

// Test 3: Test evaluator
console.log('\n3. TESTING EVALUATOR');
console.log('-'.repeat(40));

try {
    const Evaluator = require('../src/ai-bot/evaluator');
    const evaluator = new Evaluator();
    console.log('Yeah baby:Evaluator loaded');
    
    const evaluation = evaluator.evaluatePosition(INITIAL_FEN);
    console.log('Yeah baby:Evaluator works, result:', evaluation);
} catch (error) {
    console.log('WRONG ( FIX IT)Evaluator failed:', error.message);
}

// Test 4: Simple AI Bot call
console.log('\n4. TESTING SIMPLE AI BOT CALL');
console.log('-'.repeat(40));

async function testAIBot() {
    try {
        console.log('Testing L0 (Random) strategy...');
        const result = await aiBot.generateMove({
            fen: INITIAL_FEN,
            level: 'L0',
            msCap: 1000
        });
        
        console.log('L0 Result:', result);
        
        if (result.ok) {
            console.log('Yeah baby:L0 strategy works');
        } else {
            console.log('WRONG ( FIX IT)L0 strategy failed:', result.error);
        }
        
    } catch (error) {
        console.log('WRONG ( FIX IT)AI Bot call failed:', error.message);
        console.log('Stack:', error.stack);
    }
}

// Test 5: Rules Engine integration
console.log('\n5. TESTING RULES ENGINE INTEGRATION');
console.log('-'.repeat(40));

try {
    const engine = new RulesEngine();
    const legalMoves = engine.getLegalMoves(INITIAL_FEN);
    console.log('Yeah baby:Rules Engine works');
    console.log('Legal moves count:', legalMoves.length);
    console.log('Sample moves:', legalMoves.slice(0, 3));
} catch (error) {
    console.log('WRONG ( FIX IT)Rules Engine failed:', error.message);
}

// Run the async test
testAIBot().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(60));
}).catch(console.error);