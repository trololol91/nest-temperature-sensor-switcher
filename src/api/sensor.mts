import express from 'express';
import sqlite3 from 'sqlite3';
import { changeNestThermostat } from 'scripts/changeNestThermostat.mts';
import { createNamedLogger } from 'utils/logger.mts';

const logger = createNamedLogger('SensorRoutes');

/**
 * @swagger
 * /api/change-sensor:
 *   post:
 *     summary: Change the active temperature sensor.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sensorName:
 *                 type: string
 *                 description: The name of the sensor to activate.
 *     responses:
 *       200:
 *         description: Sensor changed successfully.
 *       400:
 *         description: Missing sensorName in the request body.
 *       404:
 *         description: Sensor not found.
 *       500:
 *         description: Failed to change the sensor.
 */

/**
 * @swagger
 * /api/sensor-names:
 *   get:
 *     summary: Get a list of all sensor names.
 *     responses:
 *       200:
 *         description: A list of sensor names.
 *       500:
 *         description: Failed to fetch sensor names.
 */

/**
 * @swagger
 * /api/sensors:
 *   get:
 *     summary: Get a list of all sensors.
 *     responses:
 *       200:
 *         description: A list of sensors.
 *       500:
 *         description: Failed to fetch sensors.
 */

/**
 * @swagger
 * /api/sensors:
 *   post:
 *     summary: Add a new sensor.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the sensor.
 *               deviceID:
 *                 type: string
 *                 description: The device ID of the sensor.
 *     responses:
 *       201:
 *         description: Sensor added successfully.
 *       400:
 *         description: Missing name or deviceID in the request body.
 *       500:
 *         description: Failed to add the sensor.
 */

/**
 * @swagger
 * /api/sensors/{id}:
 *   delete:
 *     summary: Delete a sensor by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the sensor to delete.
 *     responses:
 *       200:
 *         description: Sensor deleted successfully.
 *       404:
 *         description: Sensor not found.
 *       500:
 *         description: Failed to delete the sensor.
 */

const createSensorRoutes = (db: sqlite3.Database): express.Router => {
    const router = express.Router();

    router.post('/change-sensor', async (req, res) => {
        const { sensorName } = req.body;
        if (!sensorName) {
            res.status(400).json({ error: 'Missing sensorName' });
            return; 
        }

        // Fetch deviceID from the database based on sensorName
        db.get('SELECT deviceID FROM sensors WHERE name = ?', [sensorName], async (err, row: { deviceID: string } | undefined) => {
            if (err) {
                logger.error('Error fetching sensor from database:', err.message);
                res.status(500).json({ error: 'Failed to fetch sensor' });
                return;
            }
            if (!row) {
                res.status(404).json({ error: 'Sensor not found' });
                return;
            }

            try {
                await changeNestThermostat(row.deviceID, true); // Assuming headless mode
                res.status(200).json({ message: `Temperature sensor changed to sensorName: ${sensorName}` });
                return;
            } catch (error) {
                logger.error('Error changing temperature sensor:', error);
                res.status(500).json({ error: 'Failed to change temperature sensor' });
                return;
            }
        });
    });

    // GET route to list only sensor names
    router.get('/sensor-names', (_req, res) => {
        db.all<{ name: string }>('SELECT name FROM sensors', [], (err, rows) => {
            if (err) {
                logger.error('Error fetching sensor names:', err.message);
                res.status(500).json({ error: 'Failed to fetch sensor names' });
                return; 
            }
            const sensorNames = rows.map(row => row.name);
            res.status(200).json({ sensorNames });
            return; 
        });
    });

    // GET route to fetch all sensors
    router.get('/sensors', (_req, res) => {
        db.all('SELECT * FROM sensors', [], (err, rows) => {
            if (err) {
                logger.error('Error fetching sensors:', err.message);
                res.status(500).json({ error: 'Failed to fetch sensors' });
                return; 
            }
            res.status(200).json({ sensors: rows });
            return; 
        });
    });

    // POST route to add a new sensor
    router.post('/sensors', (req, res) => {
        const { name, deviceID } = req.body;
        if (!name || !deviceID) {
            res.status(400).json({ error: 'Missing name or deviceID' });
            return; 
        }

        db.run('INSERT INTO sensors (name, deviceID) VALUES (?, ?)', [name, deviceID], function (err) {
            if (err) {
                logger.error('Error adding sensor:', err.message);
                res.status(500).json({ error: 'Failed to add sensor' });
                return; 
            }
            res.status(201).json({ id: this.lastID, name, deviceID });
            return; 
        });
    });

    // DELETE route to remove a sensor by ID
    router.delete('/sensors/:id', (req, res) => {
        const { id } = req.params;
        db.run('DELETE FROM sensors WHERE id = ?', [id], function (err) {
            if (err) {
                logger.error('Error deleting sensor:', err.message);
                res.status(500).json({ error: 'Failed to delete sensor' });
                return; 
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Sensor not found' });
                return; 
            }
            res.status(200).json({ message: 'Sensor deleted successfully' });
            return; 
        });
    });

    return router;
};

export default createSensorRoutes;
