import express from 'express';
import { authenticate } from 'middleware/auth.mts';
import { changeNestThermostat } from 'scripts/changeNestThermostat.mts';
import { createNamedLogger } from 'utils/logger.mts';
import db from 'middleware/database.mts';

const router = express.Router();
const logger = createNamedLogger('SensorRoutes');

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 * security:
 *   - bearerAuth: []
 */

// POST route to change the active temperature sensor
/**
 * @swagger
 * /api/sensor/change-sensor:
 *   post:
 *     summary: Change the active temperature sensor.
 *     security:
 *       - bearerAuth: []
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

// POST route for user account creation
interface ChangeSensorBody {
  sensorName?: string;
}

router.post('/change-sensor', async (req: express.Request<object, object, ChangeSensorBody>, res) => {
    const { sensorName } = req.body;
    if (!sensorName) {
        res.status(400).json({ error: 'Missing sensorName' });
        return;
    }

    try {
        const row = db.prepare<string, { deviceID: string }>('SELECT deviceID FROM sensors WHERE name = ?').get(sensorName);
        if (!row) {
            res.status(404).json({ error: 'Sensor not found' });
            return;
        }
        await changeNestThermostat(row.deviceID, 'DEVICE_CCA7C100002935B9', true); // Assuming headless mode
        res.status(200).json({ message: `Temperature sensor changed to sensorName: ${sensorName}` });
    }
    catch (error) {
        logger.error('Error changing temperature sensor:', (error instanceof Error ? error.message : error));
        res.status(500).json({ error: 'Failed to change temperature sensor' });
    }
});

// GET route to list only sensor names
/**
 * @swagger
 * /api/sensor/sensor-names:
 *   get:
 *     summary: Get a list of all sensor names.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of sensor names.
 *       500:
 *         description: Failed to fetch sensor names.
 */

router.get('/sensor-names', (_req, res) => {
    try {
    // For queries without parameters, keep the same type structure as existing code
        const rows = db.prepare<unknown[], { name: string }>('SELECT name FROM sensors').all();
        const sensorNames = rows.map(row => row.name);
        res.status(200).json({ sensorNames });
    }
    catch (err) {
        logger.error('Error fetching sensor names:', (err instanceof Error ? err.message : err));
        res.status(500).json({ error: 'Failed to fetch sensor names' });
    }
});

// GET route to fetch all sensors
/**
 * @swagger
 * /api/sensor:
 *   get:
 *     summary: Get a list of all sensors.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of sensors.
 *       500:
 *         description: Failed to fetch sensors.
 */
router.get('/', (_req, res) => {
    try {
        interface Sensor {
        id: number;
        name: string;
        deviceID: string;
        thermostat_id: number | null;
        }
        const rows = db.prepare<unknown[], Sensor>('SELECT * FROM sensors').all();
        res.status(200).json({ sensors: rows });
    } catch (err) {
        logger.error('Error fetching sensors:', (err instanceof Error ? err.message : err));
        res.status(500).json({ error: 'Failed to fetch sensors' });
    }
});

// POST route to add a new sensor
/**
 * @swagger
 * /api/sensor:
 *   post:
 *     summary: Add a new sensor.
 *     security:
 *       - bearerAuth: []
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

interface AddSensorBody {
  name?: string;
  deviceID?: string;
}

router.post('/', (req: express.Request<object, object, AddSensorBody>, res) => {
    const { name, deviceID } = req.body;
    if (!name || !deviceID) {
        res.status(400).json({ error: 'Missing name or deviceID' });
        return;
    }
    try {
        const result = db.prepare('INSERT INTO sensors (name, deviceID) VALUES (?, ?)').run(name, deviceID);
        res.status(201).json({ id: result.lastInsertRowid, name, deviceID });
    }
    catch (err) {
        logger.error('Error adding sensor:', (err instanceof Error ? err.message : err));
        res.status(500).json({ error: 'Failed to add sensor' });
    }
});

// DELETE route to remove a sensor by ID
/**
 * @swagger
 * /api/sensor/{id}:
 *   delete:
 *     summary: Delete a sensor by ID.
 *     security:
 *       - bearerAuth: []
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
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        const result = db.prepare('DELETE FROM sensors WHERE id = ?').run(id);
        if (result.changes === 0) {
            res.status(404).json({ error: 'Sensor not found' });
            return;
        }
        res.status(200).json({ message: 'Sensor deleted successfully' });
    }
    catch (err) {
        logger.error('Error deleting sensor:', (err instanceof Error ? err.message : err));
        res.status(500).json({ error: 'Failed to delete sensor' });
    }
});

export default router;
