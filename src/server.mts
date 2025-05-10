import express from 'express';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Use PORT from .env or default to 3000

// Middleware to parse JSON
app.use(express.json());

// Import necessary modules and utilities
import { changeNestThermostat } from './scripts/changeNestThermostat.mjs';
import { ThermostatDeviceIDs } from './constants.mjs';

// Example route
app.get('/', (_req, res) => {
    res.send('Welcome to the Nest Temperature Sensor Switcher API!');
});

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

// GET route to list available sensors
app.get('/list-sensors', (_req, res) => {
    const sensors = Object.keys(ThermostatDeviceIDs);
    res.status(200).json({ sensors });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
