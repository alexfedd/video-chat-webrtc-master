const fc = require('fast-check');
const request = require('supertest');
const { app, sequelize, User } = require('../server');

jest.setTimeout(30000);

describe('Authentication Fuzzing Tests', () => {  beforeAll(async () => {
    // Ensure database is synced before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await User.destroy({ where: {} });
  });

  describe('Registration Endpoint Fuzzing', () => {    it('should handle various username and password combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(1, 20),
          fc.string(1, 20),
          async (username, password) => {
            const response = await request(app)
              .post('/auth/register')
              .send({ username, password });
            return response.status >= 200 && response.status < 500;
          }
        ),
        { numRuns: 10 }
      );
    });    it('should handle special characters in username', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'!@#$%^&*()_+-=[]{}|;:,.<>?'.split('')), {minLength: 1, maxLength: 5}),
          fc.string({minLength: 6, maxLength: 20}).filter(s => s.trim().length >= 6),
          async (specialChars, password) => {
            const response = await request(app)
              .post('/auth/register')
              .send({ 
                username: specialChars,
                password: password.trim()
              });
            
            // Server should return 400 for invalid usernames
            return response.status === 400;
          }
        ),
        { numRuns: 5 }
      );
    });    it('should handle SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "' OR '1'='1",
        '"; DROP TABLE users; --',
        "' UNION SELECT * FROM users; --",
        "admin' --",
        "' OR 1=1; --",
        "' OR 'x'='x"
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...sqlInjectionAttempts),
          fc.string({minLength: 6, maxLength: 20}).filter(s => s.trim().length >= 6),
          async (sqlInjection, password) => {
            const response = await request(app)
              .post('/auth/register')
              .send({ 
                username: sqlInjection,
                password: password.trim()
              });
            
            // Should return 400 for validation error since SQL injection attempts contain invalid characters
            return response.status === 400;
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Login Endpoint Fuzzing', () => {    it('should handle various login attempts', () => {
      fc.assert(
        fc.property(
          fc.string({minLength: 3, maxLength: 20})
            .filter(s => s.trim().length >= 3 && /^[a-zA-Z0-9]+$/.test(s)),
          fc.string({minLength: 6, maxLength: 20})
            .filter(s => s.trim().length >= 6),
          async (username, password) => {
            // First try to register the user
            const registerResponse = await request(app)
              .post('/auth/register')
              .send({ 
                username: username.trim(), 
                password: password.trim() 
              });

            // Then try to login
            const loginResponse = await request(app)
              .post('/auth/login')
              .send({ 
                username: username.trim(), 
                password: password.trim() 
              });
            
            // If registration was successful (201), login should succeed (200)
            // If registration failed (400), login should fail (400)
            return (registerResponse.status === 201 && loginResponse.status === 200) ||
                   (registerResponse.status === 400 && loginResponse.status === 400);
          }
        ),
        { numRuns: 5 }
      );
    });    it('should prevent NoSQL injection attempts', () => {
      // Various NoSQL injection payloads that try to exploit MongoDB operators
      const injectionAttempts = [
        { username: { $ne: null }, password: { $ne: null } },
        { username: { $exists: true }, password: { $exists: true } },
        { $where: 'function() { return true; }' },
        { username: { $gt: '' }, password: { $gt: '' } },
        { username: { $regex: '.*' }, password: { $regex: '.*' } },
        { username: { $in: ['admin'] }, password: { $ne: '' } }
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...injectionAttempts),
          async (maliciousPayload) => {
            const response = await request(app)
              .post('/auth/login')
              .send(maliciousPayload);
            
            // Server should return 400 since payload doesn't match expected string types
            return response.status === 400;
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
