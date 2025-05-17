import express from 'express';
import jwt from 'jsonwebtoken';
import db from 'middleware/database.mts';
import bcrypt from 'bcrypt';
import { storeToken } from 'helper/authHelper.mts';
import { SECRET_KEY } from 'constants.mts';
import { JwtPayload } from 'middleware/auth.mts';

const router = express.Router();

/**
 * @swagger
 * /api/user/login:
 *   post:
 *     summary: Log in a user and return a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: The username of the user.
 *               password:
 *                 type: string
 *                 description: The password of the user.
 *     responses:
 *       200:
 *         description: Login successful, returns a JWT token.
 *       400:
 *         description: Missing username or password.
 *       401:
 *         description: Invalid credentials.
 *       500:
 *         description: Internal server error.
 */

// Define user interface
interface User {
  id: number;
  password: string;
}

// POST route for user login
router.post('/login', (req: express.Request<object, object, { username?: string, password?: string }>, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ error: 'Missing username or password' });
        return;
    }

    try {
        const query = `SELECT id, password FROM users WHERE username = ?`;
        const row = db.prepare<string, User>(query).get(username);

        if (!row) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        bcrypt.compare(password, row.password, (compareErr, isPasswordValid) => {
            if (compareErr) {
                console.error('Error comparing password:', compareErr);
                res.status(500).json({ error: 'Internal server error' });
                return;
            }

            if (isPasswordValid) {
                const payload: JwtPayload = { id: row.id, username };
                const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

                try {
                    storeToken(db, row.id, token, expiresAt);
                    res.status(200).json({ token });
                }
                catch (storeError) {
                    console.error('Error storing token:', storeError);
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
            else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        });
    }
    catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/user/create-account:
 *   post:
 *     summary: Create a new user account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: The username for the new account.
 *               password:
 *                 type: string
 *                 description: The password for the new account.
 *               email:
 *                 type: string
 *                 description: The email address for the new account.
 *     responses:
 *       201:
 *         description: Account created successfully.
 *       400:
 *         description: Missing username, password, or email.
 *       409:
 *         description: Username or email already exists.
 *       500:
 *         description: Failed to create account or hash password.
 */

// POST route for user account creation
interface CreateAccountBody {
  username?: string;
  password?: string;
  email?: string;
}

router.post('/create-account', async (req: express.Request<object, object, CreateAccountBody>, res): Promise<void> => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        res.status(400).json({ error: 'Missing username, password, or email' });
        return;
    }

    try {
    // Hash the password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const query = `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`;
            const result = db.prepare(query).run(username, hashedPassword, email);

            res.status(201).json({
                message: 'Account created successfully',
                userId: result.lastInsertRowid,
            });
        }
        catch (err) {
            if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
                res.status(409).json({ error: 'Username or email already exists' });
            }
            else {
                console.error('Error creating account:', err);
                res.status(500).json({ error: 'Failed to create account' });
            }
        }
    }
    catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).json({ error: 'Failed to hash password' });
    }
});

export default router;
