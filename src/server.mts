import express from 'express';
import dotenv from 'dotenv';
import routes from 'routes/index.mts';
import { createNamedLogger } from 'utils/logger.mts';
import { initializeDatabase } from 'middleware/databaseInit.mts';
import db from 'middleware/database.mts';
import { setupSwagger } from 'middleware/swagger.mts';

const logger = createNamedLogger('Server');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Use PORT from .env or default to 3000

// Middleware to parse JSON
app.use(express.json());

// Initialize the database
initializeDatabase(db);

// Initialize swagger
setupSwagger(app);

// Example route
app.get('/', (_req, res) => {
    res.send('Welcome to the Nest Temperature Sensor Switcher API!');
});

// Use centralized routes
app.use('/api', routes);

// Log server startup
logger.info('Starting the Nest Temperature Sensor Switcher API server...');

// Start the server
app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});
