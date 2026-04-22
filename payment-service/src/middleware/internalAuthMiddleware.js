function internalAuthMiddleware(req, res, next) {
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expectedToken) {
    return next();
  }

  const token = req.header('X-Internal-Token');
  if (!token || token !== expectedToken) {
    return res.status(401).json({ message: 'Unauthorized internal call' });
  }

  return next();
}

module.exports = internalAuthMiddleware;
