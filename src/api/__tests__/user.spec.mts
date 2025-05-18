import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import userRouter from '../user.mts';
import db from 'middleware/database.mts';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as authHelper from 'helper/authHelper.mts';
import { SECRET_KEY } from 'constants.mts';
import TestAgent from 'supertest/lib/agent';

// Mock bcrypt
vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed-password'),
        compare: vi.fn(),
    },
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn(),
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn().mockReturnValue('test-token'),
    },
    sign: vi.fn().mockReturnValue('test-token'),
}));

// Mock constants
vi.mock('constants.mts', () => ({
    SECRET_KEY: 'test-secret-key',
}));

// Mock auth helper
vi.mock('helper/authHelper.mts', () => ({
    storeToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock database
vi.mock('middleware/database.mts', () => {
    const mockDb = {
        prepare: vi.fn(),
    };
  
    return { default: mockDb };
});

describe('User Router', () => {
    let app: express.Express;
    let request: TestAgent;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/user', userRouter);
        request = supertest(app);
    
        // Reset mock history between tests
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('POST /login', () => {
        it('should return 400 if username or password is missing', async () => {
            const response = await request.post('/user/login').send({});
      
            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing username or password' });
        });

        it('should return 401 if user is not found', async () => {
            // Setup database mock to return no user
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation(() => {
                return {
                    get: vi.fn().mockReturnValue(null),
                };
            });

            const response = await request
                .post('/user/login')
                .send({ username: 'testuser', password: 'password123' });
      
            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'Invalid credentials' });
        });

        it('should return 401 if password is incorrect', async () => {
            // Setup database mock to return a user
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation(() => {
                return {
                    get: vi.fn().mockReturnValue({ id: 1, password: 'hashed-password' }),
                };
            });

            // Setup bcrypt to return false for password comparison
            vi.mocked(bcrypt.compare).mockImplementation((_plain, _hash, callback) => {
                callback(undefined, false);
            });

            const response = await request
                .post('/user/login')
                .send({ username: 'testuser', password: 'wrong-password' });
      
            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'Invalid credentials' });
        });

        it('should return 200 and a token if login is successful', async () => {
            const testToken = 'test-token';
            const testUser = { id: 1, username: 'testuser', password: 'password123' };
            // Setup database mock to return a user
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation(() => {
                return {
                    get: vi.fn().mockReturnValue({ id: 1, password: 'hashed-password' }),
                };
            });

            // Setup jwt sign mock
            vi.mocked(jwt.sign).mockImplementation(() => testToken);

            // Setup bcrypt to return true for password comparison
            vi.mocked(bcrypt.compare).mockImplementation((_plain, _hash, callback) => {
                callback(undefined, true);
            });

            const response = await request
                .post('/user/login')
                .send({ username: testUser.username, password: testUser.password });
      
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ token: testToken });
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: testUser.id, username: testUser.username },
                SECRET_KEY,
                { expiresIn: '1h' }
            );
            expect(authHelper.storeToken).toHaveBeenCalled();
        });

        it('should return 500 if bcrypt compare throws an error', async () => {
            // Setup database mock to return a user
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation(() => {
                return {
                    get: vi.fn().mockReturnValue({ id: 1, password: 'hashed-password' }),
                };
            });

            // Setup bcrypt to throw an error
            vi.mocked(bcrypt.compare).mockImplementation((_plain, _hash, callback) => {
                callback(new Error('Bcrypt error'), false);
            });

            const response = await request
                .post('/user/login')
                .send({ username: 'testuser', password: 'password123' });
      
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Internal server error' });
        });

        it('should return 500 if token storage fails', async () => {
            // Setup database mock to return a user
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation(() => {
                return {
                    get: vi.fn().mockReturnValue({ id: 1, password: 'hashed-password' }),
                };
            });

            // Setup bcrypt to return true for password comparison
            vi.mocked(bcrypt.compare).mockImplementation((_plain, _hash, callback) => {
                callback(undefined, true);
            });

            // Setup storeToken to throw an error
            vi.mocked(authHelper.storeToken).mockImplementation(() => {
                throw new Error('Token storage error');
            });

            const response = await request
                .post('/user/login')
                .send({ username: 'testuser', password: 'password123' });
      
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Internal server error' });
        });

        it('should return 500 if database throws an error', async () => {
            // Setup database mock to throw an error
            vi.spyOn(db, 'prepare').mockImplementation(() => {
                throw new Error('Database error');
            });

            const response = await request
                .post('/user/login')
                .send({ username: 'testuser', password: 'password123' });
      
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Internal server error' });
        });
    });

    describe('POST /create-account', () => {
        it('should return 400 if username, password, or email is missing', async () => {
            const response = await request.post('/user/create-account').send({});
      
            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing username, password, or email' });
        });

        it('should return 201 if account creation is successful', async () => {
            // Setup bcrypt hash mock
            vi.mocked(bcrypt.hash).mockImplementation((_password, _salt) => {
                return 'hashed-password';
            });

            // Setup database run mock
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation(() => {
                return {
                    run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
                };
            });

            const response = await request
                .post('/user/create-account')
                .send({ 
                    username: 'newuser', 
                    password: 'password123',
                    email: 'newuser@example.com' 
                });
      
            expect(response.status).toBe(201);
            expect(response.body).toEqual({ 
                message: 'Account created successfully',
                userId: 1
            });
        });

        it('should return 409 if username or email already exists', async () => {
            // Setup bcrypt hash mock
            vi.mocked(bcrypt.hash).mockImplementation((_password, _salt) => {
                return 'hashed-password';
            });
      
            // Setup database run mock to throw a constraint error
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation(() => {
                return {
                    run: vi.fn().mockImplementation(() => {
                        const error = new Error('UNIQUE constraint failed');
                        error.message = 'UNIQUE constraint failed';
                        throw error;
                    }),
                };
            });

            const response = await request
                .post('/user/create-account')
                .send({ 
                    username: 'existinguser', 
                    password: 'password123',
                    email: 'existing@example.com' 
                });
      
            expect(response.status).toBe(409);
            expect(response.body).toEqual({ error: 'Username or email already exists' });
        });

        it('should return 500 if database throws a non-constraint error', async () => {
            // Setup bcrypt hash mock
            vi.mocked(bcrypt.hash).mockImplementation((_password, _salt) => {
                return 'hashed-password';
            });
      
            // Setup database run mock to throw a generic error
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation(() => {
                return {
                    run: vi.fn().mockImplementation(() => {
                        throw new Error('Database error');
                    }),
                };
            });

            const response = await request
                .post('/user/create-account')
                .send({ 
                    username: 'newuser', 
                    password: 'password123',
                    email: 'newuser@example.com' 
                });
      
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to create account' });
        });

        it('should return 500 if password hashing fails', async () => {
            // Setup bcrypt hash mock to throw an error
            vi.mocked(bcrypt.hash).mockRejectedValue(new Error('Hashing error'));
      
            const response = await request
                .post('/user/create-account')
                .send({ 
                    username: 'newuser', 
                    password: 'password123',
                    email: 'newuser@example.com' 
                });
      
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to hash password' });
        });
    });
});

