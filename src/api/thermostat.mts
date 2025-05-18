import express from 'express';
import { authenticate, AuthenticatedRequest } from 'middleware/auth.mts';
import db from 'middleware/database.mts';
import { createNamedLogger } from 'utils/logger.mts';

const router = express.Router();
const logger = createNamedLogger('ThermostatRoutes');

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/thermostat:
 *   get:
 *     summary: Get all thermostats for the current logged-in user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of thermostats associated with the user.
 *       401:
 *         description: Unauthorized - User not authenticated.
 *       500:
 *         description: Failed to retrieve thermostats.
 *   post:
 *     summary: Add a thermostat to the current logged-in user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: thermostatName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the thermostat to add.
 *       - in: query
 *         name: location
 *         required: false
 *         schema:
 *           type: string
 *         description: The location of the thermostat to add.
 *     responses:
 *       201:
 *         description: Thermostat added successfully.
 *       400:
 *         description: Missing thermostatName in the query.
 *       500:
 *         description: Failed to add thermostat.
 */

// GET endpoint to retrieve all thermostats for a user
router.get('/', (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        res.status(401).json({ error: 'Missing user context' });
        return;
    }

    try {
        const query = `
            SELECT t.id, t.name as thermostatName, t.location
            FROM thermostat t
            JOIN user_thermostats ut ON t.id = ut.thermostat_id
            WHERE ut.user_id = ?
        `;
        
        const thermostats = db.prepare(query).all(userId);
        res.status(200).json(thermostats);
    } catch (err) {
        logger.error('Error retrieving thermostats for user:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: 'Failed to retrieve thermostats' });
    }
});

interface AddThermostatBody {
  thermostatName?: string;
  location?: string;
}

router.post('/', (req: AuthenticatedRequest<object, object, AddThermostatBody>, res) => {
    const { thermostatName, location } = req.body;
    const userId = req.user?.id;
    if (!thermostatName) {
        res.status(400).json({ error: 'Missing thermostatName' });
        return;
    }
    if (!userId) {
        res.status(400).json({ error: 'Missing user context' });
        return;
    }
    try {
        // Start transaction
        db.prepare('BEGIN TRANSACTION').run();

        // Insert the new thermostat
        const insertThermostat = db.prepare('INSERT INTO thermostat (name, location) VALUES (?, ?)');
        const result = insertThermostat.run(thermostatName, location ?? null);
        const thermostatId = Number(result.lastInsertRowid);

        // Link the thermostat to the user
        const insertUserThermostat = db.prepare('INSERT INTO user_thermostats (user_id, thermostat_id) VALUES (?, ?)');
        insertUserThermostat.run(userId, thermostatId);

        // Commit transaction
        db.prepare('COMMIT').run();
        res.status(201).json({ id: thermostatId, thermostatName, location });
    }
    catch (err) {
        db.prepare('ROLLBACK').run();
        logger.error('Error adding thermostat or linking to user:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: 'Failed to add thermostat or link to user' });
    }
});

export default router;
