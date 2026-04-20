const axios = require('axios');

async function forwardRequest(serviceUrl, req, res) {
  try {
    const response = await axios({
      method: req.method,
      url: `${serviceUrl}${req.path}`,
      data: req.body,
      params: req.query,
      headers: {
        Authorization: req.headers.authorization || ''
      }
    });

    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data || { message: 'Gateway error' };
    return res.status(status).json(message);
  }
}

module.exports = { forwardRequest };
