import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { SECRET_KEY } from 'constants.mts';

// Extend the Request interface to include a 'user' property
interface AuthenticatedRequest extends Request {
    user?: {
        username: string;
    };
}

// Middleware to check authentication
export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const db = new sqlite3.Database('./resource/encrypted-sensors.db');
        const query = `SELECT * FROM tokens WHERE token = ?`;

        db.get(query, [token], (dbErr, row) => {
            if (dbErr || !row) {
                res.status(403).json({ error: 'Forbidden' });
                return;
            }

            // Attach user information to the request object
            req.user = decoded as { username: string };
            next();
        });
    });
};
