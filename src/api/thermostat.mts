import express from 'express';
import { authenticate } from 'middleware/auth.mts';
import db from 'middleware/database.mts';
import { createNamedLogger } from 'utils/logger.mts';
import { JwtPayload } from 'middleware/auth.mts';
import { Request } from 'express';

const router = express.Router();
const logger = createNamedLogger('ThermostatRoutes');

// Apply authentication middleware to all routes
router.use(authenticate);

// Define a type for requests with user property
interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * @swagger
 * /api/thermostat:
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

interface AddThermostatBody {
  thermostatName?: string;
  location?: string;
}

type TotalThermoStatRequest = AddThermostatBody & AuthenticatedRequest;

router.post('/', (req: express.Request<object, object, TotalThermoStatRequest>, res) => {
    const { thermostatName, location } = req.body;
    const userId = req.body.user?.id;
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
        const insertThermostat = db.prepare('INSERT INTO thermostat (name, location) VALUES (?, ?)');
        const result = insertThermostat.run(thermostatName, location ?? null);
        const thermostatId = Number(result.lastInsertRowid);
        const insertUserThermostat = db.prepare('INSERT INTO user_thermostats (user_id, thermostat_id) VALUES (?, ?)');
        insertUserThermostat.run(userId, thermostatId);
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
