const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function readPayload(res) {
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return res.json();
  }

  const text = await res.text();
  return text ? { message: text } : null;
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    token,
    headers = {}
  } = options;

  const resolvedHeaders = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: resolvedHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const payload = await readPayload(res);

  if (!res.ok) {
    const message = payload?.message || payload?.error || `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, payload);
  }

  return payload;
}

export { BASE_URL };
