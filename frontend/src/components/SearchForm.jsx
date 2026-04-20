import { useState } from 'react';

function SearchForm({ onSearch }) {
  const [form, setForm] = useState({
    lat: '37.7',
    lon: '-122.4',
    radius: '0.1',
    min_price: '0',
    max_price: '1000',
    capacity: '1'
  });

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSearch(form); }} style={{ marginBottom: 16 }}>
      <h2>🔍 Search Spaces</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.keys(form).map((field) => (
          <input
            key={field}
            name={field}
            value={form[field]}
            onChange={handleChange}
            placeholder={field}
            style={{ padding: 6, width: 120 }}
          />
        ))}
        <button type="submit" style={{ padding: '6px 16px' }}>Search</button>
      </div>
    </form>
  );
}

export default SearchForm;
