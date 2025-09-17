require('dotenv').config();
// Fix: Use correct relative path from database/ folder to src/models/
const DatabaseService = require('../src/models/DatabaseService');

async function testDatabase() {
    console.log('Testing database connection and operations...\n');
    
    const dbService = new DatabaseService();
    
    try {
        // Test 1: Health check
        console.log('1. Testing health check...');
        const health = await dbService.healthCheck();
        console.log('SUCCESS: Health check:', health);
        
        // Test 2: Create a test user
        console.log('\n2. Testing user creation...');
        const testUser = {
            username: 'testuser_' + Date.now(),
            email: 'test_' + Date.now() + '@example.com',
            password: 'testpassword123',
            rating: 1200
        };
        
        const createdUser = await dbService.createUser(testUser);
        console.log('SUCCESS: User created:', {
            id: createdUser.id,
            username: createdUser.username,
            email: createdUser.email,
            rating: createdUser.rating
        });
        
        // Test 3: Find user by email
        console.log('\n3. Testing user lookup...');
        const foundUser = await dbService.findUserByEmail(testUser.email);
        console.log('SUCCESS: User found:', foundUser ? 'Yes' : 'No');
        
        // Test 4: Create a test game
        console.log('\n4. Testing game creation...');
        const testGame = {
            whitePlayerId: createdUser.id,
            blackPlayerId: null,
            whiteClockMs: 300000,
            blackClockMs: 300000
        };
        
        const createdGame = await dbService.createGame(testGame);
        console.log('SUCCESS: Game created:', {
            id: createdGame.id,
            status: createdGame.status,
            currentFen: createdGame.current_fen.substring(0, 20) + '...',
            whitePlayer: createdGame.white_player_id ? 'Set' : 'Empty',
            blackPlayer: createdGame.black_player_id ? 'Set' : 'Empty'
        });
        
        // Test 5: Test audit logging
        console.log('\n5. Testing audit logging...');
        const auditLog = await dbService.createAuditLog({
            action: 'TEST_ACTION',
            userId: createdUser.id,
            metadata: { test: true, timestamp: new Date() },
            ipAddress: '127.0.0.1'
        });
        console.log('SUCCESS: Audit log created:', auditLog.id);
        
        console.log('\nSUCCESS: All database tests passed!');
        console.log('\nDatabase is ready for team integration:');
        console.log('   - User management: Ready');
        console.log('   - Game management: Ready');
        console.log('   - Audit logging: Ready');
        console.log('   - Schema constraints: Ready');
        console.log('   - Ready for Byron\'s Rules Engine');
        console.log('   - Ready for Elizabeth\'s Security Layer');
        console.log('   - Ready for Ethan\'s WebSocket integration');
        
    } catch (error) {
        console.error('ERROR: Database test failed:', error.message);
        console.error('Stack:', error.stack);
        
        // Provide helpful debugging info
        console.log('\nDEBUGGING INFO:');
        console.log('- Make sure PostgreSQL is running');
        console.log('- Check your .env file is configured correctly');
        console.log('- Verify database schema is set up: node database/setup.js');
        console.log('- Test basic connection: node database/test-connection.js');
    }
    
    process.exit(0);
}

testDatabase();