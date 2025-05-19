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
 * components:
 *   schemas:
 *     Thermostat:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the thermostat
 *         thermostatName:
 *           type: string
 *           description: The name of the thermostat
 *         location:
 *           type: string
 *           description: Physical location of the thermostat
 *         deviceId:
 *           type: string
 *           description: Unique device identifier in the Nest system
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT token authentication required for all thermostat operations
 * 
 * tags:
 *   - name: Thermostats
 *     description: Operations related to Nest thermostats management
 * 
 * security:
 *   - bearerAuth: []
 */

/**
 * @swagger
 * /api/thermostat:
 *   get:
 *     tags: [Thermostats]
 *     summary: Retrieve all thermostats for the authenticated user
 *     description: Returns a list of all thermostats associated with the authenticated user's account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of thermostats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Thermostat'
 *             example:
 *               - id: 1
 *                 thermostatName: "Living Room"
 *                 location: "First Floor"
 *                 deviceId: "T3.C25pRGVcdHJzdGO4OTE4"
 *               - id: 2
 *                 thermostatName: "Bedroom"
 *                 location: "Second Floor"
 *                 deviceId: "T3.X82sRVFjdTZnOGO5YTE2"
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing user context"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve thermostats"
 */
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

/**
 * @swagger
 * /api/thermostat:
 *   post:
 *     tags: [Thermostats]
 *     summary: Create a new thermostat
 *     description: Adds a new thermostat to the system and associates it with the authenticated user's account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               thermostatName:
 *                 type: string
 *                 description: The name of the thermostat
 *                 example: "Main Floor"
 *               location:
 *                 type: string
 *                 description: Physical location of the thermostat
 *                 example: "Living Room"
 *               deviceId:
 *                 type: string
 *                 description: Unique device identifier in the Nest system
 *                 example: "T3.D58pYGftdUVndB4MWE5"
 *             required:
 *               - thermostatName
 *               - location
 *               - deviceId
 *     responses:
 *       201:
 *         description: Thermostat created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Thermostat'
 *             example:
 *               id: 3
 *               thermostatName: "Main Floor"
 *               location: "Living Room"
 *               deviceId: "T3.D58pYGftdUVndB4MWE5"
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               missingName:
 *                 value:
 *                   error: "Missing thermostatName"
 *               missingLocation:
 *                 value:
 *                   error: "Missing location"
 *               missingDeviceId:
 *                 value:
 *                   error: "Missing deviceId"
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing user context"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to add thermostat or link to user"
 */
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
 * @swagger
 * /api/thermostat/{id}/assign:
 *   post:
 *     tags: [Thermostats]
 *     summary: Assign a thermostat to another user
 *     description: Allows a user to share or transfer ownership of a thermostat to another user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique ID of the thermostat to assign
 *         example: 1
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
 *                 example: 42
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
 *                   example: "Thermostat assigned successfully"
 *                 thermostatId:
 *                   type: integer
 *                   example: 1
 *                 assignedToUserId:
 *                   type: integer
 *                   example: 42
 *       400:
 *         description: Missing target user ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing target user ID"
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing user context"
 *       403:
 *         description: Not authorized to assign this thermostat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "You do not own this thermostat"
 *       404:
 *         description: Thermostat not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Thermostat not found"
 *       409:
 *         description: Thermostat already assigned to this user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Thermostat is already assigned to the target user"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to assign thermostat"
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
