const axios = require('axios');

async function forwardRequest(serviceUrl, req, res) {
  if (!serviceUrl) {
    return res.status(500).json({ message: 'Gateway misconfiguration: service URL missing' });
  }

  // Use originalUrl but strip query string to avoid doubling, while keeping the full path
  let forwardedPath = req.originalUrl.split('?')[0];

  // 🔥 Route-specific path rewriting
  // We need to strip the /api prefix if present
  forwardedPath = forwardedPath.replace(/^\/api/, '');

  // 🔥 Route-specific path rewriting
  if (forwardedPath.startsWith('/auth')) {
    forwardedPath = forwardedPath.replace(/^\/auth/, '');
  } else if (forwardedPath.startsWith('/listings')) {
    forwardedPath = forwardedPath.replace(/^\/listings/, '');
  } else if (forwardedPath.startsWith('/search')) {
    forwardedPath = forwardedPath.replace(/^\/search/, '');
  } else if (forwardedPath.startsWith('/bookings')) {
    forwardedPath = forwardedPath.replace(/^\/bookings/, '');
  } else if (forwardedPath.startsWith('/subscriptions/subscribe')) {
    forwardedPath = forwardedPath.replace('/subscriptions', '');
  } else if (forwardedPath.startsWith('/subscriptions')) {
    forwardedPath = forwardedPath.replace(/^\/subscriptions/, '');
  } else if (forwardedPath.startsWith('/payments')) { 
    // ✅ ADDED THIS BLOCK: Strip the /payments prefix
    forwardedPath = forwardedPath.replace(/^\/payments/, '');
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