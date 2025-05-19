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
 * tags:
 *   - name: Thermostats
 *     description: API endpoints for managing thermostats
 * 
 * components:
 *   schemas:
 *     Thermostat:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The thermostat ID *         thermostatName:
 *           type: string
 *           description: The name of the thermostat
 *         location:
 *           type: string
 *           nullable: true
 *           description: The physical location of the thermostat
 *         deviceId:
 *           type: string
 *           nullable: true
 *           description: The device ID of the thermostat
 *       required:
 *         - id
 *         - thermostatName
 * 
 * /api/thermostat:
 *   get:
 *     tags:
 *       - Thermostats
 *     summary: Get all thermostats for the current logged-in user
 *     description: Returns a list of all thermostats owned by or shared with the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of thermostats associated with the user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Thermostat'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Failed to retrieve thermostats
 *   post:
 *     tags:
 *       - Thermostats
 *     summary: Add a thermostat to the current logged-in user
 *     description: Creates a new thermostat and associates it with the authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: *               thermostatName:
 *                 type: string
 *                 description: The name of the thermostat to add
 *               location:
 *                 type: string
 *                 description: The location of the thermostat
 *               deviceId:
 *                 type: string
 *                 description: The device ID of the thermostat
 *             required:
 *               - thermostatName
 *               - location
 *               - deviceId
 *     responses:
 *       201:
 *         description: Thermostat added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: The ID of the created thermostat
 *                 thermostatName:
 *                   type: string
 *                   description: The name of the created thermostat *                 location:
 *                   type: string
 *                   description: The location of the created thermostat
 *                 deviceId:
 *                   type: string
 *                   description: The device ID of the created thermostat *       400:
 *         description: Bad request - Missing required fields (thermostatName, location, deviceId)
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Failed to add thermostat
 * 
 * /api/thermostat/{id}/assign:
 *   post:
 *     tags:
 *       - Thermostats
 *     summary: Assign a thermostat to another user
 *     description: Shares a thermostat with another user, allowing them to access and control it
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the thermostat to assign
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: The ID of the user to assign the thermostat to
 *             required:
 *               - userId
 *     responses:
 *       200:
 *         description: Thermostat assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 thermostatId:
 *                   type: integer
 *                   description: The ID of the assigned thermostat
 *                 assignedToUserId:
 *                   type: integer
 *                   description: The ID of the user the thermostat was assigned to
 *       400:
 *         description: Bad request - Invalid thermostat ID or missing user ID
 *       401:
 *         description: Unauthorized - User not authenticated
 *       403:
 *         description: Forbidden - User does not own the thermostat
 *       404:
 *         description: Not found - Thermostat or target user not found
 *       409:
 *         description: Conflict - Thermostat is already assigned to the target user
 *       500:
 *         description: Failed to assign thermostat
 */

// GET endpoint to retrieve all thermostats for a user
router.get('/', (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        res.status(401).json({ error: 'Missing user context' });
        return;
    }    try {
        const query = `
            SELECT t.id, t.name as thermostatName, t.location, t.deviceId
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
  thermostatName: string;
  location: string;
  deviceId: string;
}

router.post('/', (req: AuthenticatedRequest<object, object, AddThermostatBody>, res) => {
    const { thermostatName, location, deviceId } = req.body;
    const userId = req.user?.id;
    
    // Check all required fields
    if (!thermostatName) {
        res.status(400).json({ error: 'Missing thermostatName' });
        return;
    }
    if (!location) {
        res.status(400).json({ error: 'Missing location' });
        return;
    }
    if (!deviceId) {
        res.status(400).json({ error: 'Missing deviceId' });
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
        const insertThermostat = db.prepare('INSERT INTO thermostat (name, location, deviceId) VALUES (?, ?, ?)');
        const result = insertThermostat.run(thermostatName, location, deviceId);
        const thermostatId = Number(result.lastInsertRowid);

        // Link the thermostat to the user
        const insertUserThermostat = db.prepare('INSERT INTO user_thermostats (user_id, thermostat_id) VALUES (?, ?)');
        insertUserThermostat.run(userId, thermostatId);

        // Commit transaction
        db.prepare('COMMIT').run();
        res.status(201).json({ id: thermostatId, thermostatName, location, deviceId });
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
