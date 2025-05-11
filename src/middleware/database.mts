import sqlite3 from 'sqlite3';
import { createNamedLogger } from 'utils/logger.mts';
import fs from 'fs';
import path from 'path';
import { getProjectRoot } from 'constants.mts';

const logger = createNamedLogger('Database');

// Ensure the 'resource' directory exists in the root of the project
const resourceDir = path.resolve(getProjectRoot(), 'resource');
if (!fs.existsSync(resourceDir)) {
    fs.mkdirSync(resourceDir);
    logger.info(`Created 'resource' directory at ${resourceDir}`);
}

const db = new sqlite3.Database(path.join(resourceDir, 'encrypted-sensors.db'), (err) => {
    if (err) {
        logger.error('Error opening database:', err.message);
    } else {
        logger.info('Connected to the encrypted SQLite database.');

        // Create a table for sensors
        db.run(`CREATE TABLE IF NOT EXISTS sensors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            deviceID TEXT NOT NULL
        )`, (err) => {
            if (err) {
                logger.error('Error creating sensors table:', err.message);
            } else {
                logger.info('Sensors table created or already exists.');
            }
        });
    }
});

export default db;
