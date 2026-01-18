const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken'); 
require('dotenv').config();

// Import database connection
const db = require('./config/db');

const layerRoutes = require('./routes/layerRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); 
app.use(express.static('public')); 

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/layer', layerRoutes);

// --- SECURITY FUNCTION ---
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ msg: "Access Denied" });

    jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
        if (err) return res.status(403).json({ msg: "Invalid Token" });
        req.user = user;
        next();
    });
}

// --- DELETE & EDIT ROUTES ---

// 1. DELETE Route
app.delete('/api/layer/points/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM points WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.user.id]);
        
        if (result.rowCount === 0) {
            return res.status(403).json({ msg: "Not authorized or point not found" });
        }
        res.json({ msg: "Point deleted" });
    } catch (err) { 
        console.error(err); 
        res.status(500).send("Server Error"); 
    }
});

// 2. UPDATE (Edit) Route - (This was missing!)
app.put('/api/layer/points/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        
        const result = await db.query(
            'UPDATE points SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
            [name, description, id, req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ msg: "Not authorized or point not found" });
        }
        res.json(result.rows[0]);
    } catch (err) { 
        console.error(err); 
        res.status(500).send("Server Error"); 
    }
});

// 3. GET Route (Private Mode)
app.get('/api/layer/points', authenticateToken, async (req, res) => {
    try {
        // Only return points belonging to the logged-in user
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

// Test Route
app.get('/', (req, res) => {
    res.send('API is running...');
});

// --- ROBUST DATABASE SETUP ROUTE ---
app.get('/setup-database', async (req, res) => {
    try {
        // 1. Create Users Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
        `);
        
        // 2. Fix 'role' column if missing
        try {
            await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';`);
        } catch (e) { console.log("Role column likely exists"); }

        // 3. Create Points Table (The likely culprit!)
        await db.query(`
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

        res.send("✅ Database Tables Verified & Fixed!");
    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Setup Failed: " + err.message);
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});