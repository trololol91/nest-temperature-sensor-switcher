import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import router from 'api/sensor.mts';
import db from 'middleware/database.mts';

vi.mock('scripts/changeNestThermostat.mts', () => ({
    changeNestThermostat: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('middleware/auth.mts', () => ({
    authenticate: (req, _res, next): void => {
        // Mock authentication middleware
        req.user = { id: 1, username: 'testuser' };
        next();
    }
}));

describe('Sensor Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/sensor', router);

        vi.spyOn(db, 'get').mockImplementation((_, __, callback) => {
            callback(null, undefined);
            return db;
        });
        vi.spyOn(db, 'all').mockImplementation((_, __, callback) => {
            callback(null, []);
            return db;
        });
        vi.spyOn(db, 'run').mockImplementation((_, __, callback) => {
            callback(null);
            return db;
        });
    });

    it('should return 400 if sensorName is missing in /sensor/change-sensor', async () => {
        const response = await request(app).post('/sensor/change-sensor').send({});
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Missing sensorName' });
    });

    it('should return 404 if sensor is not found in /sensor/change-sensor', async () => {
        vi.spyOn(db, 'get').mockImplementation((_, __, callback) => callback(null, undefined));
        const response = await request(app).post('/sensor/change-sensor').send({ sensorName: 'NonExistentSensor' });
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Sensor not found' });
    });

    it('should return 500 if there is a database error in /sensor/change-sensor', async () => {
        vi.spyOn(db, 'get').mockImplementation((_, __, callback) => callback(new Error('Database error')));

        const response = await request(app).post('/sensor/change-sensor').send({ sensorName: 'Sensor1' });
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch sensor' });
    });

    it('should return 200 if sensor is successfully changed in /sensor/change-sensor', async () => {
        vi.spyOn(db, 'get').mockImplementation((_, __, callback) => callback(null, { id: 1, name: 'Sensor1' }));


        const response = await request(app).post('/sensor/change-sensor').send({ sensorName: 'Sensor1' });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Temperature sensor changed to sensorName: Sensor1' });
    });

    it('should return 200 and a list of sensors for /sensor', async () => {
        vi.spyOn(db, 'all').mockImplementation((_, __, callback) => {
            callback(null, [
                { id: 1, name: 'Sensor1', deviceID: '12345' },
                { id: 2, name: 'Sensor2', deviceID: '67890' }
            ]);
            return db;
        });

        const response = await request(app).get('/sensor');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            sensors: [
                { id: 1, name: 'Sensor1', deviceID: '12345' },
                { id: 2, name: 'Sensor2', deviceID: '67890' }
            ]
        });
    });

    it('should return 500 if there is a database error in /sensor', async () => {
        vi.spyOn(db, 'all').mockImplementation((_, __, callback) => {
            callback(new Error('Database error'));
            return db;
        });

        const response = await request(app).get('/sensor');
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch sensors' });
    });

    it('should return 200 and a list of sensor names for /sensor/sensor-names', async () => {
        vi.spyOn(db, 'all').mockImplementation((_, __, callback) => {
            callback(null, [
                { name: 'Sensor1' },
                { name: 'Sensor2' }
            ]);
            return db;
        });

        const response = await request(app).get('/sensor/sensor-names');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            sensorNames: ['Sensor1', 'Sensor2']
        });
    });

    it('should return 500 if there is a database error in /sensor-names', async () => {
        vi.spyOn(db, 'all').mockImplementation((_, __, callback) => {
            callback(new Error('Database error'));
            return db;
        });

        const response = await request(app).get('/sensor/sensor-names');
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to fetch sensor names' });
    });

    it('should return 201 and the created sensor for /sensor', async () => {
        vi.spyOn(db, 'run').mockImplementation(function (_: string, __: unknown[], callback: (err: Error | null) => void) {
            this.lastID = 1; // Mock the last inserted ID
            callback.bind(this)(null); // Call the callback with null error
            return db;
        });

        const response = await request(app).post('/sensor').send({
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

    it('should return 400 if name or deviceID is missing in /sensor', async () => {
        const response = await request(app).post('/sensor').send({
            name: 'Sensor1'
        });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Missing name or deviceID' });
    });

    it('should return 500 if there is a database error in /sensor', async () => {
        vi.spyOn(db, 'run').mockImplementation((_, __, callback) => {
            callback(new Error('Database error'));
            return db;
        });

        const response = await request(app).post('/sensor').send({
            name: 'Sensor1',
            deviceID: '12345'
        });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to add sensor' });
    });

    it('should return 200 if sensor is successfully deleted in /sensor/:id', async () => {
        vi.spyOn(db, 'run').mockImplementation(function (_: string, __: unknown[], callback: (err: Error | null) => void) {
            this.changes = 1; // Mock the number of changes
            callback.bind(this)(null); // Call the callback with null error
            return db;
        });

        const response = await request(app).delete('/sensor/1');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Sensor deleted successfully' });
    });

    it('should return 404 if sensor does not exist in /sensor/:id', async () => {
        vi.spyOn(db, 'run').mockImplementation(function (_: string, __: unknown[], callback: (err: Error | null) => void) {
            this.changes = 0; // Mock the number of changes
            callback.bind(this)(null); // Call the callback with null error
            return db;
        });

        const response = await request(app).delete('/sensor/999');
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Sensor not found' });
    });

    it('should return 500 if there is a database error in /sensor/:id', async () => {
        vi.spyOn(db, 'run').mockImplementation((_, __, callback) => {
            callback(new Error('Database error'));
            return db;
        });

        const response = await request(app).delete('/sensor/1');
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Failed to delete sensor' });
    });
});

