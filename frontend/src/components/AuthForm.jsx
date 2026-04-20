import { useState } from 'react';

function AuthForm({ onSubmit, mode = 'login' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('guest');

  function handleSubmit(e) {
    e.preventDefault();
    const data = { email, password };
    if (mode === 'register') data.role = role;
    onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
      <div style={{ marginBottom: 8 }}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: 6, marginRight: 8 }} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: 6, marginRight: 8 }} />
        {mode === 'register' && (
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: 6, marginRight: 8 }}>
            <option value="guest">Guest</option>
            <option value="host">Host</option>
          </select>
        )}
        <button type="submit" style={{ padding: '6px 16px' }}>{mode === 'login' ? 'Login' : 'Create account'}</button>
      </div>
    </form>
  );
}

export default AuthForm;
