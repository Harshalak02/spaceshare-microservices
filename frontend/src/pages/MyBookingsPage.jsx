import { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { parseUtcDate } from '../utils/dateTime';
const DISPLAY_TIME_ZONE = 'Asia/Kolkata';
const DISPLAY_TIME_ZONE_LABEL = 'India Standard Time (IST)';
function parseDate(value) {
    return parseUtcDate(value);
}

function formatDate(value) {
    const parsed = parseDate(value);
    if (!parsed) return '-';
    return parsed.toLocaleDateString([], {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: DISPLAY_TIME_ZONE
    });
}

function formatTime(value) {
    const parsed = parseDate(value);
    if (!parsed) return '-';
    return parsed.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: DISPLAY_TIME_ZONE
    });
}

function formatDateTime(value) {
    const parsed = parseDate(value);
    if (!parsed) return '-';
    return parsed.toLocaleString([], {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: DISPLAY_TIME_ZONE,
        timeZoneName: 'short'
    });
}

function formatCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    return `INR ${amount.toFixed(2)}`;
}

function toStatusLabel(status) {
    if (!status) return 'Unknown';
    return String(status)
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function getDurationLabel(booking) {
    const slotCount = Number(booking.slot_count || 0);
    if (slotCount > 0) {
        return `${slotCount} hour${slotCount === 1 ? '' : 's'}`;
    }

    const start = parseDate(booking.start_slot_utc || booking.start_time);
    const end = parseDate(booking.end_slot_utc || booking.end_time);
    if (!start || !end) return '-';

    const durationHours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000)));
    return `${durationHours} hour${durationHours === 1 ? '' : 's'}`;
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
                (a, b) => {
                    const first = parseUtcDate(b.start_time || b.start_slot_utc)?.getTime() || 0;
                    const second = parseUtcDate(a.start_time || a.start_slot_utc)?.getTime() || 0;
                    return first - second;
                }
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
                <p className="tiny">All booking times are shown in {DISPLAY_TIME_ZONE_LABEL}.</p>
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
                const startAt = booking.start_slot_utc || booking.start_time;
                const endAt = booking.end_slot_utc || booking.end_time;
                const duration = getDurationLabel(booking);

                return (
                    <article className="card booking-card" key={booking.id}>
                        <div className="card-title-row">
                            <div className="stack" style={{ gap: '0.18rem' }}>
                                <h3>Booking #{booking.id}</h3>
                                <p className="tiny">Created {formatDateTime(booking.created_at)}</p>
                            </div>
                            <span className={`pill ${bookingStatusClass(status)}`}>{toStatusLabel(status)}</span>
                        </div>

                        <div className="booking-card-grid">
                            <section className="booking-module">
                                <div className="booking-module-title">Schedule</div>
                                <div className="booking-module-value">{formatDate(startAt)}</div>
                                <div className="booking-time-range">
                                    {formatTime(startAt)} to {formatTime(endAt)}
                                </div>
                                <div className="tiny">Duration: {duration}</div>
                            </section>

                            <section className="booking-module">
                                <div className="booking-module-title">Reservation Details</div>
                                <div className="booking-key-list">
                                    <div className="booking-key-row">
                                        <span>Space ID</span>
                                        <strong>#{booking.space_id}</strong>
                                    </div>
                                    <div className="booking-key-row">
                                        <span>Host ID</span>
                                        <strong>{booking.host_id || '-'}</strong>
                                    </div>
                                    <div className="booking-key-row">
                                        <span>Guests</span>
                                        <strong>{booking.guest_count || 1}</strong>
                                    </div>
                                    <div className="booking-key-row">
                                        <span>Status</span>
                                        <strong>{toStatusLabel(status)}</strong>
                                    </div>
                                </div>
                            </section>

                            <section className="booking-module">
                                <div className="booking-module-title">Payment Snapshot</div>
                                <div className="booking-key-list">
                                    <div className="booking-key-row">
                                        <span>Rate / hour</span>
                                        <strong>{formatCurrency(booking.price_per_hour_snapshot)}</strong>
                                    </div>
                                    <div className="booking-key-row">
                                        <span>Subtotal</span>
                                        <strong>{formatCurrency(booking.subtotal_amount)}</strong>
                                    </div>
                                    <div className="booking-key-row">
                                        <span>Fees + Taxes</span>
                                        <strong>{formatCurrency((Number(booking.platform_fee_amount || 0) + Number(booking.tax_amount || 0)))}</strong>
                                    </div>
                                    <div className="booking-key-row emphasis">
                                        <span>Total</span>
                                        <strong>{formatCurrency(booking.total_amount)}</strong>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {status === 'cancelled' ? (
                            <div className="notice info">
                                Cancelled {booking.cancelled_at ? formatDateTime(booking.cancelled_at) : ''}
                                {booking.cancellation_reason ? ` • Reason: ${booking.cancellation_reason}` : ''}
                            </div>
                        ) : null}

                        {canCancel ? (
                            <div className="btn-row booking-card-actions">
                                <button
                                    className="btn btn-danger"
                                    onClick={() => cancelBooking(booking.id)}
                                    disabled={cancelBusyMap[booking.id]}
                                >
                                    {cancelBusyMap[booking.id] ? (
                                        <span className="btn-with-spinner">
                                            <span className="btn-spinner btn-spinner-dark" aria-hidden="true" />
                                            Cancelling...
                                        </span>
                                    ) : 'Cancel Booking'}
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
