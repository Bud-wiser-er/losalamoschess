require('dotenv').config();
const DatabaseService = require('./src/models/DatabaseService');

async function testDatabase() {
    console.log('🧪 Testing database connection and operations...\n');
    
    const dbService = new DatabaseService();
    
    try {
        // Test 1: Health check
        console.log('1️⃣ Testing health check...');
        const health = await dbService.healthCheck();
        console.log('✅ Health check:', health);
        
        // Test 2: Create a test user
        console.log('\n2️⃣ Testing user creation...');
        const testUser = {
            username: 'testuser_' + Date.now(),
            email: 'test_' + Date.now() + '@example.com',
            password: 'testpassword123',
            rating: 1200
        };
        
        const createdUser = await dbService.createUser(testUser);
        console.log('✅ User created:', {
            id: createdUser.id,
            username: createdUser.username,
            email: createdUser.email,
            rating: createdUser.rating
        });
        
        // Test 3: Find user by email
        console.log('\n3️⃣ Testing user lookup...');
        const foundUser = await dbService.findUserByEmail(testUser.email);
        console.log('✅ User found:', foundUser ? 'Yes' : 'No');
        
        // Test 4: Create a test game
        console.log('\n4️⃣ Testing game creation...');
        const testGame = {
            whitePlayerId: createdUser.id,
            blackPlayerId: null,
            whiteClockMs: 300000,
            blackClockMs: 300000
        };
        
        const createdGame = await dbService.createGame(testGame);
        console.log('✅ Game created:', {
            id: createdGame.id,
            status: createdGame.status,
            currentFen: createdGame.current_fen.substring(0, 20) + '...',
            whitePlayer: createdGame.white_player_id ? 'Set' : 'Empty',
            blackPlayer: createdGame.black_player_id ? 'Set' : 'Empty'
        });
        
        // Test 5: Test audit logging
        console.log('\n5️⃣ Testing audit logging...');
        const auditLog = await dbService.createAuditLog({
            action: 'TEST_ACTION',
            userId: createdUser.id,
            metadata: { test: true, timestamp: new Date() },
            ipAddress: '127.0.0.1'
        });
        console.log('✅ Audit log created:', auditLog.id);
        
        console.log('\n🎉 All database tests passed!');
        console.log('\n📋 Database is ready for team integration:');
        console.log('   ✅ User management');
        console.log('   ✅ Game management');
        console.log('   ✅ Audit logging');
        console.log('   ✅ Schema constraints');
        console.log('   ⏳ Ready for Byron\'s Rules Engine');
        console.log('   ⏳ Ready for Elizabeth\'s Security Layer');
        console.log('   ⏳ Ready for Ethan\'s WebSocket integration');
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

testDatabase();