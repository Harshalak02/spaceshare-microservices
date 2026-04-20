function health(req, res) {
  res.json({ status: 'ok', service: 'analytics-service' });
}

module.exports = { health };
