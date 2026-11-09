const express = require('express');
const router = express.Router();
const Session = require('../models/Session');

// GET /api/sessions — get all sessions, newest first
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find().sort({ timestamp: -1 }).limit(50);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions — save a new session
router.post('/', async (req, res) => {
  try {
    const session = new Session(req.body);
    const saved = await session.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions — clear all sessions
router.delete('/', async (req, res) => {
  try {
    await Session.deleteMany({});
    res.json({ message: 'All sessions cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
