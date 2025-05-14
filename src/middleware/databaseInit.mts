import sqlite3 from 'sqlite3';
import { createNamedLogger } from 'utils/logger.mts';

const logger = createNamedLogger('DatabaseInit');

export const initializeDatabase = (db: sqlite3.Database): void => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS sensors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            deviceID TEXT NOT NULL
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
        )`
    ];

    queries.forEach((query) => {
        db.run(query, (err) => {
            if (err) {
                logger.error(`Error executing query: ${query}`, err.message);
            } else {
                logger.debug(`Successfully executed query: ${query}`);
            }
        });
    });
};
