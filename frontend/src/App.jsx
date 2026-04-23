import { useEffect, useMemo, useState } from 'react';
import AuthPage from './pages/AuthPage';
import SearchPage from './pages/SearchPage';
import AddSpacePage from './pages/AddSpacePage';
import MyListingsPage from './pages/MyListingsPage';
import MyBookingsPage from './pages/MyBookingsPage';
import HostBookingsPage from './pages/HostBookingsPage';
import SubscriptionPage from './pages/SubscriptionPage';

const AUTH_STORAGE_KEY = 'spaceshare-auth-v1';

function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function setStoredAuth(auth) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('search');
  const [authNotice, setAuthNotice] = useState('');

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setToken(stored.token);
      setUser(stored.user);
    }
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      clearStoredAuth();
      setToken('');
      setUser(null);
      setPage('search');
      setAuthNotice('Your session expired. Please sign in again.');
    }

    window.addEventListener('spaceshare:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('spaceshare:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!user) return;

    const hostOnlyPages = new Set(['subscription', 'hostbookings', 'add', 'my']);
    if (user.role !== 'host' && hostOnlyPages.has(page)) {
      setPage('search');
    }
  }, [user, page]);

  const navItems = useMemo(() => {
    const items = [
      { key: 'search', label: 'Search Spaces' },
      { key: 'mybookings', label: 'My Bookings' }
    ];

    if (user?.role === 'host') {
      items.push(
        { key: 'subscription', label: 'Subscription' },
        { key: 'hostbookings', label: 'Host Bookings' },
        { key: 'add', label: 'Add Space' },
        { key: 'my', label: 'My Listings' }
      );
    }

    return items;
  }, [user?.role]);

  function handleAuthSuccess(auth) {
    setToken(auth.token);
    setUser(auth.user);
    setPage('search');
    setAuthNotice('');
    setStoredAuth(auth);
  }

  function handleLogout() {
    setToken('');
    setUser(null);
    setPage('search');
    setAuthNotice('');
    clearStoredAuth();
  }

  const userInitial = (user?.email || '?').trim().charAt(0).toUpperCase();

  if (!token || !user) {
    return (
      <main className="app-root auth-root">
        <AuthPage onAuthenticated={handleAuthSuccess} initialNotice={authNotice} />
      </main>
    );
  }

  function renderPage() {
    if (page === 'search') return <SearchPage token={token} user={user} />;
    if (page === 'mybookings') return <MyBookingsPage token={token} user={user} />;
    if (page === 'subscription' && user?.role === 'host') return <SubscriptionPage token={token} user={user} />;
    if (page === 'hostbookings') return <HostBookingsPage token={token} user={user} />;
    if (page === 'add') return <AddSpacePage token={token} user={user} />;
    if (page === 'my') return <MyListingsPage token={token} user={user} />;
    return <SearchPage token={token} user={user} />;
  }

  return (
    <main className="app-root">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">S</div>
          <div>
            <h1 className="brand-title">SpaceShare</h1>
            <p className="brand-subtitle">Smart workspace bookings for modern teams</p>
          </div>
        </div>
        <div className="user-chip">
          <div className="user-avatar" aria-hidden="true">{userInitial}</div>
          <div>
            <strong>{user.email}</strong>
            <div className="user-role">{user.role}</div>
          </div>
          <button className="btn btn-muted" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <nav className="nav-tabs">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-btn ${page === item.key ? 'active' : ''}`}
            onClick={() => setPage(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="page-shell">{renderPage()}</section>
    </main>
  );
}

export default App;
