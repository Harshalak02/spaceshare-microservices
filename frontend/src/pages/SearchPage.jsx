import { useState } from 'react';
import { apiRequest } from '../services/api';

function SearchPage({ token, user }) {
  const [form, setForm] = useState({
    location: '',
    lat: '',
    lon: '',
    radius: '5',
    min_price: '',
    max_price: '',
    capacity: '1'
  });
  const [spaces, setSpaces] = useState([]);
  const [message, setMessage] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [bookingForm, setBookingForm] = useState({ spaceId: null, start_time: '', end_time: '' });

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function geocodeLocation() {
    if (!form.location) return;
    setGeocoding(true);
    try {
      const encoded = encodeURIComponent(form.location);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setForm(prev => ({ ...prev, lat: data[0].lat, lon: data[0].lon }));
        setMessage(`📍 Found: ${data[0].display_name}`);
      } else {
        setMessage('Location not found. Enter lat/lon manually.');
      }
    } catch (err) {
      setMessage('Geocoding failed: ' + err.message);
    }
    setGeocoding(false);
  }

  async function handleSearch(e) {
    e.preventDefault();
    setMessage('');
    if (!form.lat || !form.lon) {
      setMessage('Please enter coordinates or use "Get Coords" first.');
      return;
    }
    try {
      const params = {};
      params.lat = form.lat;
      params.lon = form.lon;
      if (form.radius) params.radius = form.radius;
      if (form.min_price) params.min_price = form.min_price;
      if (form.max_price) params.max_price = form.max_price;
      if (form.capacity) params.capacity = form.capacity;

      const qs = new URLSearchParams(params).toString();
      const result = await apiRequest(`/search?${qs}`);
      setSpaces(result.spaces || []);
      setMessage(result.spaces?.length ? `Found ${result.spaces.length} spaces (${result.source})` : 'No spaces found.');
    } catch (err) {
      setMessage('Search failed: ' + err.message);
    }
  }

  async function handleBook(spaceId) {
    if (!bookingForm.start_time || !bookingForm.end_time) {
      alert('Please select start and end time.');
      return;
    }
    try {
      await apiRequest('/bookings/book', 'POST', {
        space_id: spaceId,
        start_time: new Date(bookingForm.start_time).toISOString(),
        end_time: new Date(bookingForm.end_time).toISOString()
      }, token);
      alert('✅ Booking created!');
      setBookingForm({ spaceId: null, start_time: '', end_time: '' });
    } catch (err) {
      alert('❌ ' + err.message);
    }
  }

  const inputStyle = { padding: 6, marginRight: 8, marginBottom: 8 };
  const cardStyle = { border: '1px solid #ddd', padding: 16, margin: '12px 0', borderRadius: 6 };

  return (
    <div>
      <h2>🔍 Search Spaces</h2>
      <form onSubmit={handleSearch}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input name="location" placeholder="Location (e.g. Bangalore)" value={form.location} onChange={handleChange} style={{ ...inputStyle, flex: 1 }} />
          <button type="button" onClick={geocodeLocation} disabled={geocoding} style={{ padding: '6px 14px', whiteSpace: 'nowrap' }}>
            {geocoding ? '...' : '📍 Get Coords'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input name="lat" placeholder="Latitude" value={form.lat} onChange={handleChange} style={{ ...inputStyle, width: 100 }} />
          <input name="lon" placeholder="Longitude" value={form.lon} onChange={handleChange} style={{ ...inputStyle, width: 100 }} />
          <input name="radius" placeholder="Radius (km)" value={form.radius} onChange={handleChange} style={{ ...inputStyle, width: 100 }} />
          <input name="min_price" placeholder="Min price" type="number" value={form.min_price} onChange={handleChange} style={{ ...inputStyle, width: 100 }} />
          <input name="max_price" placeholder="Max price" type="number" value={form.max_price} onChange={handleChange} style={{ ...inputStyle, width: 100 }} />
          <input name="capacity" placeholder="Capacity" type="number" value={form.capacity} onChange={handleChange} style={{ ...inputStyle, width: 100 }} />
        </div>
        <button type="submit" style={{ padding: '8px 20px', marginTop: 4 }}>Search</button>
      </form>

      {message && <p style={{ marginTop: 12, color: '#555' }}>{message}</p>}

      {spaces.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Results ({spaces.length})</h3>
          {spaces.map(space => (
            <div key={space.id} style={cardStyle}>
              <h4 style={{ margin: '0 0 8px' }}>{space.title}</h4>
              {space.description && <p style={{ margin: '4px 0', color: '#666' }}>{space.description}</p>}
              <p style={{ margin: '4px 0' }}>📍 {space.location_name || `${space.lat}, ${space.lon}`}</p>
              <p style={{ margin: '4px 0' }}>💰 ₹{space.price_per_hour}/hr &nbsp; 👥 {space.capacity} people</p>

              {bookingForm.spaceId === space.id ? (
                <div style={{ marginTop: 8, padding: 8, background: '#f9f9f9', borderRadius: 4 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label>
                      Start: <input type="datetime-local" value={bookingForm.start_time}
                        onChange={e => setBookingForm(p => ({ ...p, start_time: e.target.value }))} style={{ padding: 4 }} />
                    </label>
                    <label>
                      End: <input type="datetime-local" value={bookingForm.end_time}
                        onChange={e => setBookingForm(p => ({ ...p, end_time: e.target.value }))} style={{ padding: 4 }} />
                    </label>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => handleBook(space.id)} style={{ padding: '6px 16px', marginRight: 8 }}>✅ Confirm</button>
                    <button onClick={() => setBookingForm({ spaceId: null, start_time: '', end_time: '' })} style={{ padding: '6px 16px' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setBookingForm({ spaceId: space.id, start_time: '', end_time: '' })} style={{ marginTop: 8, padding: '6px 16px' }}>📅 Book</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchPage;
