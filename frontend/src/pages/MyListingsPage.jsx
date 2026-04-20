import { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

function MyListingsPage({ token, onBack }) {
    const [spaces, setSpaces] = useState([]);
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [message, setMessage] = useState('');

    async function fetchMySpaces() {
        try {
            const data = await apiRequest('/listings/spaces/my', 'GET', null, token);
            setSpaces(data);
        } catch (err) {
            setMessage('Failed to load: ' + err.message);
        }
    }

    useEffect(() => { fetchMySpaces(); }, []);

    async function handleDelete(id) {
        if (!confirm('Delete this space?')) return;
        try {
            await apiRequest(`/listings/spaces/${id}`, 'DELETE', null, token);
            setSpaces(prev => prev.filter(s => s.id !== id));
            setMessage('✅ Deleted');
        } catch (err) {
            setMessage('❌ ' + err.message);
        }
    }

    function startEdit(space) {
        setEditing(space.id);
        setEditForm({
            title: space.title,
            description: space.description || '',
            location_name: space.location_name || '',
            lat: space.lat,
            lon: space.lon,
            price_per_hour: space.price_per_hour,
            capacity: space.capacity
        });
    }

    async function handleUpdate(e) {
        e.preventDefault();
        try {
            await apiRequest(`/listings/spaces/${editing}`, 'PUT', {
                ...editForm,
                lat: parseFloat(editForm.lat),
                lon: parseFloat(editForm.lon),
                price_per_hour: parseFloat(editForm.price_per_hour),
                capacity: parseInt(editForm.capacity)
            }, token);
            setEditing(null);
            setMessage('✅ Updated');
            fetchMySpaces();
        } catch (err) {
            setMessage('❌ ' + err.message);
        }
    }

    const cardStyle = { border: '1px solid #ccc', padding: 16, margin: '12px 0', borderRadius: 6 };
    const inputStyle = { padding: 6, marginRight: 8, marginBottom: 4, width: '100%', boxSizing: 'border-box' };

    return (
        <div>
            <button onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
            <h2>My Listings ({spaces.length})</h2>
            {message && <p>{message}</p>}
            {spaces.length === 0 && <p>No spaces yet. Go add one!</p>}
            {spaces.map(space => (
                <div key={space.id} style={cardStyle}>
                    {editing === space.id ? (
                        <form onSubmit={handleUpdate}>
                            <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} placeholder="Title" style={inputStyle} />
                            <input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={inputStyle} />
                            <input value={editForm.location_name} onChange={e => setEditForm(p => ({ ...p, location_name: e.target.value }))} placeholder="Location" style={inputStyle} />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input value={editForm.lat} onChange={e => setEditForm(p => ({ ...p, lat: e.target.value }))} placeholder="Lat" style={inputStyle} />
                                <input value={editForm.lon} onChange={e => setEditForm(p => ({ ...p, lon: e.target.value }))} placeholder="Lon" style={inputStyle} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input value={editForm.price_per_hour} onChange={e => setEditForm(p => ({ ...p, price_per_hour: e.target.value }))} placeholder="Price" style={inputStyle} />
                                <input value={editForm.capacity} onChange={e => setEditForm(p => ({ ...p, capacity: e.target.value }))} placeholder="Capacity" style={inputStyle} />
                            </div>
                            <button type="submit" style={{ padding: '6px 16px', marginRight: 8 }}>Save</button>
                            <button type="button" onClick={() => setEditing(null)} style={{ padding: '6px 16px' }}>Cancel</button>
                        </form>
                    ) : (
                        <>
                            <h3>{space.title}</h3>
                            {space.description && <p>{space.description}</p>}
                            <p>📍 {space.location_name || `${space.lat}, ${space.lon}`}</p>
                            <p>💰 ₹{space.price_per_hour}/hr &nbsp; 👥 {space.capacity} people</p>
                            <button onClick={() => startEdit(space)} style={{ padding: '4px 12px', marginRight: 8 }}>✏️ Edit</button>
                            <button onClick={() => handleDelete(space.id)} style={{ padding: '4px 12px', color: 'red' }}>🗑️ Delete</button>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}

export default MyListingsPage;
