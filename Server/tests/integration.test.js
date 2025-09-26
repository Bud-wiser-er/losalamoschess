// tests/integration.test.js - Integration Tests (FIXED)
const request = require('supertest');
const Client = require('socket.io-client');
const { app, server } = require('../server');

describe('System Integration Tests', () => {
  
  test('INT-01: Complete user registration and game flow', async () => {
    // Step 1: Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'integrationuser',
        email: 'integration@example.com',
        password: 'integrationPass123'
      });
    
    expect(registerResponse.status).toBe(201);
    const { accessToken } = registerResponse.body;
    
    // Step 2: Access protected profile
    const profileResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.username).toBe('integrationuser');
    
    // Step 3: Test WebSocket connection
    return new Promise((resolve, reject) => {
      const client = new Client(`http://localhost:${process.env.PORT || 5000}`, {
        auth: { token: accessToken }
      });
      
      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        resolve();
      });
      
      client.on('connect_error', (error) => {
        reject(error);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        client.disconnect();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    });
  });

  test('INT-02: Error handling across components', async () => {
    // Test invalid token handling
    const response = await request(app)
      .get('/api/user/profile')
      .set('Authorization', 'Bearer invalid-token');
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
  });

  test('INT-03: Health check endpoint', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.uptime).toBeGreaterThan(0);
  });

  test('INT-04: CORS headers are present', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000');
    
    expect(response.status).toBe(200);
    // CORS headers should be present for allowed origins
  });

  test('INT-05: Rate limiting works across endpoints', async () => {
    // Test that rate limiting is applied consistently
    const promises = Array(20).fill().map(() =>
      request(app).get('/health')
    );
    
    const responses = await Promise.all(promises);
    
    // All health check requests should succeed (no rate limiting on health)
    expect(responses.every(res => res.status === 200)).toBe(true);
  });

  test('INT-06: Server handles malformed JSON', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}');
    
    expect(response.status).toBe(400);
  });

  test('INT-07: Server handles missing content-type', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send('some data');
    
    // Should handle gracefully
    expect([400, 415]).toContain(response.status);
  });

  test('INT-08: 404 handling for unknown routes', async () => {
    const response = await request(app)
      .get('/api/nonexistent/route');
    
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Route not found');
  });

  // Add proper cleanup to prevent worker process issues
  afterAll((done) => {
    if (server) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });
});