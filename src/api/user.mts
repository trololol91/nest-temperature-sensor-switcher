import express from 'express';
import jwt from 'jsonwebtoken';
import db from 'middleware/database.mts';
import bcrypt from 'bcrypt';
import { storeToken } from 'helper/authHelper.mts';
import { SECRET_KEY } from 'constants.mts';

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

// POST route for user login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ error: 'Missing username or password' });
        return;
    }

    const query = `SELECT id, password FROM users WHERE username = ?`;

    db.get(query, [username], async (err, row: { id: number; password: string } | undefined) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        if (!row) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        try {
            const isPasswordValid = await bcrypt.compare(password, row.password);

            if (isPasswordValid) {
                const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

                try {
                    await storeToken(db, row.id, token, expiresAt);
                    res.status(200).json({ token });
                } catch (storeError) {
                    console.error('Error storing token:', storeError);
                    res.status(500).json({ error: 'Internal server error' });
                }
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        } catch (error) {
            console.error('Error comparing password:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
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
router.post('/create-account', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        res.status(400).json({ error: 'Missing username, password, or email' });
        return;
    }

    try {
        // Hash the password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        const query = `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`;

        db.run(query, [username, hashedPassword, email], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(409).json({ error: 'Username or email already exists' });
                } else {
                    res.status(500).json({ error: 'Failed to create account' });
                }
                return;
            }

            res.status(201).json({ message: 'Account created successfully', userId: this.lastID });
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).json({ error: 'Failed to hash password' });
    }
});

export default router;
