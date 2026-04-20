import { useState } from 'react';
import AuthPage from './pages/AuthPage';
import SearchPage from './pages/SearchPage';
import AddSpacePage from './pages/AddSpacePage';
import MyListingsPage from './pages/MyListingsPage';
import MyBookingsPage from './pages/MyBookingsPage';

function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('search');

  function handleLogout() {
    setToken('');
    setUser(null);
    setPage('search');
  }

  if (!token) {
    return (
      <main style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'Arial', padding: 20 }}>
        <h1>🏢 SpaceShare</h1>
        <AuthPage setToken={setToken} setUser={setUser} />
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'Arial', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, cursor: 'pointer' }} onClick={() => setPage('search')}>🏢 SpaceShare</h1>
        <div>
          <span style={{ marginRight: 12 }}><strong>{user?.email}</strong> ({user?.role})</span>
          <button onClick={handleLogout} style={{ padding: '4px 12px' }}>Logout</button>
        </div>
      </div>

      <nav style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setPage('search')} style={{ padding: '6px 16px', fontWeight: page === 'search' ? 'bold' : 'normal' }}>🔍 Search</button>
        <button onClick={() => setPage('mybookings')} style={{ padding: '6px 16px', fontWeight: page === 'mybookings' ? 'bold' : 'normal' }}>📖 My Bookings</button>
        {user?.role === 'host' && (
          <>
            <button onClick={() => setPage('add')} style={{ padding: '6px 16px', fontWeight: page === 'add' ? 'bold' : 'normal' }}>➕ Add Space</button>
            <button onClick={() => setPage('my')} style={{ padding: '6px 16px', fontWeight: page === 'my' ? 'bold' : 'normal' }}>📋 My Listings</button>
          </>
        )}
      </nav>

      {page === 'search' && <SearchPage token={token} user={user} />}
      {page === 'mybookings' && <MyBookingsPage token={token} onBack={() => setPage('search')} />}
      {page === 'add' && <AddSpacePage token={token} onBack={() => setPage('search')} />}
      {page === 'my' && <MyListingsPage token={token} onBack={() => setPage('search')} />}
    </main>
  );
}

export default App;
