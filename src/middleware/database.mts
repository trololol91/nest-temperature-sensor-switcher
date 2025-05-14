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

const dbPath = path.resolve(getProjectRoot(), 'resource', 'encrypted-sensors.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        logger.error('Error opening database:', err.message);
    } else {
        logger.info('Connected to the SQLite database.');
    }
});

export default db;
