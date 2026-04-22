import { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function HostBookingsPage({ token, user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ type: '', text: '' });

  async function loadBookings() {
    setLoading(true);
    setNotice({ type: '', text: '' });

    try {
      const result = await apiRequest('/bookings/bookings/host/my', { token });
      const sorted = [...(result || [])].sort(
        (a, b) => new Date(b.start_time || b.start_slot_utc) - new Date(a.start_time || a.start_slot_utc)
      );
      setBookings(sorted);
    } catch (error) {
      setNotice({ type: 'error', text: `Failed to load host bookings: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === 'host') {
      loadBookings();
    }
  }, [user?.role]);

  if (user?.role !== 'host') {
    return (
      <div className="notice info">Host bookings are available only for host accounts.</div>
    );
  }

  return (
    <div className="stack fade">
      <div className="hero-strip">
        <h2>Host Bookings</h2>
        <p>Monitor reservations across all spaces you host.</p>
      </div>

      <div className="btn-row">
        <button className="btn btn-muted" onClick={loadBookings} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {notice.text ? <div className={`notice ${notice.type || 'info'}`}>{notice.text}</div> : null}

      {loading ? <div className="notice info">Loading host bookings...</div> : null}

      {!loading && bookings.length === 0 ? (
        <div className="notice info">No host-side bookings yet.</div>
      ) : null}

      {bookings.map((booking) => (
        <article className="card" key={booking.id}>
          <div className="card-title-row">
            <h3>Booking #{booking.id}</h3>
            <span className="pill neutral">{booking.status || 'confirmed'}</span>
          </div>

          <div className="meta-row" style={{ marginTop: '0.6rem' }}>
            <span>Space ID {booking.space_id}</span>
            <span>Guest User {booking.user_id}</span>
            <span>Slots {booking.slot_count || 1}</span>
            <span>Total {booking.total_amount != null ? `INR ${booking.total_amount}` : '-'}</span>
          </div>

          <div className="stack" style={{ gap: '0.35rem', marginTop: '0.65rem' }}>
            <p><strong>Start:</strong> {formatDateTime(booking.start_slot_utc || booking.start_time)}</p>
            <p><strong>End:</strong> {formatDateTime(booking.end_slot_utc || booking.end_time)}</p>
            <p><strong>Booked At:</strong> {formatDateTime(booking.created_at)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export default HostBookingsPage;
