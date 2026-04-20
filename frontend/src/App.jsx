import { useState } from 'react';
import AuthPage from './pages/AuthPage';
import SearchPage from './pages/SearchPage';

function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'Arial' }}>
      <h1>SpaceShare</h1>
      {!token ? (
        <AuthPage setToken={setToken} setUser={setUser} />
      ) : (
        <SearchPage token={token} user={user} />
      )}
    </main>
  );
}

export default App;
