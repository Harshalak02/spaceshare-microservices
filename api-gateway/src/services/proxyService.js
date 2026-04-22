const axios = require('axios');

async function forwardRequest(serviceUrl, req, res) {
  if (!serviceUrl) {
    return res.status(500).json({ message: 'Gateway misconfiguration: service URL missing' });
  }

  let forwardedPath = req.originalUrl;

  // 🔥 Route-specific path rewriting
  if (req.originalUrl.startsWith('/api/auth')) {
    forwardedPath = req.originalUrl.replace(/^\/api\/auth/, '');
  } else if (req.originalUrl.startsWith('/api/listings')) {
    forwardedPath = req.originalUrl.replace(/^\/api\/listings/, '');
  } else if (req.originalUrl.startsWith('/api/subscriptions/subscribe')) {
  forwardedPath = req.originalUrl.replace('/api/subscriptions', '');
}

  try {
    const response = await axios({
      method: req.method,
      url: `${serviceUrl}${forwardedPath}`,
      data: req.body,
      params: req.query,
      timeout: 5000,
      headers: {
        Authorization: req.headers.authorization || '',
        'Content-Type': 'application/json'
      }
    });

    return res.status(response.status).json(response.data);

  } catch (error) {
    console.error("❌ Gateway error:", error.message);

    const status = error.response?.status || 500;
    const message = error.response?.data || { message: 'Gateway error' };

    return res.status(status).json(message);
  }
}

module.exports = { forwardRequest };