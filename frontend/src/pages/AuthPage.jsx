import { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';

const defaultLogin = { email: '', password: '' };
const defaultRegister = { email: '', password: '', role: 'guest' };

function AuthPage({ onAuthenticated, initialNotice = '' }) {
  const [loginForm, setLoginForm] = useState(defaultLogin);
  const [registerForm, setRegisterForm] = useState(defaultRegister);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!initialNotice) return;
    setNotice({ type: 'info', text: initialNotice });
  }, [initialNotice]);

  function updateLogin(event) {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateRegister(event) {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy('login');
    setNotice({ type: '', text: '' });

    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: loginForm
      });

      onAuthenticated({ token: result.token, user: result.user });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setBusy('register');
    setNotice({ type: '', text: '' });

    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: registerForm
      });

      setNotice({ type: 'success', text: 'Account created. Please log in using the same credentials.' });
      setLoginForm({ email: registerForm.email, password: '' });
      setRegisterForm(defaultRegister);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="split-auth">
      <aside className="auth-promo fade">
        <div>
          <h1>Workspaces with style, booked by the hour.</h1>
          <p>Hosts list and manage spaces while guests discover, reserve, and track bookings in one place.</p>
        </div>

        <div className="auth-points">
          <div className="auth-point">Slot-aware booking flow with conflict safety.</div>
          <div className="auth-point">Host calendar controls for weekly hours and date overrides.</div>
          <div className="auth-point">Subscription status, booking history, and operational visibility.</div>
        </div>
      </aside>

      <section className="stack">
        <div className="card fade">
          <h2 className="section-title">Sign in</h2>
          <p className="section-subtitle">Continue with your existing SpaceShare account.</p>

          <form className="stack" onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                value={loginForm.email}
                onChange={updateLogin}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                value={loginForm.password}
                onChange={updateLogin}
                required
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={busy === 'login'}>
                {busy === 'login' ? 'Signing in...' : 'Login'}
              </button>
            </div>
          </form>
        </div>

        <div className="card fade">
          <h2 className="section-title">Create account</h2>
          <p className="section-subtitle">Choose a role now. Hosts get listing and calendar controls after login.</p>

          <form className="stack" onSubmit={handleRegister}>
            <div className="field">
              <label htmlFor="register-email">Email</label>
              <input
                id="register-email"
                name="email"
                type="email"
                value={registerForm.email}
                onChange={updateRegister}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                name="password"
                type="password"
                value={registerForm.password}
                onChange={updateRegister}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="register-role">Role</label>
              <select
                id="register-role"
                name="role"
                value={registerForm.role}
                onChange={updateRegister}
              >
                <option value="guest">Guest</option>
                <option value="host">Host</option>
              </select>
            </div>
            <div className="btn-row">
              <button className="btn btn-muted" type="submit" disabled={busy === 'register'}>
                {busy === 'register' ? 'Creating...' : 'Create account'}
              </button>
            </div>
          </form>
        </div>

        {notice.text ? (
          <div className={`notice ${notice.type === 'error' ? 'error' : 'success'}`}>{notice.text}</div>
        ) : null}
      </section>
    </div>
  );
}

export default AuthPage;
