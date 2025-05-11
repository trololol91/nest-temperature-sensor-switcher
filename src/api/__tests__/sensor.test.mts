import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import createSensorRoutes from 'api/sensor.mts';
import { Database } from 'sqlite3';

vi.mock('sqlite3', () => {
    const Database = vi.fn();
    Database.prototype.get = vi.fn();
    Database.prototype.all = vi.fn();
    Database.prototype.run = vi.fn();
    return { Database };
});

vi.mock('scripts/changeNestThermostat.mts', () => ({
    changeNestThermostat: vi.fn().mockResolvedValue(undefined),
}));

describe('Sensor Routes', () => {
    let db;
    let app;

    beforeEach(() => {
        db = new Database(':memory:');
        app = express();
        app.use(express.json());
        app.use('/api', createSensorRoutes(db));
    });

    it('should return 400 if sensorName is missing in /change-sensor', async () => {
        const response = await request(app).post('/api/change-sensor').send({});
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Missing sensorName' });
    });

    it('should return 404 if sensor is not found in /change-sensor', async () => {
        db.get.mockImplementation((_, __, callback) => callback(null, undefined));

        const response = await request(app).post('/api/change-sensor').send({ sensorName: 'NonExistentSensor' });
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Sensor not found' });
    });

    it('should return 500 if there is a database error in /change-sensor', async () => {
        db.get.mockImplementation((_, __, callback) => callback(new Error('Database error')));

        const response = await request(app).post('/api/change-sensor').send({ sensorName: 'Sensor1' });
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch sensor' });
    });

    it('should return 200 if sensor is successfully changed in /change-sensor', async () => {
        db.get.mockImplementation((_, __, callback) => callback(null, { deviceID: '12345' }));

        const response = await request(app).post('/api/change-sensor').send({ sensorName: 'Sensor1' });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Temperature sensor changed to sensorName: Sensor1' });
    });

    it('should return 200 and a list of sensors for /sensors', async () => {
        db.all.mockImplementation((_, __, callback) => callback(null, [
            { id: 1, name: 'Sensor1', deviceID: '12345' },
            { id: 2, name: 'Sensor2', deviceID: '67890' }
        ]));

        const response = await request(app).get('/api/sensors');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            sensors: [
                { id: 1, name: 'Sensor1', deviceID: '12345' },
                { id: 2, name: 'Sensor2', deviceID: '67890' }
            ]
        });
    });

    it('should return 500 if there is a database error in /sensors', async () => {
        db.all.mockImplementation((_, __, callback) => callback(new Error('Database error')));

        const response = await request(app).get('/api/sensors');
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch sensors' });
    });
});

