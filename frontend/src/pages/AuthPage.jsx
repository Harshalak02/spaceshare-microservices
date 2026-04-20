import { useState } from 'react';
import AuthForm from '../components/AuthForm';
import { apiRequest } from '../services/api';

function AuthPage({ setToken, setUser }) {
  const [error, setError] = useState('');

  async function handleLogin(data) {
    try {
      setError('');
      const result = await apiRequest('/auth/login', 'POST', data);
      setToken(result.token);
      setUser(result.user);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRegister(data) {
    try {
      setError('');
      await apiRequest('/auth/register', 'POST', data);
      alert('Registered successfully. Please login.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <AuthForm mode="login" onSubmit={handleLogin} />
      <hr />
      <AuthForm mode="register" onSubmit={handleRegister} />
    </div>
  );
}

export default AuthPage;
