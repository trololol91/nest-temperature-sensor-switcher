import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
        it('should return 400 if sensorName is missing', async () => {
            const response = await request.post('/api/sensor/change-sensor').send({});
            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing sensorName' });
        });

        it('should return 404 if sensor is not found', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(),
                    get: vi.fn(() => undefined),
                    run: vi.fn(),
                };
            });

            const response = await request.post('/api/sensor/change-sensor').send({ sensorName: 'NonExistentSensor' });
            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Sensor not found' });
        });

        it('should return 500 if there is a database error', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(),
                    get: vi.fn(() => {
                        throw new Error('Database error');
                    }),
                    run: vi.fn(),
                };
            });

            const response = await request.post('/api/sensor/change-sensor').send({ sensorName: 'Sensor1' });
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to change temperature sensor' });
        });

        it('should return 200 if sensor is successfully changed', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(),
                    get: vi.fn(() => ({ deviceID: '12345' })),
                    run: vi.fn(),
                };
            });

            const response = await request.post('/api/sensor/change-sensor').send({ sensorName: 'Sensor1' });
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ message: 'Temperature sensor changed to sensorName: Sensor1' });
            expect(changeNestThermostat).toHaveBeenCalledWith('12345', 'DEVICE_CCA7C100002935B9', true);
        });
    });

    describe('GET /', () => {
        it('should return 200 and a list of sensors', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(() => [
                        { id: 1, name: 'Sensor1', deviceID: '12345' },
                        { id: 2, name: 'Sensor2', deviceID: '67890' }
                    ]),
                    get: vi.fn(),
                    run: vi.fn(),
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

        it('should return 500 if there is a database error', async () => {
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

            const response = await request.get('/api/sensor');
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to fetch sensors' });
        });
    });

    describe('GET /sensor-names', () => {
        it('should return 200 and a list of sensor names', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(() => [
                        { name: 'Sensor1' },
                        { name: 'Sensor2' }
                    ]),
                    get: vi.fn(),
                    run: vi.fn(),
                };
            });

            const response = await request.get('/api/sensor/sensor-names');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                sensorNames: ['Sensor1', 'Sensor2']
            });
        });

        it('should return 500 if there is a database error', async () => {
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

            const response = await request.get('/api/sensor/sensor-names');
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to fetch sensor names' });
        });
    });

    describe('POST /', () => {
        it('should return 201 and the created sensor', async () => {
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

            const response = await request.post('/api/sensor').send({
                name: 'Sensor1',
                deviceID: '12345'
            });

            expect(response.status).toBe(201);
            expect(response.body).toEqual({
                id: 1,
                name: 'Sensor1',
                deviceID: '12345'
            });
        });

        it('should return 400 if name or deviceID is missing', async () => {
            const response = await request.post('/api/sensor').send({
                name: 'Sensor1' // Missing deviceID
            });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing name or deviceID' });
        });

        it('should return 500 if there is a database error', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(),
                    get: vi.fn(),
                    run: vi.fn(() => {
                        throw new Error('Database error');
                    }),
                };
            });

            const response = await request.post('/api/sensor').send({
                name: 'Sensor1',
                deviceID: '12345'
            });

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to add sensor' });
        });
    });

    describe('DELETE /:id', () => {
        it('should return 200 if sensor is successfully deleted', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(),
                    get: vi.fn(),
                    run: vi.fn(() => {
                        return { changes: 1 }; // Mock the changes
                    }),
                };
            });

            const response = await request.delete('/api/sensor/1');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ message: 'Sensor deleted successfully' });
        });

        it('should return 404 if sensor does not exist', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(),
                    get: vi.fn(),
                    run: vi.fn(() => {
                        return { changes: 0 }; // No changes indicate the sensor wasn't found
                    }),
                };
            });

            const response = await request.delete('/api/sensor/999');
            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Sensor not found' });
        });

        it('should return 500 if there is a database error', async () => {
            // @ts-expect-error: Mocking a specific implementation
            vi.spyOn(db, 'prepare').mockImplementation((_source: string) => {
                return {
                    all: vi.fn(),
                    get: vi.fn(),
                    run: vi.fn(() => {
                        throw new Error('Database error');
                    }),
                };
            });

            const response = await request.delete('/api/sensor/1');
            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to delete sensor' });
        });
    });
});

