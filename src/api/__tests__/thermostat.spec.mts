import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import thermostatRouter from '../thermostat.mts';
import * as auth from 'middleware/auth.mts';
import TestAgent from 'supertest/lib/agent';
import db from 'middleware/database.mts';

// Mock imports
vi.mock('middleware/auth.mts', () => ({
    authenticate: vi.fn((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
        req.user = { id: 1, username: 'testuser' }; // Mock user
        next();
    })
}));

vi.mock('middleware/database.mts', () => {
    const db = {
        prepare: vi.fn().mockImplementation((_query: string) => {
            return {
                all: vi.fn(),
                run: vi.fn(),
                get: vi.fn()
            };
        }),
    };

    return { default: db };
});

vi.mock('utils/logger.mts', () => ({
    createNamedLogger: vi.fn(() => ({
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    })),
}));

describe('Thermostat Router', () => {
    let app: express.Express;
    let request: TestAgent;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/thermostat', thermostatRouter);
        request = supertest(app);

        // Reset mock history between tests
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /', () => {
        it('should return thermostats for the authenticated user', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });

            // Create a proper mock for the Database type
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(() => {
                        return [
                            { id: 1, thermostatName: 'Living Room', location: 'First Floor' },
                            { id: 2, thermostatName: 'Bedroom', location: 'Second Floor' },
                        ];
                    }),
                    get: vi.fn(),
                    run: vi.fn(),
                };
            });

            const response = await request.get('/api/thermostat');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            expect(response.body).toEqual([
                { id: 1, thermostatName: 'Living Room', location: 'First Floor' },
                { id: 2, thermostatName: 'Bedroom', location: 'Second Floor' },
            ]);
        });

        it('should return 401 if user context is missing', async () => {
            (auth.authenticate as Mock).mockImplementation((_req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                // req.user = { id: 1, username: 'testuser' };
                next();
            });

            // Don't set user in the request
            const response = await request.get('/api/thermostat');
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Missing user context');
        });

        it('should return 500 if database query fails', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });

            // Create a proper mock for the Database type
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(() => {
                        throw new Error('Database error');
                    }),
                    get: vi.fn(),
                    run: vi.fn(),
                };
            });

            const response = await request.get('/api/thermostat');
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Failed to retrieve thermostats');
        });
    });

    describe('POST /', () => {
        it('should add a new thermostat and link it to the user', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });

            // Create a proper mock for the Database type
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(),
                    get: vi.fn(),
                    run: vi.fn(() => {
                        return { lastInsertRowid: 1 }; // Mock the lastInsertRowid
                    }),
                };
            });

            const response = await request
                .post('/api/thermostat')
                .send({ thermostatName: 'Kitchen', location: 'Main Floor' });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id', 1);
            expect(response.body).toHaveProperty('thermostatName', 'Kitchen');
            expect(response.body).toHaveProperty('location', 'Main Floor');
        });

        it('should return 400 if thermostatName is missing', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });

            const response = await request
                .post('/api/thermostat')
                .send({ location: 'Main Floor' });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Missing thermostatName');
        });

        it('should return 400 if user context is missing', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((_req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                next();
            });

            // Don't set user in the request
            const response = await request
                .post('/api/thermostat')
                .send({ thermostatName: 'Kitchen', location: 'Main Floor' });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Missing user context');
        });

        it('should handle database errors gracefully', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });

            // Create a proper mock for the Database type
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                if(_source.includes('ROLLBACK')) {
                    return {
                        all: vi.fn(),
                        get: vi.fn(),
                        run: vi.fn(() => {
                            return { lastInsertRowid: 1 }; // Mock the lastInsertRowid
                        }),
                    };
                }

                throw new Error('Database error');
            });

            const response = await request
                .post('/api/thermostat')
                .send({ thermostatName: 'Kitchen', location: 'Main Floor' });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Failed to add thermostat or link to user');
        });
    });
});
