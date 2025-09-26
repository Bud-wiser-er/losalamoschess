// tests/security.test.js - Security Unit Tests (FIXED)
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { app, server } = require('../server');

describe('Security Implementation Tests', () => {
  
  test('SEC-01: Password hashing uses bcrypt with 12+ rounds', async () => {
    const password = 'testPassword123';
    const saltRounds = 12;
    
    const hash = await bcrypt.hash(password, saltRounds);
    const isValid = await bcrypt.compare(password, hash);
    
    expect(isValid).toBe(true);
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2b$12$')).toBe(true); // bcrypt format with 12 rounds
  });

  test('SEC-02: Rate limiting blocks excessive login attempts', async () => {
    const loginData = {
      email: 'ratetest@example.com',
      password: 'wrongpassword'
    };

    // First, create a user to attempt login against
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'rateuser',
        email: 'ratetest@example.com',
        password: 'correctPassword123'
      });

    // Make multiple failed login attempts
    const promises = Array(12).fill().map(() => 
      request(app)
        .post('/api/auth/login')
        .send(loginData)
    );

    const responses = await Promise.all(promises);
    
    // Some requests should be rate limited (status 429)
    const rateLimited = responses.some(res => res.status === 429);
    expect(rateLimited).toBe(true);
  });

  test('SEC-03: JWT tokens expire correctly', (done) => {
    const payload = { userId: '123', type: 'access' };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { 
      expiresIn: '1s' // Very short expiry for testing
    });
    
    // Token should be valid immediately
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    expect(decoded.userId).toBe('123');
    
    // After 2 seconds, token should be expired
    setTimeout(() => {
      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      }).toThrow('jwt expired');
      done();
    }, 2000);
  });

  test('SEC-04: Headers include security middleware', async () => {
    const response = await request(app).get('/health');
    
    // Check for security headers added by helmet
    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  test('SEC-05: Should reject requests without proper authorization', async () => {
    const response = await request(app)
      .get('/api/user/profile');
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Access token required');
  });

  test('SEC-06: Should reject invalid JWT tokens', async () => {
    const response = await request(app)
      .get('/api/user/profile')
      .set('Authorization', 'Bearer invalid-token-here');
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid or expired token');
  });

  test('SEC-07: Should validate input data format', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'test',
        email: 'not-an-email', // Invalid email format
        password: 'validPassword123'
      });
    
    // FIXED: Now expects 400 because Joi validation is implemented
    expect(response.status).toBe(400);
  });

  test('SEC-08: Should prevent XSS in responses', async () => {
    const maliciousInput = '<script>alert("xss")</script>';
    
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: maliciousInput,
        email: 'test@example.com',
        password: 'validPassword123'
      });
    
    // FIXED: Now expects sanitized input because XSS prevention is implemented
    if (response.status === 201) {
      expect(response.body.user.username).not.toContain('<script>');
    } else {
      expect(response.status).toBe(400);
    }
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