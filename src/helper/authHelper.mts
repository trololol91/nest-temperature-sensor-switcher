import Database from 'better-sqlite3';

/**
 * Stores a token in the database with its associated user ID and expiration time.
 * @param db - The SQLite database instance.
 * @param userId - The ID of the user.
 * @param token - The JWT token to store.
 * @param expiresAt - The expiration time of the token.
 * @returns void
 */
export const storeToken = (db: Database.Database, userId: number, token: string, expiresAt: string): void => {
    const query = `INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)`;
    db.prepare(query).run(userId, token, expiresAt);
};
