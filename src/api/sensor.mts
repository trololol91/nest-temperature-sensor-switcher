import express from 'express';
import { authenticate, AuthenticatedRequest } from 'middleware/auth.mts';
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
 *   schemas:
 *     Sensor:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the sensor
 *         name:
 *           type: string
 *           description: Friendly name of the sensor
 *         deviceID:
 *           type: string
 *           description: Unique device identifier in the Nest system
 *         thermostat_id:
 *           type: integer
 *           description: ID of the thermostat this sensor is associated with
 *     SensorNames:
 *       type: object
 *       properties:
 *         sensorNames:
 *           type: array
 *           items:
 *             type: string
 *           description: List of sensor names available to the user
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT token authentication
 * 
 * security:
 *   - bearerAuth: []
 * 
 * tags:
 *   - name: Sensors
 *     description: Operations related to temperature sensors
 */

// POST route to change the active temperature sensor
/**
 * @swagger
 * /api/sensor/change-sensor:
 *   post:
 *     tags: [Sensors]
 *     summary: Change the active temperature sensor for a thermostat
 *     description: Activates a different temperature sensor on a Nest thermostat
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
 *                 description: The name of the sensor to activate
 *                 example: "Living Room Sensor"
 *               thermostat_id:
 *                 type: integer
 *                 description: The ID of the thermostat to update
 *                 example: 1
 *             required:
 *               - sensorName
 *               - thermostat_id
 *     responses:
 *       200:
 *         description: Sensor changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success confirmation message
 *                   example: "Temperature sensor changed to: Living Room Sensor for thermostat: Main Floor"
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing sensorName"
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not authenticated"
 *       403:
 *         description: Sensor or thermostat not found or not owned by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Thermostat not found or not owned by the user"
 *       500:
 *         description: Failed to change the sensor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to change temperature sensor"
 */

// POST route for user account creation
interface ChangeSensorBody {
  sensorName?: string;
  thermostat_id?: number;
}

router.post('/change-sensor', async (req: AuthenticatedRequest<object, object, ChangeSensorBody>, res) => {
    const { sensorName, thermostat_id } = req.body;
    const userId = req.user?.id;
    
    if (!sensorName) {
        res.status(400).json({ error: 'Missing sensorName' });
        return;
    }
    
    if (!thermostat_id) {
        res.status(400).json({ error: 'Missing thermostat_id' });
        return;
    }
    
    if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }

    try {
        // First check if the thermostat exists and belongs to the user
        const thermostatQuery = `
            SELECT t.id, t.name, t.deviceID
            FROM thermostat t
            JOIN user_thermostats ut ON t.id = ut.thermostat_id
            WHERE t.id = ? AND ut.user_id = ?
        `;
        
        interface ThermostatInfo {
            id: number;
            name: string;
            deviceID: string;
        }
        
        const thermostat = db.prepare<[number, number], ThermostatInfo>(thermostatQuery).get(thermostat_id, userId);
        
        if (!thermostat) {
            res.status(403).json({ error: 'Thermostat not found or not owned by the user' });
            return;
        }
        
        // Check if the sensor exists, is attached to the specified thermostat, and belongs to the user
        const sensorQuery = `
            SELECT s.deviceID
            FROM sensors s
            WHERE s.name = ? AND s.thermostat_id = ?
        `;
        
        interface SensorDevice {
            deviceID: string;
        }
        
        const sensor = db.prepare<[string, number], SensorDevice>(sensorQuery).get(sensorName, thermostat_id);
        
        if (!sensor) {
            res.status(403).json({ error: 'Sensor not found or not attached to the specified thermostat' });
            return;
        }
        // Use the thermostat deviceID from the query result
        await changeNestThermostat(sensor.deviceID, thermostat.deviceID, true); // Assuming headless mode
        res.status(200).json({ 
            message: `Temperature sensor changed to: ${sensorName} for thermostat: ${thermostat.name}` 
        });
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
 *     tags: [Sensors]
 *     summary: Get a list of all sensor names associated with the user's thermostats
 *     description: Retrieves just the names of all sensors linked to thermostats that the authenticated user has access to
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of sensor names retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SensorNames'
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not authenticated"
 *       500:
 *         description: Failed to fetch sensor names
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch sensor names"
 */

router.get('/sensor-names', (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    
    try {
        // Query sensor names that are linked to thermostats owned by the user
        const query = `
            SELECT s.name
            FROM sensors s
            JOIN thermostat t ON s.thermostat_id = t.id
            JOIN user_thermostats ut ON t.id = ut.thermostat_id
            WHERE ut.user_id = ?
        `;
        
        const rows = db.prepare<number, { name: string }>(query).all(userId);
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
 *     tags: [Sensors]
 *     summary: Get a list of all sensors associated with the user's thermostats
 *     description: Retrieves detailed information about all sensors linked to thermostats that the authenticated user has access to
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of sensors retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sensors:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sensor'
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not authenticated"
 *       500:
 *         description: Failed to fetch sensors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch sensors"
 */
router.get('/', (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    
    try {
        interface Sensor {
            id: number;
            name: string;
            deviceID: string;
            thermostat_id: number | null;
        }
        
        // Query sensors that are linked to thermostats owned by the user
        const query = `
            SELECT s.id, s.name, s.deviceID, s.thermostat_id
            FROM sensors s
            JOIN thermostat t ON s.thermostat_id = t.id
            JOIN user_thermostats ut ON t.id = ut.thermostat_id
            WHERE ut.user_id = ?
        `;
        
        const rows = db.prepare<number, Sensor>(query).all(userId);
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
 *     tags: [Sensors]
 *     summary: Add a new sensor
 *     description: Creates a new temperature sensor and links it to a thermostat owned by the user
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
 *                 description: The friendly name of the sensor
 *                 example: "Bedroom Sensor"
 *               deviceID:
 *                 type: string
 *                 description: The device ID of the sensor in the Nest system
 *                 example: "T3.zxt6QQgVbA3JBCDEFGH"
 *               thermostat_id:
 *                 type: integer
 *                 description: The ID of the thermostat to link the sensor to
 *                 example: 1
 *             required:
 *               - name
 *               - deviceID
 *               - thermostat_id
 *     responses:
 *       201:
 *         description: Sensor added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sensor'
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing name or deviceID"
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not authenticated"
 *       403:
 *         description: Thermostat not found or not owned by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Thermostat not found or not owned by the user"
 *       500:
 *         description: Failed to add the sensor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to add sensor"
 */

interface AddSensorBody {
  name?: string;
  deviceID?: string;
  thermostat_id?: number;
}

router.post('/', (req: AuthenticatedRequest<object, object, AddSensorBody>, res) => {
    const { name, deviceID, thermostat_id } = req.body;
    const userId = req.user?.id;
    
    if (!name || !deviceID) {
        res.status(400).json({ error: 'Missing name or deviceID' });
        return;
    }
    
    if (!thermostat_id) {
        res.status(400).json({ error: 'Missing thermostat_id' });
        return;
    }
    
    if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    
    try {
        // First check if the thermostat exists and belongs to the user
        const thermostatQuery = `
            SELECT t.id
            FROM thermostat t
            JOIN user_thermostats ut ON t.id = ut.thermostat_id
            WHERE ut.user_id = ? AND t.id = ?
        `;
        
        const thermostat = db.prepare(thermostatQuery).get(userId, thermostat_id);
        
        if (!thermostat) {
            res.status(403).json({ error: 'Thermostat not found or not owned by the user' });
            return;
        }
        
        // Add the sensor with the thermostat_id
        const result = db.prepare('INSERT INTO sensors (name, deviceID, thermostat_id) VALUES (?, ?, ?)').run(name, deviceID, thermostat_id);
        res.status(201).json({ id: result.lastInsertRowid, name, deviceID, thermostat_id });
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
 *     tags: [Sensors]
 *     summary: Delete a sensor by ID
 *     description: Removes a temperature sensor from the system. Only sensors associated with the user's thermostats can be deleted.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the sensor to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Sensor deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sensor deleted successfully"
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not authenticated"
 *       403:
 *         description: Sensor not found or not owned by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Sensor not found or not owned by the user"
 *       404:
 *         description: Sensor not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Sensor not found"
 *       500:
 *         description: Failed to delete the sensor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to delete sensor"
 */
router.delete('/:id', (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    
    try {
        // First check if the sensor exists and belongs to the user's thermostat
        const sensorQuery = `
            SELECT s.id 
            FROM sensors s
            JOIN thermostat t ON s.thermostat_id = t.id
            JOIN user_thermostats ut ON t.id = ut.thermostat_id
            WHERE s.id = ? AND ut.user_id = ?
        `;
        
        const sensor = db.prepare(sensorQuery).get(id, userId);
        
        if (!sensor) {
            res.status(403).json({ error: 'Sensor not found or not owned by the user' });
            return;
        }
        
        // Delete the sensor
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
