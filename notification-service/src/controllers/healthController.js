function health(req, res) {
  res.json({ status: 'ok', service: 'notification-service' });
}

module.exports = { health };
