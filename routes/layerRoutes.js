const express = require('express');
const router = express.Router();
const layerController = require('../controllers/layerController');
const auth = require('../middlewares/authMiddleware'); // Import the guard

// Define URLs
// Notice we add 'auth' to protect these routes!
router.post('/points', auth, layerController.addPoint);
// Add 'auth' here so we know who the user is!
router.get('/points', auth, layerController.getPoints); // Anyone can view
router.delete('/points/:id', auth, layerController.deletePoint);

module.exports = router;