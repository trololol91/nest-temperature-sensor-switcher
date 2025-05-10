import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import sqlite3 from 'sqlite3';

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

// Update SQLite database initialization to use an encrypted file
const db = new sqlite3.Database('encrypted-sensors.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the encrypted SQLite database.');

        // Create a table for sensors
        db.run(`CREATE TABLE IF NOT EXISTS sensors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            deviceID TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Error creating sensors table:', err.message);
            } else {
                console.log('Sensors table created successfully.');
            }
        });
    }
});

// Import necessary modules and utilities
import { changeNestThermostat } from './scripts/changeNestThermostat.mjs';

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
    const { sensorId } = req.body;
    if (!sensorId) {
        return res.status(400).json({ error: 'Missing sensorId' });
    }

    // Fix type issue for row.deviceID
    db.get('SELECT deviceID FROM sensors WHERE id = ?', [sensorId], async (err, row: { deviceID: string } | undefined) => {
        if (err) {
            console.error('Error fetching sensor from database:', err.message);
            return res.status(500).json({ error: 'Failed to fetch sensor' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Sensor not found' });
        }

        try {
            await changeNestThermostat(row.deviceID, true); // Assuming headless mode
            res.status(200).json({ message: `Temperature sensor changed to sensorId: ${sensorId}` });
        } catch (error) {
            console.error('Error changing temperature sensor:', error);
            res.status(500).json({ error: 'Failed to change temperature sensor' });
        }
    });
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
 *               sensorId:
 *                 type: string
 *                 description: ID of the sensor to switch to
 *     responses:
 *       200:
 *         description: Successfully changed the temperature sensor
 *       400:
 *         description: Missing sensorId
 *       404:
 *         description: Sensor not found
 *       500:
 *         description: Failed to change temperature sensor
 */

// GET route to list available sensors
app.get('/list-sensors', (_req, res) => {
    db.all('SELECT * FROM sensors', [], (err, rows) => {
        if (err) {
            console.error('Error fetching sensors:', err.message);
            return res.status(500).json({ error: 'Failed to fetch sensors' });
        }
        res.status(200).json({ sensors: rows });
    });
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

// Add GET, POST, DELETE routes for sensors

// GET route to fetch all sensors
app.get('/sensors', (_req, res) => {
    db.all('SELECT * FROM sensors', [], (err, rows) => {
        if (err) {
            console.error('Error fetching sensors:', err.message);
            return res.status(500).json({ error: 'Failed to fetch sensors' });
        }
        res.status(200).json({ sensors: rows });
    });
});

// POST route to add a new sensor
app.post('/sensors', (req, res) => {
    const { name, deviceID } = req.body;
    if (!name || !deviceID) {
        return res.status(400).json({ error: 'Missing name or deviceID' });
    }

    db.run('INSERT INTO sensors (name, deviceID) VALUES (?, ?)', [name, deviceID], function (err) {
        if (err) {
            console.error('Error adding sensor:', err.message);
            return res.status(500).json({ error: 'Failed to add sensor' });
        }
        res.status(201).json({ id: this.lastID, name, deviceID });
    });
});

// DELETE route to remove a sensor by ID
app.delete('/sensors/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM sensors WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('Error deleting sensor:', err.message);
            return res.status(500).json({ error: 'Failed to delete sensor' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Sensor not found' });
        }
        res.status(200).json({ message: 'Sensor deleted successfully' });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
