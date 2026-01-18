const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const { Pool } = require('pg');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. DATABASE CONNECTION ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
const db = { query: (text, params) => pool.query(text, params) };

// --- 2. MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- 3. SWAGGER CONFIGURATION (HARDCODED TO PREVENT ERRORS) ---
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Web GIS API',
            version: '1.0.0',
            description: 'API for managing spatial points with User Roles',
        },
        servers: [{ url: `https://gmt-458-web-gis-final-assignment-full.onrender.com` }],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
            }
        },
        security: [{ bearerAuth: [] }],
        paths: {
            '/api/auth/register': {
                post: {
                    summary: 'Register a new user',
                    tags: ['Auth'],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        username: { type: 'string' },
                                        password: { type: 'string' },
                                        role: { type: 'string', enum: ['user', 'admin', 'guest'] }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: { description: 'User created' }
                    }
                }
            },
            '/api/auth/login': {
                post: {
                    summary: 'Login to get a Token',
                    tags: ['Auth'],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        username: { type: 'string' },
                                        password: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: { description: 'Login successful' }
                    }
                }
            },
            '/api/layer/points': {
                get: {
                    summary: 'Get all points (Admin sees all, User sees own)',
                    tags: ['Points'],
                    responses: {
                        200: { description: 'List of points' }
                    }
                },
                post: {
                    summary: 'Create a point',
                    tags: ['Points'],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        description: { type: 'string' },
                                        latitude: { type: 'number' },
                                        longitude: { type: 'number' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: { description: 'Point created' }
                    }
                }
            },
            '/api/layer/points/{id}': {
                delete: {
                    summary: 'Delete a point',
                    tags: ['Points'],
                    parameters: [
                        {
                            in: 'path',
                            name: 'id',
                            required: true,
                            schema: { type: 'integer' }
                        }
                    ],
                    responses: {
                        200: { description: 'Deleted' }
                    }
                }
            }
        }
    },
    apis: [], // EMPTY ARRAY: We are NOT reading external files anymore.
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// --- 4. AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const assignedRole = role || 'user'; 

        const userCheck = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) return res.status(400).json({ msg: "User already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await db.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hashedPassword, assignedRole]
        );

        const token = jwt.sign({ id: newUser.rows[0].id, role: assignedRole }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        res.json({ token, user: newUser.rows[0] });

    } catch (err) { console.error(err); res.status(500).send("Server Error"); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (user.rows.length === 0) return res.status(400).json({ msg: "User not found" });

        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

        const token = jwt.sign({ id: user.rows[0].id, role: user.rows[0].role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        res.json({ token, user: user.rows[0] });
    } catch (err) { console.error(err); res.status(500).send("Server Error"); }
});

// --- 5. MIDDLEWARE ---
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ msg: "Access Denied" });

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err) return res.status(403).json({ msg: "Invalid Token" });
        req.user = user;
        next();
    });
}

// --- 6. SPATIAL ROUTES ---
app.get('/api/layer/points', authenticateToken, async (req, res) => {
    try {
        let query;
        let params = [];
        if (req.user.role === 'admin') {
            query = `SELECT points.*, users.username FROM points JOIN users ON points.user_id = users.id`;
        } else {
            query = `SELECT points.*, users.username FROM points JOIN users ON points.user_id = users.id WHERE points.user_id = $1`;
            params = [req.user.id];
        }
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) { console.error(err); res.status(500).send("Server Error"); }
});

app.post('/api/layer/points', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'guest') return res.status(403).json({ msg: "Guests cannot create data" });

        const { name, description, latitude, longitude } = req.body;
        const userRes = await db.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
        
        const newPoint = await db.query(
            'INSERT INTO points (name, description, lat, lng, user_id, username) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, description, latitude, longitude, req.user.id, userRes.rows[0].username]
        );
        res.json(newPoint.rows[0]);
    } catch (err) { console.error(err); res.status(500).send("Server Error"); }
});

app.delete('/api/layer/points/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        let result;

        if (req.user.role === 'admin') {
            result = await db.query('DELETE FROM points WHERE id = $1 RETURNING *', [id]);
        } else if (req.user.role === 'guest') {
             return res.status(403).json({ msg: "Guests cannot delete" });
        } else {
            result = await db.query('DELETE FROM points WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.user.id]);
        }
        
        if (result.rowCount === 0) return res.status(403).json({ msg: "Not authorized or Not Found" });
        res.json({ msg: "Deleted" });
    } catch (err) { console.error(err); res.status(500).send("Server Error"); }
});

// Setup Route
app.get('/setup-database', async (req, res) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
            CREATE TABLE IF NOT EXISTS points (id SERIAL PRIMARY KEY, name VARCHAR(255), description TEXT, lat DECIMAL, lng DECIMAL, user_id INTEGER REFERENCES users(id), username VARCHAR(255));
        `);
        res.send("✅ Database Tables & Roles Ready!");
    } catch (err) { console.error(err); res.status(500).send(err.message); }
});

app.listen(PORT, () => { console.log(`🚀 Server running on port ${PORT}`); })