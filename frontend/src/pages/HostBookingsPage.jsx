import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import { parseUtcDate } from '../utils/dateTime';

function formatDateTime(value) {
  const parsed = parseUtcDate(value);
  if (!parsed) return '-';
  return parsed.toLocaleString();
}

function HostBookingsPage({ token, user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  const filteredBookings = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return bookings.filter((booking) => {
      const statusMatches = statusFilter === 'all' || String(booking.status || '').toLowerCase() === statusFilter;
      if (!statusMatches) return false;

      if (!query) return true;

      return [
        booking.id,
        booking.space_id,
        booking.user_id,
        booking.status,
        booking.start_slot_utc,
        booking.end_slot_utc
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [bookings, searchText, statusFilter]);

  async function loadBookings() {
    setLoading(true);
    setNotice({ type: '', text: '' });

    try {
      const payload = await apiRequest('/bookings/bookings/host/my?page=1&limit=100', { token });
      const bookingsList = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : []);

      const sorted = [...bookingsList].sort(
        (a, b) => {
          const first = parseUtcDate(b.start_time || b.start_slot_utc)?.getTime() || 0;
          const second = parseUtcDate(a.start_time || a.start_slot_utc)?.getTime() || 0;
          return first - second;
        }
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

      <section className="card stack">
        <div className="grid-2">
          <div className="field">
            <label htmlFor="host-bookings-status">Status</label>
            <select id="host-bookings-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="host-bookings-search">Search</label>
            <input
              id="host-bookings-search"
              placeholder="Booking ID, guest ID, space ID"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
        </div>
      </section>

      {notice.text ? <div className={`notice ${notice.type || 'info'}`}>{notice.text}</div> : null}

      {loading ? <div className="notice info">Loading host bookings...</div> : null}

      {!loading && filteredBookings.length === 0 ? (
        <div className="notice info">No host-side bookings yet.</div>
      ) : null}

      {filteredBookings.map((booking) => (
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
