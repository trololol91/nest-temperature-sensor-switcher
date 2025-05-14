import sqlite3 from 'sqlite3';

/**
 * Stores a token in the database with its associated user ID and expiration time.
 * @param db - The SQLite database instance.
 * @param userId - The ID of the user.
 * @param token - The JWT token to store.
 * @param expiresAt - The expiration time of the token.
 * @returns A promise that resolves when the token is successfully stored or rejects with an error.
 */
export const storeToken = (db: sqlite3.Database, userId: number, token: string, expiresAt: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)`;

        db.run(query, [userId, token, expiresAt], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};
