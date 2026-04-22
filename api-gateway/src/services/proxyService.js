const axios = require('axios');

async function forwardRequest(serviceUrl, req, res, options = {}) {
  const {
    targetPath = req.path,
    body = req.body,
    headers: extraHeaders = {}
  } = options;

  try {
    const response = await axios({
      method: req.method,
      url: `${serviceUrl}${targetPath}`,
      data: body,
      params: req.query,
      headers: {
        Authorization: req.headers.authorization || '',
        ...extraHeaders
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
