const express = require('express');
const path = require('path');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');

// Serve admin page (requires admin auth)
router.get('/', (req, res) => {
  if (!req.isAuthenticated()) {
    // Show login page
    return res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin-login.html'));
  }

  if (!req.user.isAdmin) {
    return res.status(403).send('Access denied. You are not an admin.');
  }

  res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin.html'));
});

module.exports = router;
