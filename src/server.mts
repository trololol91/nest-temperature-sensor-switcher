import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Use PORT from .env or default to 3000

// Middleware to parse JSON
app.use(express.json());

// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Nest Temperature Sensor Switcher API',
            version: '1.0.0',
            description: 'API for managing Nest temperature sensors',
        },
    },
    apis: ['./src/server.mts'], // Path to the API docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Import necessary modules and utilities
import { changeNestThermostat } from './scripts/changeNestThermostat.mjs';
import { ThermostatDeviceIDs } from './constants.mjs';

// Example route
app.get('/', (_req, res) => {
    res.send('Welcome to the Nest Temperature Sensor Switcher API!');
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: Welcome message
 *     responses:
 *       200:
 *         description: Returns a welcome message
 */

// POST route to change temperature sensors
app.post('/change-sensor', async (req, res) => {
    const { deviceName } = req.body;
    if (!deviceName || !ThermostatDeviceIDs[deviceName]) {
        return res.status(400).json({ error: 'Invalid or missing deviceName' });
    }

    try {
        const deviceID = ThermostatDeviceIDs[deviceName];
        await changeNestThermostat(deviceID, true); // Assuming headless mode
        res.status(200).json({ message: `Temperature sensor changed to ${deviceName}` });
    } catch (error) {
        console.error('Error changing temperature sensor:', error);
        res.status(500).json({ error: 'Failed to change temperature sensor' });
    }
});

/**
 * @swagger
 * /change-sensor:
 *   post:
 *     summary: Change the active temperature sensor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceName:
 *                 type: string
 *                 description: Name of the device to switch to
 *     responses:
 *       200:
 *         description: Successfully changed the temperature sensor
 *       400:
 *         description: Invalid or missing deviceName
 *       500:
 *         description: Failed to change temperature sensor
 */

// GET route to list available sensors
app.get('/list-sensors', (_req, res) => {
    const sensors = Object.keys(ThermostatDeviceIDs);
    res.status(200).json({ sensors });
});

/**
 * @swagger
 * /list-sensors:
 *   get:
 *     summary: List available sensors
 *     responses:
 *       200:
 *         description: Returns a list of available sensors
 */

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
