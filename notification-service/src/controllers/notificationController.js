const { getNotificationsByUser } = require('../services/notificationService');

async function getByUser(req, res) {
  try {
    const notifications = await getNotificationsByUser(req.params.userId);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
}

module.exports = { getByUser };
