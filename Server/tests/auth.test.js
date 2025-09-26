// Authentication Unit Tests (FIXED)
// basically login stuff
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { app, server } = require('../server');

describe('Authentication System Tests', () => {
  // sign in
  describe('User Registration', () => {
    test('AUTH-01: Should register valid user with hashed password', async () => {
      const userData = {
        username: 'testuser123',
        email: 'test@example.com',
        password: 'securePassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Validate response structure
      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      
      // Ensure password is not returned
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    // user already exists
    test('AUTH-02: Should reject duplicate email registration', async () => {
      const userData = {
        username: 'user1',
        email: 'duplicate@example.com',
        password: 'password123'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Attempt duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user2',
          email: 'duplicate@example.com',
          password: 'differentPassword'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    test('AUTH-03: Should reject weak passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'weak@example.com',
          password: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('8 characters');
    });
  });
  // base login
  describe('User Login', () => {
    beforeEach(async () => {
      // Create test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'loginuser',
          email: 'login@example.com',
          password: 'loginPassword123'
        });
    });
    // 
    test('AUTH-04: Should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'loginPassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.username).toBe('loginuser');
    });
    // incorrect sign in
    test('AUTH-05: Should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongPassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('JWT Token System', () => {
    let accessToken, refreshToken, userId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'tokenuser',
          email: 'token@example.com',
          password: 'tokenPassword123'
        });
      
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
      // FIXED: Check if user exists and has id before accessing
      userId = response.body.user && response.body.user.id ? response.body.user.id : null;
    });

    // checking valid tokens
    test('AUTH-06: Should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('tokenuser');
    });

    test('AUTH-07: Should reject access without token', async () => {
      const response = await request(app)
        .get('/api/user/profile');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('AUTH-08: Should refresh tokens successfully', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: `tokenuser8${Date.now()}`,
          email: `token8${Date.now()}@example.com`,
          password: 'tokenPassword123'
        });
      
      expect(registerResponse.status).toBe(201);
      const { accessToken, refreshToken } = registerResponse.body;
      
      // Wait 1 second to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      
      // Check that tokens are functionally different (decode and compare timestamps)
      const jwt = require('jsonwebtoken');
      const originalDecoded = jwt.decode(accessToken);
      const newDecoded = jwt.decode(response.body.accessToken);
      
      expect(newDecoded.iat).toBeGreaterThan(originalDecoded.iat);
    });
  });

  // Add proper cleanup
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