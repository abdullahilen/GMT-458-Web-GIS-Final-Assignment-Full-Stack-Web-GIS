const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// If we are on Render (Production), use the connection string.
// If we are on your computer, use the individual variables.
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: isProduction ? connectionString : undefined,
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
    ssl: isProduction ? { rejectUnauthorized: false } : false // Required for Render
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};