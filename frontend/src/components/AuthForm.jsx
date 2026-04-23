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
    <form onSubmit={handleSubmit} className="card stack">
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
      <div className="grid-2">
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === 'register' && (
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="guest">Guest</option>
            <option value="host">Host</option>
          </select>
        )}
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" type="submit">{mode === 'login' ? 'Login' : 'Create account'}</button>
      </div>
    </form>
  );
}

export default AuthForm;
