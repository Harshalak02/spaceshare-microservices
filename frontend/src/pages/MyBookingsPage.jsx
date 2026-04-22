import { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

function formatDateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString();
}

function bookingStatusClass(status) {
    if (status === 'confirmed' || status === 'completed') return 'ok';
    if (status === 'pending' || status === 'refunded') return 'warn';
    if (status === 'cancelled') return 'danger';
    return 'neutral';
}

function MyBookingsPage({ token }) {
    const [bookings, setBookings] = useState([]);
    const [busy, setBusy] = useState(true);
    const [cancelBusyMap, setCancelBusyMap] = useState({});
    const [notice, setNotice] = useState({ type: '', text: '' });

    async function loadBookings() {
        setBusy(true);
        try {
            const data = await apiRequest('/bookings/bookings/my', { token });
            const sorted = [...(data || [])].sort(
                (a, b) => new Date(b.start_time || b.start_slot_utc) - new Date(a.start_time || a.start_slot_utc)
            );
            setBookings(sorted);
            setNotice({ type: '', text: '' });
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to load bookings: ${error.message}` });
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        loadBookings();
    }, []);

    async function cancelBooking(bookingId) {
        setCancelBusyMap((prev) => ({ ...prev, [bookingId]: true }));
        try {
            const updated = await apiRequest(`/bookings/bookings/${bookingId}/cancel`, {
                method: 'POST',
                token,
                body: { reason: 'Cancelled from dashboard' }
            });

            setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? updated : booking)));
            setNotice({ type: 'success', text: `Booking #${bookingId} cancelled.` });
        } catch (error) {
            setNotice({ type: 'error', text: `Could not cancel booking #${bookingId}: ${error.message}` });
        } finally {
            setCancelBusyMap((prev) => ({ ...prev, [bookingId]: false }));
        }
    }

    return (
        <div className="stack fade">
            <div className="hero-strip">
                <h2>My Bookings</h2>
                <p>Track booking lifecycle and cancel active reservations when needed.</p>
            </div>

            <div className="btn-row">
                <button className="btn btn-muted" onClick={loadBookings} disabled={busy}>
                    {busy ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {notice.text ? <div className={`notice ${notice.type || 'info'}`}>{notice.text}</div> : null}

            {busy ? <div className="notice info">Loading bookings...</div> : null}

            {!busy && bookings.length === 0 ? (
                <div className="notice info">No bookings yet. Use Search Spaces to create one.</div>
            ) : null}

            {bookings.map((booking) => {
                const status = booking.status || 'confirmed';
                const canCancel = status === 'confirmed' || status === 'pending';

                return (
                    <article className="card" key={booking.id}>
                        <div className="card-title-row">
                            <h3>Booking #{booking.id}</h3>
                            <span className={`pill ${bookingStatusClass(status)}`}>{status}</span>
                        </div>

                        <div className="meta-row" style={{ marginTop: '0.6rem' }}>
                            <span>Space ID {booking.space_id}</span>
                            <span>Host {booking.host_id || '-'}</span>
                            <span>Guests {booking.guest_count || 1}</span>
                            <span>Slots {booking.slot_count || 1}</span>
                        </div>

                        <div className="stack" style={{ gap: '0.35rem', marginTop: '0.65rem' }}>
                            <p><strong>Start:</strong> {formatDateTime(booking.start_slot_utc || booking.start_time)}</p>
                            <p><strong>End:</strong> {formatDateTime(booking.end_slot_utc || booking.end_time)}</p>
                            <p><strong>Booked At:</strong> {formatDateTime(booking.created_at)}</p>
                            <p><strong>Total:</strong> {booking.total_amount != null ? `INR ${booking.total_amount}` : '-'}</p>
                        </div>

                        {canCancel ? (
                            <div className="btn-row" style={{ marginTop: '0.7rem' }}>
                                <button
                                    className="btn btn-danger"
                                    onClick={() => cancelBooking(booking.id)}
                                    disabled={cancelBusyMap[booking.id]}
                                >
                                    {cancelBusyMap[booking.id] ? 'Cancelling...' : 'Cancel Booking'}
                                </button>
                            </div>
                        ) : null}
                    </article>
                );
            })}
        </div>
    );
}

export default MyBookingsPage;
