import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import db from './middleware/database.mjs';
import createSensorRoutes from './api/sensor.mjs';

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
    apis: ['./src/server.mts', './src/api/sensor.mts'], // Path to the API docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Example route
app.get('/', (_req, res) => {
    res.send('Welcome to the Nest Temperature Sensor Switcher API!');
});

// Use the sensor routes from the API folder
app.use('/api', createSensorRoutes(db));

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
