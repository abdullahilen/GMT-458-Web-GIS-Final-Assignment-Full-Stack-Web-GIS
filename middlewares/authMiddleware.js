const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

module.exports = function (req, res, next) {
    // 1. Get the token from the header
    const token = req.header('Authorization');

    // 2. Check if no token
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // 3. Verify token
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Add the user info to the request
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};