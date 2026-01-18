const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// --- 1. DATABASE CONNECTION ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render
});

const db = {
    query: (text, params) => pool.query(text, params),
};

// --- 2. MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- 3. AUTHENTICATION ROUTES ---

// REGISTER
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Check if user exists
        const userCheck = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) return res.status(400).json({ msg: "User already exists" });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save User
        const newUser = await db.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );

        // Auto-Login (Generate Token)
        const token = jwt.sign({ id: newUser.rows[0].id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        res.json({ token, user: newUser.rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (user.rows.length === 0) return res.status(400).json({ msg: "User not found" });

        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

        const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        res.json({ token, user: user.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// --- 4. SECURITY MIDDLEWARE ---
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ msg: "Access Denied" });

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err) return res.status(403).json({ msg: "Invalid Token" });
        req.user = user;
        next();
    });
}

// --- 5. MAP DATA ROUTES (The Fix: Using table 'points') ---

// GET POINTS (Private)
app.get('/api/layer/points', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT points.*, users.username 
            FROM points 
            JOIN users ON points.user_id = users.id
            WHERE points.user_id = $1
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// ADD POINT
app.post('/api/layer/points', authenticateToken, async (req, res) => {
    try {
        const { name, description, latitude, longitude } = req.body;
        
        // Fetch username for display
        const userRes = await db.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
        const username = userRes.rows[0].username;

        const newPoint = await db.query(
            'INSERT INTO points (name, description, lat, lng, user_id, username) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, description, latitude, longitude, req.user.id, username]
        );
        res.json(newPoint.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// EDIT POINT
app.put('/api/layer/points/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        
        const result = await db.query(
            'UPDATE points SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
            [name, description, id, req.user.id]
        );

        if (result.rowCount === 0) return res.status(403).json({ msg: "Not authorized" });
        res.json(result.rows[0]);
    } catch (err) { console.error(err); res.status(500).send("Server Error"); }
});

// DELETE POINT
app.delete('/api/layer/points/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM points WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.user.id]);
        
        if (result.rowCount === 0) return res.status(403).json({ msg: "Not authorized" });
        res.json({ msg: "Deleted" });
    } catch (err) { console.error(err); res.status(500).send("Server Error"); }
});

// --- 6. SETUP ROUTE (Run if tables are missing) ---
app.get('/setup-database', async (req, res) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS points (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                description TEXT,
                lat DECIMAL,
                lng DECIMAL,
                user_id INTEGER REFERENCES users(id),
                username VARCHAR(255)
            );
        `);
        res.send("✅ Database Tables Fixed!");
    } catch (err) { console.error(err); res.status(500).send(err.message); }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});