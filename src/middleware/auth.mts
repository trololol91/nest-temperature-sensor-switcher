import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { SECRET_KEY } from 'constants.mts';
import path from 'path';
import { getProjectRoot } from 'constants.mts';

// Interface for the data signed in the JWT token
export interface JwtPayload {
  id: number; // user id
  username: string;
  // add other fields as needed
}

// Extend the Request interface to include a 'user' property
interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Middleware to check authentication
export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        try {
            const dbPath = path.resolve(getProjectRoot(), 'resource', 'encrypted-sensors.db');
            const db = new Database(dbPath);
            const query = `SELECT * FROM tokens WHERE token = ?`;
            const row = db.prepare(query).get(token);

            if (!row) {
                res.status(403).json({ error: 'Forbidden' });
                return;
            }

            // Attach user information to the request object
            req.user = decoded as JwtPayload;
            next();
        }
        catch (dbErr) {
            console.error('Database error:', dbErr);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
};
