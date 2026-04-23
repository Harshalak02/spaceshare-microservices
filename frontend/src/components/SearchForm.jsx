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
    <form onSubmit={(e) => { e.preventDefault(); onSearch(form); }} className="card stack">
      <h2>🔍 Search Spaces</h2>
      <div className="search-form-inline-grid">
        {Object.keys(form).map((field) => (
          <input
            key={field}
            name={field}
            value={form[field]}
            onChange={handleChange}
            placeholder={field}
          />
        ))}
        <button className="btn btn-primary" type="submit">Search</button>
      </div>
    </form>
  );
}

export default SearchForm;
