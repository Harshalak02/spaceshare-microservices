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

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Request failed');
  }

  return res.json();
}

export async function fetchRating(id) {
  const data = await apiRequest(`/reviews/rating/${id}`);
  return data;
}
