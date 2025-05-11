import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import sqlite3 from 'sqlite3';
import request from 'supertest';
import createSensorRoutes from './sensor.mjs';

vi.mock('sqlite3', () => {
    const Database = vi.fn();
    Database.prototype.get = vi.fn();
    Database.prototype.all = vi.fn();
    Database.prototype.run = vi.fn();
    return { Database };
});

vi.mock('../utils/logger.mjs', () => ({
    createNamedLogger: () => ({
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

describe('Sensor Routes', () => {
    let db;
    let app;

    beforeEach(() => {
        db = new sqlite3.Database(':memory:');
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
});

