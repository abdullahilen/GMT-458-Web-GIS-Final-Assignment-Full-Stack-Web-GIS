const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Secret key for signing tokens (In real apps, put this in .env)
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

// ... imports (pool, bcrypt, jwt) remain the same ...

// 1. REGISTER USER (With Email Restriction)
exports.register = async (req, res) => {
    // We treat 'username' as 'email' now
    const { username, password } = req.body;
    const email = username.toLowerCase().trim(); // Clean up the input

    // --- NEW VALIDATION LOGIC ---
    const allowedDomains = [
        'gmail.com', 
        'hotmail.com', 
        'outlook.com', 
        'yahoo.com', 
        'icloud.com'
    ];

    // 1. Check if it looks like an email
    if (!email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // 2. Check the domain
    const domain = email.split('@')[1];
    if (!allowedDomains.includes(domain)) {
        return res.status(400).json({ 
            error: 'Only Gmail, Outlook, Hotmail, Yahoo, and iCloud emails are allowed.' 
        });
    }
    // ----------------------------

    try {
        // A. Check if email already exists
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // B. Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // C. Insert into Database
        const newUser = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [email, hashedPassword, 'user']
        );

        // D. Generate Token
        const token = jwt.sign({ id: newUser.rows[0].id, role: newUser.rows[0].role }, process.env.JWT_SECRET || 'super_secret_key', { expiresIn: '1h' });

        res.status(201).json({ token, user: newUser.rows[0] });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// ... keep the exports.login function exactly as it was ...
// 2. LOGIN USER
exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        // A. Find user
        const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (user.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid Credentials' });
        }

        // B. Check Password
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid Credentials' });
        }

        // C. Generate Token
        const token = jwt.sign({ id: user.rows[0].id, role: user.rows[0].role }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, user: { id: user.rows[0].id, username: user.rows[0].username, role: user.rows[0].role } });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};