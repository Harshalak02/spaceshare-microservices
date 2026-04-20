import { useState } from 'react';
import { apiRequest } from '../services/api';

function AddSpacePage({ token, onBack }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        location_name: '',
        lat: '',
        lon: '',
        price_per_hour: '',
        capacity: ''
    });
    const [message, setMessage] = useState('');
    const [geocoding, setGeocoding] = useState(false);

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function geocodeLocation() {
        if (!form.location_name) return;
        setGeocoding(true);
        try {
            const encoded = encodeURIComponent(form.location_name);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                setForm(prev => ({ ...prev, lat: data[0].lat, lon: data[0].lon }));
                setMessage(`📍 Found: ${data[0].display_name}`);
            } else {
                setMessage('Location not found. Please enter lat/lon manually.');
            }
        } catch (err) {
            setMessage('Geocoding failed: ' + err.message);
        }
        setGeocoding(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setMessage('');
        try {
            await apiRequest('/listings/spaces', 'POST', {
                title: form.title,
                description: form.description,
                location_name: form.location_name,
                lat: parseFloat(form.lat),
                lon: parseFloat(form.lon),
                price_per_hour: parseFloat(form.price_per_hour),
                capacity: parseInt(form.capacity)
            }, token);
            setMessage('✅ Space created successfully!');
            setForm({ title: '', description: '', location_name: '', lat: '', lon: '', price_per_hour: '', capacity: '' });
        } catch (err) {
            setMessage('❌ ' + err.message);
        }
    }

    const inputStyle = { padding: 8, marginBottom: 8, width: '100%', boxSizing: 'border-box' };

    return (
        <div>
            <button onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
            <h2>Add New Space</h2>
            {message && <p>{message}</p>}
            <form onSubmit={handleSubmit}>
                <input name="title" placeholder="Title *" value={form.title} onChange={handleChange} style={inputStyle} required />
                <textarea name="description" placeholder="Description" value={form.description} onChange={handleChange} style={{ ...inputStyle, height: 80 }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input name="location_name" placeholder="Location (e.g. Bangalore, Indiranagar)" value={form.location_name} onChange={handleChange} style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                    <button type="button" onClick={geocodeLocation} disabled={geocoding} style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                        {geocoding ? '...' : '📍 Get Coords'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input name="lat" placeholder="Latitude *" value={form.lat} onChange={handleChange} style={inputStyle} required />
                    <input name="lon" placeholder="Longitude *" value={form.lon} onChange={handleChange} style={inputStyle} required />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input name="price_per_hour" placeholder="Price/Hour *" type="number" min="1" value={form.price_per_hour} onChange={handleChange} style={inputStyle} required />
                    <input name="capacity" placeholder="Capacity *" type="number" min="1" value={form.capacity} onChange={handleChange} style={inputStyle} required />
                </div>
                <button type="submit" style={{ padding: '10px 24px', marginTop: 8 }}>Create Space</button>
            </form>
        </div>
    );
}

export default AddSpacePage;
