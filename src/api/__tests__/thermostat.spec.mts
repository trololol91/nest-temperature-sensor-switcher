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
    
    // Define a base mock object that can be reused
    const baseMockStatement = {
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn(),
    };

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
                    ...baseMockStatement,                    all: vi.fn(() => {
                        return [
                            { id: 1, thermostatName: 'Living Room', location: 'First Floor', deviceID: 'therm123' },
                            { id: 2, thermostatName: 'Bedroom', location: 'Second Floor', deviceID: 'therm456' },
                        ];
                    }),
                };
            });

            const response = await request.get('/api/thermostat');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            expect(response.body).toEqual([
                { id: 1, thermostatName: 'Living Room', location: 'First Floor', deviceID: 'therm123' },
                { id: 2, thermostatName: 'Bedroom', location: 'Second Floor', deviceID: 'therm456' },
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
                    ...baseMockStatement,
                    all: vi.fn(() => {
                        throw new Error('Database error');
                    }),
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
                    ...baseMockStatement,
                    run: vi.fn(() => {
                        return { lastInsertRowid: 1 }; // Mock the lastInsertRowid
                    }),
                };
            });

            const response = await request
                .post('/api/thermostat')
                .send({ thermostatName: 'Kitchen', location: 'Main Floor', deviceID: 'therm789' });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id', 1);
            expect(response.body).toHaveProperty('thermostatName', 'Kitchen');
            expect(response.body).toHaveProperty('location', 'Main Floor');
            expect(response.body).toHaveProperty('deviceID', 'therm789');
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
                .send({ thermostatName: 'Kitchen', location: 'Main Floor', deviceID: 'therm789' });

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
                        ...baseMockStatement,
                        run: vi.fn(() => {
                            return { lastInsertRowid: 1 }; // Mock the lastInsertRowid
                        }),
                    };
                }

                throw new Error('Database error');
            });

            const response = await request
                .post('/api/thermostat')
                .send({ thermostatName: 'Kitchen', location: 'Main Floor', deviceID: 'therm789' });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Failed to add thermostat or link to user');
        });

        it('should return 400 if location is missing', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });

            const response = await request
                .post('/api/thermostat')
                .send({ thermostatName: 'Kitchen', deviceID: 'therm789' });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Missing location');
        });

        it('should return 400 if deviceID is missing', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });

            const response = await request
                .post('/api/thermostat')
                .send({ thermostatName: 'Kitchen', location: 'Main Floor' });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Missing deviceID');
        });
    });

    describe('POST /:id/assign', () => {
        it('should assign a thermostat to another user', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });            // Create a proper mock for the Database type to simulate successful assignment flow

            const prepareMock = vi.spyOn(db, 'prepare');

            // Mock for transaction start
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // BEGIN TRANSACTION
                return { ...baseMockStatement };
            });

            // Mock for thermostat query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT id FROM thermostat
                return { 
                    ...baseMockStatement,
                    get: vi.fn(() => ({ id: 2 })), // Thermostat exists
                };
            });
            
            // Mock for user_thermostats query - first call to check if current user owns thermostat
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT * FROM user_thermostats WHERE user_id = ? AND thermostat_id = ? (for current user)
                return {
                    ...baseMockStatement,
                    get: vi.fn(() => ({ user_id: 1, thermostat_id: 2 })), // Current user owns thermostat
                };
            });
            
            // Mock for users query to check if target user exists
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT id FROM users WHERE id = ?
                return {
                    ...baseMockStatement,
                    get: vi.fn(() => (null)), // Target user doesn't exist
                };
            });
            
            // Mock for the INSERT query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // INSERT INTO user_thermostats
                return { ...baseMockStatement };
            });

            // Mock for COMMIT query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // COMMIT
                return { ...baseMockStatement };
            });

            const response = await request
                .post('/api/thermostat/2/assign')
                .send({ userId: 3 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Thermostat assigned successfully');
            expect(response.body).toHaveProperty('thermostatId', 2);
            expect(response.body).toHaveProperty('assignedToUserId', 3);
        });

        it('should return 400 if target userId is missing', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });

            const response = await request
                .post('/api/thermostat/2/assign')
                .send({}); // Missing userId

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Missing target user ID');
        });

        it('should return 401 if user context is missing', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((_req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                next();
            });

            const response = await request
                .post('/api/thermostat/2/assign')
                .send({ userId: 3 });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Missing user context');
        });

        it('should return 404 if thermostat is not found', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });            // Create a proper mock for the Database type to simulate thermostat not found
            const prepareMock = vi.spyOn(db, 'prepare');
            
            // Mock for transaction start
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // BEGIN TRANSACTION
                return { ...baseMockStatement };
            });
            
            // Mock for thermostat query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT id FROM thermostat
                return { 
                    ...baseMockStatement,
                    get: vi.fn(() => null), // Thermostat doesn't exist
                };
            });
            
            // Mock for ROLLBACK query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // ROLLBACK
                return { ...baseMockStatement };
            });

            const response = await request
                .post('/api/thermostat/999/assign')
                .send({ userId: 3 });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'Thermostat not found');
        });

        it('should return 403 if the current user does not own the thermostat', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });            // Create a proper mock for the Database type
            const prepareMock = vi.spyOn(db, 'prepare');
            
            // Mock for transaction start
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // BEGIN TRANSACTION
                return { ...baseMockStatement };
            });
            
            // Mock for thermostat query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT id FROM thermostat
                return { 
                    ...baseMockStatement,
                    get: vi.fn(() => ({ id: 2 })), // Thermostat exists
                };
            });
            
            // Mock for user_thermostats query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT * FROM user_thermostats WHERE user_id = ? AND thermostat_id = ?
                return { 
                    ...baseMockStatement,
                    get: vi.fn(() => null), // User doesn't own thermostat
                };
            });
            
            // Mock for ROLLBACK query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // ROLLBACK
                return { ...baseMockStatement };
            });

            const response = await request
                .post('/api/thermostat/2/assign')
                .send({ userId: 3 });

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('error', 'You do not own this thermostat');
        });

        it('should return 409 if the thermostat is already assigned to the target user', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });            // Create a proper mock for the Database type
            const prepareMock = vi.spyOn(db, 'prepare');
            
            // Mock for transaction start
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // BEGIN TRANSACTION
                return { ...baseMockStatement };
            });
            
            // Mock for thermostat query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT id FROM thermostat
                return { 
                    ...baseMockStatement,
                    get: vi.fn(() => ({ id: 2 })), // Thermostat exists
                };
            });
            
            // Mock for first user_thermostats query (current user ownership)
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT * FROM user_thermostats WHERE user_id = ? AND thermostat_id = ? (current user)
                return {
                    ...baseMockStatement,
                    get: vi.fn(() => ({ user_id: 1, thermostat_id: 2 })), // Current user owns thermostat
                };
            });
            
            // Mock for users query (target user exists)
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT id FROM users WHERE id = ?
                return {
                    ...baseMockStatement,
                    get: vi.fn(() => ({ id: 3 })), // Target user exists
                };
            });
            
            // Mock for second user_thermostats query (target user already has thermostat)
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // SELECT * FROM user_thermostats WHERE user_id = ? AND thermostat_id = ? (target user)
                return {
                    ...baseMockStatement,
                    get: vi.fn(() => ({ user_id: 3, thermostat_id: 2 })), // Target user already has it
                };
            });
            
            // Mock for ROLLBACK query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // ROLLBACK
                return { ...baseMockStatement };
            });

            const response = await request
                .post('/api/thermostat/2/assign')
                .send({ userId: 3 });

            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty('error', 'Thermostat is already assigned to the target user');
        });

        it('should handle database errors gracefully', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: Express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });            // Create a proper mock for the Database type to simulate database error
            const prepareMock = vi.spyOn(db, 'prepare');
            
            // Mock for database error during transaction start
            prepareMock.mockImplementationOnce((_source: string) => {
                throw new Error('Database error');
            });
            
            // Mock for ROLLBACK query
            // @ts-expect-error: Mocking a specific implementation
            prepareMock.mockImplementationOnce((_source: string) => {
                // ROLLBACK
                return { ...baseMockStatement };
            });

            const response = await request
                .post('/api/thermostat/2/assign')
                .send({ userId: 3 });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Failed to assign thermostat');
        });
    });
});
