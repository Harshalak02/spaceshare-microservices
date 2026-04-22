import { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

function MyBookingsPage({ token, onBack }) {
    const [bookings, setBookings] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        async function fetchBookings() {
            try {
                const data = await apiRequest('/bookings/bookings/my', 'GET', null, token);
                setBookings(Array.isArray(data) ? data : []);
            } catch (err) {
                setMessage('Failed to load bookings: ' + (err.message || 'Unknown error'));
            }
        }
        fetchBookings();
    }, [token]);

    const cardStyle = { border: '1px solid #ddd', padding: 16, margin: '12px 0', borderRadius: 6 };

    return (
        <div>
            <button onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
            <h2>📖 My Bookings ({bookings.length})</h2>
            {message && <p style={{ color: 'red' }}>{message}</p>}
            {bookings.length === 0 && !message && <p>No bookings yet.</p>}
            {bookings.map(b => (
                <div key={b.id} style={cardStyle}>
                    <p><strong>Space ID:</strong> {b.space_id}</p>
                    <p>🕐 <strong>Start:</strong> {new Date(b.start_time).toLocaleString()}</p>
                    <p>🕐 <strong>End:</strong> {new Date(b.end_time).toLocaleString()}</p>
                    <p>📅 <strong>Booked on:</strong> {new Date(b.created_at).toLocaleString()}</p>
                    <p style={{ color: 'green', fontWeight: 'bold' }}>✅ Confirmed</p>
                </div>
            ))}
        </div>
    );
}

export default MyBookingsPage;
