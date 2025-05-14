import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import router from 'api/user.mts';
import db from 'middleware/database.mts';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as authHelper from 'helper/authHelper.mjs';

vi.mock('helper/authHelper.mts', () => ({
    storeToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('constants.mts', () => ({
    ...vi.importActual('constants.mts'),
    SECRET_KEY: 'test-secret-key',
}));

vi.mock('utils/logger.mts', () => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
}));

vi.mock('middleware/database.mts', () => ({
    default: {
        get: vi.fn((_, __, callback) => callback(null, undefined)),
        all: vi.fn((_, __, callback) => callback(null, [])),
        run: vi.fn((_, __, callback) => callback(null)),
    },
}));

vi.mock('helper/authHelper.mts', () => ({
    storeToken: vi.fn().mockResolvedValue(undefined),
}));

describe('User Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/user', router);

        vi.spyOn(db, 'get').mockImplementation((_, __, callback) => {
            callback(null, undefined);
            return db; // Ensure the mock returns the db object
        });
        vi.spyOn(db, 'run').mockImplementation((_, __, callback) => {
            callback(null);
            return db; // Ensure the mock returns the db object
        });
    });

    describe('POST /user/login', () => {
        it('should return 400 if username or password is missing', async () => {
            const response = await request(app).post('/user/login').send({});
            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing username or password' });
        });

        it('should return 401 if credentials are invalid', async () => {
            vi.spyOn(db, 'get').mockImplementation((_, __, callback) => callback(null, undefined));

            const response = await request(app).post('/user/login').send({ username: 'testuser', password: 'wrongpassword' });
            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'Invalid credentials' });
        });

        it('should return 200 and a token if login is successful', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            vi.spyOn(db, 'get').mockImplementation((_, __, callback) => callback(null, { id: 1, password: hashedPassword }));
            vi.spyOn(jwt, 'sign').mockImplementation(() => 'test-token');

            const response = await request(app).post('/user/login').send({ username: 'testuser', password: 'password123' });
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ token: 'test-token' });
        });

        it('should return 500 if there is a database error during user lookup', async () => {
            vi.spyOn(db, 'get').mockImplementation((_, __, callback) => {
                const error = new Error('Database error');
                callback(error, undefined);
                return db;
            });

            const response = await request(app).post('/user/login').send({ username: 'testuser', password: 'password123' });
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Internal server error' });
        });

        it('should return 500 if there is an error storing the token', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            vi.spyOn(db, 'get').mockImplementation((_, __, callback) => callback(null, { id: 1, password: hashedPassword }));
            vi.spyOn(jwt, 'sign').mockImplementation(() => 'test-token');
            vi.mocked(authHelper.storeToken).mockImplementation(() => {
                throw new Error('Token storage error');
            });

            const response = await request(app).post('/user/login').send({ username: 'testuser', password: 'password123' });
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Internal server error' });
        });

        it('should handle missing SECRET_KEY gracefully', async () => {
            vi.spyOn(jwt, 'sign').mockImplementation(() => {
                throw new Error('Missing SECRET_KEY');
            });

            const hashedPassword = await bcrypt.hash('password123', 10);
            vi.spyOn(db, 'get').mockImplementation((_, __, callback) => callback(null, { id: 1, password: hashedPassword }));

            const response = await request(app).post('/user/login').send({ username: 'testuser', password: 'password123' });
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Internal server error' });
        });
    });

    describe('POST /user/create-account', () => {
        it('should return 400 if username, password, or email is missing', async () => {
            const response = await request(app).post('/user/create-account').send({});
            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing username, password, or email' });
        });

        it('should return 409 if username or email already exists', async () => {
            vi.spyOn(db, 'run').mockImplementation((_, __, callback) => {
                const error = new Error('UNIQUE constraint failed');
                error.message = 'UNIQUE constraint failed';
                callback(error);
                return db;
            });

            const response = await request(app).post('/user/create-account').send({ username: 'testuser', password: 'password123', email: 'test@example.com' });
            expect(response.status).toBe(409);
            expect(response.body).toEqual({ error: 'Username or email already exists' });
        });

        it('should return 201 if account is created successfully', async () => {
            vi.spyOn(db, 'run').mockImplementation(function (_: string, __: unknown[], callback: (err: Error | null) => void) {
                this.lastID = 1; // Mock the last inserted ID
                callback.bind(this)(null); // Call the callback with null error
                return db;
            });

            const response = await request(app).post('/user/create-account').send({ username: 'testuser', password: 'password123', email: 'test@example.com' });
            expect(response.status).toBe(201);
            expect(response.body).toEqual({ message: 'Account created successfully', userId: expect.any(Number) });
        });
    });
});
