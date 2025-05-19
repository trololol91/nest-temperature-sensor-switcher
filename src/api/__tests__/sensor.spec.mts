import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import sensorRouter from '../sensor.mts';
import * as auth from 'middleware/auth.mts';
import TestAgent from 'supertest/lib/agent';
import db from 'middleware/database.mts';
import { changeNestThermostat } from 'scripts/changeNestThermostat.mts';

// Mock imports
vi.mock('scripts/changeNestThermostat.mts', () => ({
    changeNestThermostat: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('middleware/auth.mts', () => ({
    authenticate: vi.fn((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
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

describe('Sensor Router', () => {
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
        app.use('/api/sensor', sensorRouter);
        request = supertest(app);

        // Reset mock history between tests
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });    
    
    describe('POST /change-sensor', () => {
        it('should return 200 when sensor is successfully changed', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            // Mock the database responses for thermostat and sensor queries
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT t.id, t.name')) {
                    // First query - thermostat check
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ id: 1, name: 'Living Room' })),
                    };
                } else if (query.includes('SELECT s.deviceID')) {
                    // Second query - sensor check
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ deviceID: 'device123' })),
                    };
                }
                return baseMockStatement;
            });

            // Mock the changeNestThermostat function
            (changeNestThermostat as Mock).mockResolvedValue(undefined);

            const response = await request.post('/api/sensor/change-sensor').send({
                sensorName: 'Living Room Sensor',
                thermostat_id: 1
            });            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message');
            // Type assertion for TypeScript safety
            expect((response.body as { message: string }).message).toContain('Living Room Sensor');
            expect((response.body as { message: string }).message).toContain('Living Room');
            expect(changeNestThermostat).toHaveBeenCalledWith('device123', 'Living Room', true);
        });

        it('should return 400 if sensorName is missing', async () => {
            const response = await request.post('/api/sensor/change-sensor').send({
                thermostat_id: 1
            });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing sensorName' });
        });

        it('should return 400 if thermostat_id is missing', async () => {
            const response = await request.post('/api/sensor/change-sensor').send({
                sensorName: 'Living Room Sensor'
            });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing thermostat_id' });
        });

        it('should return 401 if user is not authenticated', async () => {
            // Mock the authenticate function to not set user
            (auth.authenticate as Mock).mockImplementation((_req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                // Don't set user in the request
                next();
            });

            const response = await request.post('/api/sensor/change-sensor').send({
                sensorName: 'Living Room Sensor',
                thermostat_id: 1
            });

            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'User not authenticated' });
        });

        it('should return 403 if thermostat is not found or not owned by user', async () => {
            // Mock the authenticate function
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // Mock the database to return no thermostat
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT t.id, t.name')) {
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => null), // No thermostat found
                    };
                }
                return baseMockStatement;
            });

            const response = await request.post('/api/sensor/change-sensor').send({
                sensorName: 'Living Room Sensor',
                thermostat_id: 999 // Non-existent or not owned
            });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Thermostat not found or not owned by the user' });
        });

        it('should return 403 if sensor is not found or not attached to thermostat', async () => {
            // Mock the authenticate function
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            // Mock database responses - thermostat exists but sensor doesn't
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT t.id, t.name')) {
                    // First query - thermostat check
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ id: 1, name: 'Living Room' })),
                    };
                } else if (query.includes('SELECT s.deviceID')) {
                    // Second query - sensor check
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => null), // No sensor found
                    };
                }
                return baseMockStatement;
            });

            const response = await request.post('/api/sensor/change-sensor').send({
                sensorName: 'Non-existent Sensor',
                thermostat_id: 1
            });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Sensor not found or not attached to the specified thermostat' });
        });

        it('should return 500 if there is an error changing the sensor', async () => {
            // Mock the authenticate function
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // Mock database responses to succeed
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT t.id, t.name')) {
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ id: 1, name: 'Living Room' })),
                    };
                } else if (query.includes('SELECT s.deviceID')) {
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ deviceID: 'device123' })),
                    };
                }
                return baseMockStatement;
            });

            // But make the changeNestThermostat function fail
            (changeNestThermostat as Mock).mockRejectedValue(new Error('Failed to change thermostat'));

            const response = await request.post('/api/sensor/change-sensor').send({
                sensorName: 'Living Room Sensor',
                thermostat_id: 1
            });

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to change temperature sensor' });
        });
    });
    
    describe('GET /', () => {
        it('should return 200 and a list of sensors', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    ...baseMockStatement,
                    all: vi.fn(() => [
                        { id: 1, name: 'Sensor1', deviceID: '12345' },
                        { id: 2, name: 'Sensor2', deviceID: '67890' }
                    ]),
                };
            });

            const response = await request.get('/api/sensor');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                sensors: [
                    { id: 1, name: 'Sensor1', deviceID: '12345' },
                    { id: 2, name: 'Sensor2', deviceID: '67890' }
                ]
            });
        });

        it('should return 401 if user context is missing', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((_req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                // Don't set user in the request
                next();
            });

            const response = await request.get('/api/sensor');
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'User not authenticated');
        });

        it('should return 500 if there is a database error', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    ...baseMockStatement,
                    all: vi.fn(() => {
                        throw new Error('Database error');
                    }),
                };
            });

            const response = await request.get('/api/sensor');
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to fetch sensors' });
        });
    });

    describe('GET /sensor-names', () => {
        it('should return 200 and a list of sensor names', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    ...baseMockStatement,
                    all: vi.fn(() => [
                        { name: 'Sensor1' },
                        { name: 'Sensor2' }
                    ]),
                };
            });

            const response = await request.get('/api/sensor/sensor-names');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                sensorNames: ['Sensor1', 'Sensor2']
            });
        });

        it('should return 401 if user is not authenticated', async () => {
            // Mock the authenticate function to not set user
            (auth.authenticate as Mock).mockImplementation((_req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                // Don't set user in the request
                next();
            });

            const response = await request.get('/api/sensor/sensor-names');
            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'User not authenticated' });
        });

        it('should return 500 if there is a database error', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    ...baseMockStatement,
                    all: vi.fn(() => {
                        throw new Error('Database error');
                    }),
                };
            });

            const response = await request.get('/api/sensor/sensor-names');
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to fetch sensor names' });
        });
    });    
    
    describe('POST /', () => {
        it('should return 201 and the created sensor', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT t.id')) {
                    // First query - thermostat check
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ id: 1 })),
                    };
                } else {
                    return {
                        ...baseMockStatement,
                        run: vi.fn(() => {
                            return { lastInsertRowid: 1 }; // Mock the lastInsertRowid
                        }),
                    };
                }
            });

            const response = await request.post('/api/sensor').send({
                name: 'Sensor1',
                deviceID: '12345',
                thermostat_id: 1
            });

            expect(response.status).toBe(201);
            expect(response.body).toEqual({
                id: 1,
                name: 'Sensor1',
                deviceID: '12345',
                thermostat_id: 1
            });
        });

        it('should return 400 if name or deviceID is missing', async () => {
            const response = await request.post('/api/sensor').send({
                name: 'Sensor1', // Missing deviceID
                thermostat_id: 1
            });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing name or deviceID' });
        });

        it('should return 400 if thermostat_id is missing', async () => {
            const response = await request.post('/api/sensor').send({
                name: 'Sensor1',
                deviceID: '12345'
                // Missing thermostat_id
            });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing thermostat_id' });
        });        it('should return 401 if user context is missing', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((_req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                // Don't set user in the request
                next();
            });

            const response = await request.post('/api/sensor').send({
                name: 'Sensor1',
                deviceID: '12345',
                thermostat_id: 1
            });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'User not authenticated');
        });

        it('should return 403 if thermostat is not found or not owned by user', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT t.id')) {
                    // First query - thermostat check
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => null), // No thermostat found
                    };
                }
                return baseMockStatement;
            });

            const response = await request.post('/api/sensor').send({
                name: 'Sensor1',
                deviceID: '12345',
                thermostat_id: 999 // Non-existent or not owned
            });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Thermostat not found or not owned by the user' });
        });
        it('should return 500 if there is a database error', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // Mock database responses properly in sequence
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT t.id')) {
                    // First query succeeds
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ id: 1 })),
                    };
                } else if (query.includes('INSERT INTO sensors')) {
                    // Second query fails
                    return {
                        ...baseMockStatement,
                        run: vi.fn(() => {
                            throw new Error('Database error');
                        }),
                    };
                }
                return baseMockStatement;
            });

            const response = await request.post('/api/sensor').send({
                name: 'Sensor1',
                deviceID: '12345',
                thermostat_id: 1
            });

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to add sensor' });
        });
    });
    
    describe('DELETE /:id', () => {
        it('should return 200 if sensor is successfully deleted', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT s.id')) {
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ id: 1 })),
                    };
                } else {
                    return {
                        ...baseMockStatement,
                        run: vi.fn(() => {
                            return { changes: 1 }; // Mock the changes
                        }),
                    };
                }
            });

            const response = await request.delete('/api/sensor/1');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ message: 'Sensor deleted successfully' });
        });

        it('should return 403 if sensor is not found or not owned by user', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT s.id')) {
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => null), // No sensor found
                    };
                }
                return baseMockStatement;
            });

            const response = await request.delete('/api/sensor/999');
            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Sensor not found or not owned by the user' });
        });

        it('should return 404 if sensor does not exist', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT s.id')) {
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ id: 1 })),
                    };
                } else {
                    return {
                        ...baseMockStatement,
                        run: vi.fn(() => {
                            return { changes: 0 }; // No changes indicate the sensor wasn't found
                        }),
                    };
                }
            });

            const response = await request.delete('/api/sensor/999');
            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Sensor not found' });
        });        it('should return 401 if user context is missing', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((_req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                // Don't set user in the request
                next();
            });

            const response = await request.delete('/api/sensor/1');
            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'User not authenticated' });
        });        
        
        it('should return 500 if there is a database error', async () => {
            // Mock the authenticate function for this specific test
            (auth.authenticate as Mock).mockImplementation((req: auth.AuthenticatedRequest, _res: express.Response, next: () => void) => {
                req.user = { id: 1, username: 'testuser' };
                next();
            });
            
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
                if (query.includes('SELECT s.id')) {
                    return {
                        ...baseMockStatement,
                        get: vi.fn(() => ({ id: 1 })),
                    };
                } else {
                    return {
                        ...baseMockStatement,
                        run: vi.fn(() => {
                            throw new Error('Database error');
                        }),
                    };
                }
            });

            const response = await request.delete('/api/sensor/1');
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to delete sensor' });
        });
    });
});

