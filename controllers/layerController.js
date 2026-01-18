const pool = require('../config/db');

// 1. ADD A NEW POINT
exports.addPoint = async (req, res) => {
    const { name, description, latitude, longitude } = req.body;
    const userId = req.user.id; // Got this from the token!

    try {
        const newPoint = await pool.query(
            `INSERT INTO points_of_interest (name, description, geom, user_id)
             VALUES ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326), $5)
             RETURNING id, name, description`,
            [name, description, latitude, longitude, userId]
        );
        res.json(newPoint.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// 2. GET POINTS (With Username)
exports.getPoints = async (req, res) => {
    try {
        const userId = req.user.id; // Get logged-in user's ID

        // We JOIN table 'points_of_interest' (p) with 'users' (u)
        const query = `
            SELECT p.id, p.name, p.description, ST_X(p.geom) as lng, ST_Y(p.geom) as lat, u.username 
            FROM points_of_interest p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = $1
        `;

        const points = await pool.query(query, [userId]);
        res.json(points.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
// 3. DELETE A POINT (Only if you own it!)
exports.deletePoint = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const deleteOp = await pool.query(
            'DELETE FROM points_of_interest WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (deleteOp.rows.length === 0) {
            return res.status(403).json({ msg: 'Not authorized to delete this point' });
        }

        res.json({ msg: 'Point deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};