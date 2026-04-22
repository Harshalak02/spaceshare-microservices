const BASE_URL = 'http://localhost:4000/api';

export async function apiRequest(path, method = 'GET', body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

 if (!res.ok) {
  throw {
    message: data?.message || `Request failed with status ${res.status}`,
    status: res.status,
    code: data?.code || null,
    details: data
  };
}

return data;
}
