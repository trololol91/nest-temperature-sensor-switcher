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
 * 
 * /api/thermostat/{id}/assign:
 *   post:
 *     summary: Assign a thermostat to another user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the thermostat to assign.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: The ID of the user to assign the thermostat to.
 *             required:
 *               - userId
 *     responses:
 *       200:
 *         description: Thermostat assigned successfully.
 *       400:
 *         description: Missing user ID or thermostat not found.
 *       403:
 *         description: User does not own the thermostat.
 *       404:
 *         description: Target user not found or thermostat not found.
 *       500:
 *         description: Failed to assign thermostat.
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

/**
 * Interface for the request body when assigning a thermostat to another user
 */
interface AssignThermostatBody {
  userId: number;
}

/**
 * POST endpoint to assign a thermostat to another user
 * This allows a user to transfer/share ownership of a thermostat with another user
 */
router.post('/:id/assign', (req: AuthenticatedRequest<{id: string}, object, AssignThermostatBody>, res) => {
    const thermostatId = parseInt(req.params.id, 10);
    const { userId: targetUserId } = req.body;
    const currentUserId = req.user?.id;
    
    // Validate input parameters
    if (!targetUserId) {
        res.status(400).json({ error: 'Missing target user ID' });
        return;
    }
    
    if (!currentUserId) {
        res.status(401).json({ error: 'Missing user context' });
        return;
    }

    if (isNaN(thermostatId)) {
        res.status(400).json({ error: 'Invalid thermostat ID' });
        return;
    }

    try {
        // Start transaction
        db.prepare('BEGIN TRANSACTION').run();
        
        // 1. Check if the thermostat exists
        const thermostatQuery = 'SELECT id FROM thermostat WHERE id = ?';
        const thermostat = db.prepare(thermostatQuery).get(thermostatId);
        
        if (!thermostat) {
            db.prepare('ROLLBACK').run();
            res.status(404).json({ error: 'Thermostat not found' });
            return;
        }
        
        // 2. Check if the current user owns the thermostat
        const ownershipQuery = 'SELECT * FROM user_thermostats WHERE user_id = ? AND thermostat_id = ?';
        const ownership = db.prepare(ownershipQuery).get(currentUserId, thermostatId);
        
        if (!ownership) {
            db.prepare('ROLLBACK').run();
            res.status(403).json({ error: 'You do not own this thermostat' });
            return;
        }
        
        // 3. Check if the target user already has access to this thermostat
        const existingAssignmentQuery = 'SELECT * FROM user_thermostats WHERE user_id = ? AND thermostat_id = ?';
        const existingAssignment = db.prepare(existingAssignmentQuery).get(targetUserId, thermostatId);
        
        if (existingAssignment) {
            db.prepare('ROLLBACK').run();
            res.status(409).json({ error: 'Thermostat is already assigned to the target user' });
            return;
        }
        
        // 4. Assign the thermostat to the target user
        const assignQuery = 'INSERT INTO user_thermostats (user_id, thermostat_id) VALUES (?, ?)';
        db.prepare(assignQuery).run(targetUserId, thermostatId);
        
        // Commit transaction
        db.prepare('COMMIT').run();
        
        res.status(200).json({ 
            message: 'Thermostat assigned successfully',
            thermostatId,
            assignedToUserId: targetUserId
        });
        return;
    } catch (err) {
        db.prepare('ROLLBACK').run();
        logger.error('Error assigning thermostat:', err instanceof Error ? err.message : err);
        res.status(500).json({ error: 'Failed to assign thermostat' });
        return;
    }
});

export default router;
