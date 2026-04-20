import AuthForm from '../components/AuthForm';
import { apiRequest } from '../services/api';

function AuthPage({ setToken, setUser }) {
  async function handleLogin(data) {
    const result = await apiRequest('/auth/login', 'POST', data);
    setToken(result.token);
    setUser(result.user);
  }

  async function handleRegister(data) {
    await apiRequest('/auth/register', 'POST', data);
    alert('Registered successfully. Please login.');
  }

  return (
    <div>
      <AuthForm mode="login" onSubmit={handleLogin} />
      <hr />
      <AuthForm mode="register" onSubmit={handleRegister} />
    </div>
  );
}

export default AuthPage;
