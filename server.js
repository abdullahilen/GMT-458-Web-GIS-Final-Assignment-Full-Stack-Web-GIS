const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // <--- 1. Added this so we can check tokens
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

// --- 2. THE SECURITY FUNCTION (Added directly here to prevent crashes) ---
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ msg: "Access Denied" });

    jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
        if (err) return res.status(403).json({ msg: "Invalid Token" });
        req.user = user;
        next();
    });
}

// --- 3. DELETE & EDIT ROUTES ---

// DELETE Route
app.delete('/api/layer/points/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // Check if point belongs to user
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

// UPDATE Route
// --- GET POINTS (PRIVATE MODE) ---
// We added 'authenticateToken' so we know WHO is asking
app.get('/api/layer/points', authenticateToken, async (req, res) => {
    try {
        // CHANGED: Added "WHERE points.user_id = $1"
        // This ensures the database only returns rows belonging to the logged-in user.
        const result = await db.query(`
            SELECT points.*, users.username 
            FROM points 
            JOIN users ON points.user_id = users.id
            WHERE points.user_id = $1
        `, [req.user.id]); // <--- Pass the User ID here

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
// --- DATABASE SETUP ROUTE (Run this once) ---
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
        res.send("✅ Database Tables Created Successfully!");
 // ... setup route code ...
    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Error: " + err.message);
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});