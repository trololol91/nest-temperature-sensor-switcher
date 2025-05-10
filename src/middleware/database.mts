import sqlite3 from 'sqlite3';

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

export default db;
