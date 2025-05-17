import Database from 'better-sqlite3';
import { createNamedLogger } from 'utils/logger.mts';

const logger = createNamedLogger('DatabaseInit');

export const initializeDatabase = (db: Database.Database): void => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS sensors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            deviceID TEXT NOT NULL,
            thermostat_id INTEGER,
            FOREIGN KEY (thermostat_id) REFERENCES thermostat (id)
        )`,
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expires_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`,
        `CREATE TABLE IF NOT EXISTS thermostat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS user_thermostats (
            user_id INTEGER NOT NULL,
            thermostat_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, thermostat_id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (thermostat_id) REFERENCES thermostat (id)
        )`,
    ];

    for (const query of queries) {
        try {
            db.prepare(query).run();
            logger.debug(`Successfully executed query: ${query}`);
        }
        catch (err) {
            logger.error(`Error executing query: ${query}`, err instanceof Error ? err.message : err);
        }
    }
};
