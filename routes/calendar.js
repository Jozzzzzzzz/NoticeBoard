const express = require('express');
const { isConfigured, getUpcomingEvents } = require('../calendar');

const router = express.Router();

// GET /api/calendar/events
router.get('/events', async (req, res) => {
  if (!isConfigured()) {
    return res.status(501).json({
      error: 'Google Calendar not configured',
      configured: false,
    });
  }

  try {
    const events = await getUpcomingEvents();
    res.json({ configured: true, events });
  } catch (err) {
    res.status(502).json({ error: err.message, configured: true });
  }
});

module.exports = router;
