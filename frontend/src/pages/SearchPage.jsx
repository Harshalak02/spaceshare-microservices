import { useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import PaymentModal from '../components/PaymentModal';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const ONE_HOUR_MS = 60 * 60 * 1000;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(base, days) {
  const date = new Date(`${base}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function toDateKeyFromLocal(slotStartLocal) {
  return String(slotStartLocal).slice(0, 10);
}

function monthKeyFromDateKey(dateKey) {
  return String(dateKey).slice(0, 7);
}

function shiftMonthKey(monthKey, delta) {
  const [yearText, monthText] = monthKey.split('-');
  let year = Number(yearText);
  let month = Number(monthText) + delta;

  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabel(monthKey) {
  const date = new Date(`${monthKey}-01T00:00:00Z`);
  return date.toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function buildCalendarCells(monthKey) {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = firstDay.getUTCDay();
  const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const cells = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push(key);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function formatTimeInTimezone(utcIso, timezone) {
  return new Date(utcIso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone
  });
}

function formatDateKey(dateKey) {
  const value = new Date(`${dateKey}T00:00:00Z`);
  return value.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function sortUtcAscending(utcValues) {
  return [...utcValues].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

function isHourlyConsecutive(utcValues) {
  if (utcValues.length <= 1) return true;
  const ordered = sortUtcAscending(utcValues);
  for (let index = 1; index < ordered.length; index += 1) {
    const prev = new Date(ordered[index - 1]).getTime();
    const current = new Date(ordered[index]).getTime();
    if (current - prev !== ONE_HOUR_MS) {
      return false;
    }
  }
  return true;
}

function groupSlotsByDate(slots) {
  const grouped = {};
  for (const slot of slots) {
    const dateKey = toDateKeyFromLocal(slot.slot_start_local);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(slot);
  }

  for (const dateKey of Object.keys(grouped)) {
    grouped[dateKey].sort((a, b) => new Date(a.slot_start_utc).getTime() - new Date(b.slot_start_utc).getTime());
  }

  return grouped;
}

function formatINR(value) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

function SearchPage({ token }) {
  const [filters, setFilters] = useState({
    location: '',
    lat: '',
    lon: '',
    radius: '5',
    min_price: '',
    max_price: '',
    capacity: '1'
  });
  const [spaces, setSpaces] = useState([]);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [searchBusy, setSearchBusy] = useState(false);
  const [geocodeBusy, setGeocodeBusy] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [slotQueryBySpace, setSlotQueryBySpace] = useState({});
  const [slotsBySpace, setSlotsBySpace] = useState({});
  const [slotsLoadingBySpace, setSlotsLoadingBySpace] = useState({});
  const [selectedDateBySpace, setSelectedDateBySpace] = useState({});
  const [monthCursorBySpace, setMonthCursorBySpace] = useState({});
  const [selectedSlotsBySpace, setSelectedSlotsBySpace] = useState({});
  const [bookingDraftBySpace, setBookingDraftBySpace] = useState({});
  const [bookingBusyBySpace, setBookingBusyBySpace] = useState({});
  const [paymentSession, setPaymentSession] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);

  const resultSummary = useMemo(() => {
    if (!spaces.length) return 'No spaces loaded yet.';
    return `${spaces.length} space${spaces.length > 1 ? 's' : ''} available.`;
  }, [spaces]);

  function updateFilters(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  async function geocodeLocation() {
    if (!filters.location.trim()) {
      setNotice({ type: 'info', text: 'Enter a location first for coordinate lookup.' });
      return;
    }

    setGeocodeBusy(true);
    setNotice({ type: '', text: '' });
    try {
      const query = encodeURIComponent(filters.location.trim());
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`
      );
      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        setNotice({ type: 'info', text: 'Location not found. You can still enter lat/lon manually.' });
      } else {
        setFilters((prev) => ({ ...prev, lat: data[0].lat, lon: data[0].lon }));
        setNotice({ type: 'success', text: `Coordinates loaded for ${data[0].display_name}.` });
      }
    } catch (error) {
      setNotice({ type: 'error', text: `Geocoding failed: ${error.message}` });
    } finally {
      setGeocodeBusy(false);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    setNotice({ type: '', text: '' });

    if (!filters.lat || !filters.lon) {
      setNotice({ type: 'info', text: 'Please provide latitude and longitude for search.' });
      return;
    }

    setSearchBusy(true);
    try {
      const query = new URLSearchParams({
        lat: filters.lat,
        lon: filters.lon,
        ...(filters.radius ? { radius: filters.radius } : {}),
        ...(filters.min_price ? { min_price: filters.min_price } : {}),
        ...(filters.max_price ? { max_price: filters.max_price } : {}),
        ...(filters.capacity ? { capacity: filters.capacity } : {})
      }).toString();

      const result = await apiRequest(`/search/spaces?${query}`);
      setSpaces(result.spaces || []);
      setExpandedId(null);
      setSlotsBySpace({});
      setSelectedDateBySpace({});
      setMonthCursorBySpace({});
      setSelectedSlotsBySpace({});
      setBookingDraftBySpace({});

      if ((result.spaces || []).length === 0) {
        setNotice({ type: 'info', text: 'No spaces matched your current filters.' });
      } else {
        setNotice({ type: 'success', text: `Loaded ${result.spaces.length} spaces from ${result.source}.` });
      }
    } catch (error) {
      setNotice({ type: 'error', text: `Search failed: ${error.message}` });
    } finally {
      setSearchBusy(false);
    }
  }

  function getSlotQuery(spaceId) {
    if (slotQueryBySpace[spaceId]) return slotQueryBySpace[spaceId];
    const from = todayISO();
    return { from, to: addDaysISO(from, 6) };
  }

  function updateSlotQuery(spaceId, key, value) {
    const existing = getSlotQuery(spaceId);
    setSlotQueryBySpace((prev) => ({
      ...prev,
      [spaceId]: { ...existing, [key]: value }
    }));
  }

  function updateBookingDraft(spaceId, key, value) {
    const existing = bookingDraftBySpace[spaceId] || { guest_count: 1 };
    setBookingDraftBySpace((prev) => ({
      ...prev,
      [spaceId]: { ...existing, [key]: value }
    }));
  }

  async function loadSlots(spaceId, options = {}) {
    const { preserveNotice = false } = options;
    const query = getSlotQuery(spaceId);
    setSlotsLoadingBySpace((prev) => ({ ...prev, [spaceId]: true }));
    if (!preserveNotice) {
      setNotice({ type: '', text: '' });
    }

    try {
      const payload = await apiRequest(
        `/listings/spaces/${spaceId}/slots?from=${query.from}&to=${query.to}`,
        { token }
      );

      setSlotsBySpace((prev) => ({ ...prev, [spaceId]: payload }));

      const loadedSlots = payload?.slots || [];
      const availableDates = [...new Set(loadedSlots.map((slot) => toDateKeyFromLocal(slot.slot_start_local)))].sort();

      setSelectedSlotsBySpace((prev) => ({ ...prev, [spaceId]: [] }));

      if (availableDates.length > 0) {
        const currentSelection = selectedDateBySpace[spaceId];
        const nextSelectedDate = currentSelection && availableDates.includes(currentSelection)
          ? currentSelection
          : availableDates[0];

        setSelectedDateBySpace((prev) => ({ ...prev, [spaceId]: nextSelectedDate }));
        setMonthCursorBySpace((prev) => ({
          ...prev,
          [spaceId]: prev[spaceId] || monthKeyFromDateKey(nextSelectedDate)
        }));
      } else {
        setSelectedDateBySpace((prev) => ({ ...prev, [spaceId]: query.from }));
        setMonthCursorBySpace((prev) => ({ ...prev, [spaceId]: monthKeyFromDateKey(query.from) }));
      }

      if (!bookingDraftBySpace[spaceId]) {
        setBookingDraftBySpace((prev) => ({
          ...prev,
          [spaceId]: { guest_count: 1 }
        }));
      }
    } catch (error) {
      setNotice({ type: 'error', text: `Failed to load slots for listing ${spaceId}: ${error.message}` });
    } finally {
      setSlotsLoadingBySpace((prev) => ({ ...prev, [spaceId]: false }));
    }
  }

  async function expandCard(spaceId) {
    const nextId = expandedId === spaceId ? null : spaceId;
    setExpandedId(nextId);
    if (nextId && !slotsBySpace[spaceId]) {
      await loadSlots(spaceId);
    }
  }

  function selectDate(spaceId, dateKey) {
    setSelectedDateBySpace((prev) => ({ ...prev, [spaceId]: dateKey }));
    setMonthCursorBySpace((prev) => ({ ...prev, [spaceId]: monthKeyFromDateKey(dateKey) }));
    setSelectedSlotsBySpace((prev) => ({ ...prev, [spaceId]: [] }));
  }

  function updateMonthCursor(spaceId, nextMonth) {
    setMonthCursorBySpace((prev) => ({ ...prev, [spaceId]: nextMonth }));
  }

  function selectSlotRange(spaceId, daySlots, slotStartUtc) {
    const currentSelection = sortUtcAscending(selectedSlotsBySpace[spaceId] || []);

    if (currentSelection.length === 0) {
      setSelectedSlotsBySpace((prev) => ({ ...prev, [spaceId]: [slotStartUtc] }));
      return;
    }

    const anchorUtc = currentSelection[0];

    if (currentSelection.length === 1 && currentSelection[0] === slotStartUtc) {
      setSelectedSlotsBySpace((prev) => ({ ...prev, [spaceId]: [] }));
      return;
    }

    if (currentSelection.length > 1 && anchorUtc === slotStartUtc) {
      setSelectedSlotsBySpace((prev) => ({ ...prev, [spaceId]: [slotStartUtc] }));
      return;
    }

    const anchorIndex = daySlots.findIndex((slot) => slot.slot_start_utc === anchorUtc);
    const clickedIndex = daySlots.findIndex((slot) => slot.slot_start_utc === slotStartUtc);

    if (anchorIndex < 0 || clickedIndex < 0) {
      setSelectedSlotsBySpace((prev) => ({ ...prev, [spaceId]: [slotStartUtc] }));
      return;
    }

    const fromIndex = Math.min(anchorIndex, clickedIndex);
    const toIndex = Math.max(anchorIndex, clickedIndex);
    const proposedRange = daySlots.slice(fromIndex, toIndex + 1).map((slot) => slot.slot_start_utc);

    if (!isHourlyConsecutive(proposedRange)) {
      setNotice({ type: 'info', text: 'Choose continuous hourly slots without gaps.' });
      return;
    }

    setSelectedSlotsBySpace((prev) => ({ ...prev, [spaceId]: proposedRange }));
  }

  async function createBooking(spaceId) {
    const selectedSlots = sortUtcAscending(selectedSlotsBySpace[spaceId] || []);
    if (selectedSlots.length === 0) {
      setNotice({ type: 'info', text: 'Select at least one slot before booking.' });
      return;
    }

    if (!isHourlyConsecutive(selectedSlots)) {
      setNotice({ type: 'error', text: 'Selected slots must be consecutive hourly slots.' });
      return;
    }

    const draft = bookingDraftBySpace[spaceId] || { guest_count: 1 };
    const slotCount = selectedSlots.length;
    const guestCount = Number(draft.guest_count || 1);
    const startSlotUtc = selectedSlots[0];
    const selectedSpace = spaces.find((space) => Number(space.id) === Number(spaceId));
    const fallbackAmount = Number(selectedSpace?.price_per_hour || 0) * slotCount;

    setBookingBusyBySpace((prev) => ({ ...prev, [spaceId]: true }));
    try {
      const booking = await apiRequest('/bookings/book', {
        method: 'POST',
        token,
        body: {
          space_id: spaceId,
          start_slot_utc: startSlotUtc,
          slot_count: slotCount,
          guest_count: guestCount,
          idempotency_key: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        }
      });

      setNotice({ type: 'success', text: `Booking created for ${slotCount} slot${slotCount === 1 ? '' : 's'}.` });

      try {
        const paymentResponse = await apiRequest('/payments/create-session', {
          method: 'POST',
          token,
          body: {
            booking_id: booking.id,
            amount: Number(booking?.total_amount || fallbackAmount || 0)
          }
        });

        if (paymentResponse?.alreadyPaid) {
          setNotice({ type: 'success', text: 'Booking created and payment is already marked as succeeded.' });
        } else if (paymentResponse?.intentId) {
          const clientSecret = paymentResponse.clientSecret || '';
          const mockSession = String(clientSecret).startsWith('mock_secret_')
            || String(paymentResponse.intentId).startsWith('mock_pi_');

          setPaymentSession({
            bookingId: booking.id,
            amount: Number(booking?.total_amount || fallbackAmount || 0),
            intentId: paymentResponse.intentId,
            clientSecret,
            isMock: mockSession
          });
          setNotice({ type: 'info', text: 'Booking created. Complete payment in the popup window.' });
        }
      } catch (paymentError) {
        setNotice({
          type: 'error',
          text: `Booking created, but payment session could not be opened: ${paymentError.message}`
        });
      }

      await loadSlots(spaceId, { preserveNotice: true });
      setSelectedSlotsBySpace((prev) => ({ ...prev, [spaceId]: [] }));
    } catch (error) {
      setNotice({ type: 'error', text: `Booking failed: ${error.message}` });
    } finally {
      setBookingBusyBySpace((prev) => ({ ...prev, [spaceId]: false }));
    }
  }

  function closePaymentModal() {
    if (paymentBusy) return;
    setPaymentSession(null);
  }

  async function completeMockPayment() {
    if (!paymentSession?.intentId) return;

    setPaymentBusy(true);
    try {
      await apiRequest('/payments/simulate-success', {
        method: 'POST',
        token,
        body: { intentId: paymentSession.intentId }
      });

      setNotice({ type: 'success', text: 'Payment completed successfully.' });
      setPaymentSession(null);
    } catch (error) {
      setNotice({ type: 'error', text: `Payment confirmation failed: ${error.message}` });
    } finally {
      setPaymentBusy(false);
    }
  }

  function handleStripePaymentSuccess() {
    setNotice({ type: 'success', text: 'Payment completed successfully.' });
    setPaymentSession(null);
  }

  return (
    <div className="stack fade">
      <div className="hero-strip">
        <h2>Search and Book</h2>
        <p>Use geo filters, inspect slot availability, and create hourly bookings in one flow.</p>
      </div>

      <section className="card">
        <h3 className="section-title">Search Filters</h3>
        <p className="section-subtitle">Tip: use location lookup to auto-fill coordinates.</p>

        <form className="stack" onSubmit={handleSearch}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                placeholder="e.g. Hyderabad, Banjara Hills"
                value={filters.location}
                onChange={updateFilters}
              />
            </div>
            <div className="btn-row" style={{ alignItems: 'end' }}>
              <button className="btn btn-muted" type="button" onClick={geocodeLocation} disabled={geocodeBusy}>
                {geocodeBusy ? 'Looking up...' : 'Get Coordinates'}
              </button>
            </div>
          </div>

          <div className="grid-3">
            <div className="field">
              <label htmlFor="lat">Latitude</label>
              <input id="lat" name="lat" value={filters.lat} onChange={updateFilters} required />
            </div>
            <div className="field">
              <label htmlFor="lon">Longitude</label>
              <input id="lon" name="lon" value={filters.lon} onChange={updateFilters} required />
            </div>
            <div className="field">
              <label htmlFor="radius">Radius (km)</label>
              <input id="radius" name="radius" type="number" min="1" value={filters.radius} onChange={updateFilters} />
            </div>
            <div className="field">
              <label htmlFor="min_price">Min Price</label>
              <input id="min_price" name="min_price" type="number" min="0" value={filters.min_price} onChange={updateFilters} />
            </div>
            <div className="field">
              <label htmlFor="max_price">Max Price</label>
              <input id="max_price" name="max_price" type="number" min="0" value={filters.max_price} onChange={updateFilters} />
            </div>
            <div className="field">
              <label htmlFor="capacity">Capacity</label>
              <input id="capacity" name="capacity" type="number" min="1" value={filters.capacity} onChange={updateFilters} />
            </div>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={searchBusy}>
              {searchBusy ? 'Searching...' : 'Search Spaces'}
            </button>
            <span className="tiny" style={{ alignSelf: 'center' }}>{resultSummary}</span>
          </div>
        </form>
      </section>

      {notice.text ? <div className={`notice ${notice.type || 'info'}`}>{notice.text}</div> : null}

      {spaces.map((space) => {
        const query = getSlotQuery(space.id);
        const slotPayload = slotsBySpace[space.id];
        const availableSlots = slotPayload?.slots || [];
        const bookingDraft = bookingDraftBySpace[space.id] || { guest_count: 1 };

        const groupedSlots = groupSlotsByDate(availableSlots);
        const dateKeys = Object.keys(groupedSlots).sort();
        const selectedDate = dateKeys.includes(selectedDateBySpace[space.id])
          ? selectedDateBySpace[space.id]
          : (dateKeys[0] || query.from);
        const daySlots = groupedSlots[selectedDate] || [];

        const selectedSlots = sortUtcAscending(
          (selectedSlotsBySpace[space.id] || []).filter((utc) => daySlots.some((slot) => slot.slot_start_utc === utc))
        );
        const selectedSlotSet = new Set(selectedSlots);

        const rangeStartMonth = monthKeyFromDateKey(query.from);
        const rangeEndMonth = monthKeyFromDateKey(query.to);

        let monthCursor = monthCursorBySpace[space.id] || monthKeyFromDateKey(selectedDate);
        if (monthCursor < rangeStartMonth) monthCursor = rangeStartMonth;
        if (monthCursor > rangeEndMonth) monthCursor = rangeEndMonth;

        const calendarCells = buildCalendarCells(monthCursor);
        const canMovePrevMonth = monthCursor > rangeStartMonth;
        const canMoveNextMonth = monthCursor < rangeEndMonth;

        const slotCount = selectedSlots.length;
        const pricePerHour = Number(space.price_per_hour || 0);
        const subtotal = pricePerHour * slotCount;
        const estimatedTotal = subtotal;

        const timezone = slotPayload?.timezone || 'UTC';

        return (
          <article className="card fade" key={space.id}>
            <div className="card-title-row">
              <div className="stack" style={{ gap: '0.45rem' }}>
                <h3>{space.title}</h3>
                <p className="tiny">{space.description || 'No description provided.'}</p>
                <div className="meta-row">
                  <span>{space.location_name || `${space.lat}, ${space.lon}`}</span>
                  <span>INR {space.price_per_hour}/hour</span>
                  <span>Capacity {space.capacity}</span>
                </div>
              </div>
              <button className="btn btn-muted" onClick={() => expandCard(space.id)}>
                {expandedId === space.id ? 'Hide Booking Panel' : 'View Slots'}
              </button>
            </div>

            {expandedId === space.id ? (
              <div className="stack" style={{ marginTop: '0.8rem' }}>
                <div className="booking-toolbar">
                  <div className="field">
                    <label>From</label>
                    <input
                      type="date"
                      value={query.from}
                      onChange={(event) => updateSlotQuery(space.id, 'from', event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>To</label>
                    <input
                      type="date"
                      value={query.to}
                      onChange={(event) => updateSlotQuery(space.id, 'to', event.target.value)}
                    />
                  </div>
                  <div className="btn-row" style={{ alignItems: 'end' }}>
                    <button
                      className="btn btn-muted"
                      type="button"
                      onClick={() => loadSlots(space.id)}
                      disabled={slotsLoadingBySpace[space.id]}
                    >
                      {slotsLoadingBySpace[space.id] ? 'Loading...' : 'Refresh Slots'}
                    </button>
                  </div>
                </div>

                {slotPayload ? (
                  <>
                    <div className="tiny">
                      {availableSlots.length} available slot{availableSlots.length === 1 ? '' : 's'} in {timezone}.
                    </div>

                    {availableSlots.length > 0 ? (
                      <div className="booking-picker">
                        <section className="booking-calendar-card">
                          <div className="booking-picker-title">Select a Date &amp; Time</div>
                          <div className="calendar-nav">
                            <button
                              type="button"
                              className="calendar-nav-btn"
                              onClick={() => updateMonthCursor(space.id, shiftMonthKey(monthCursor, -1))}
                              disabled={!canMovePrevMonth}
                            >
                              &lt;
                            </button>
                            <strong>{monthLabel(monthCursor)}</strong>
                            <button
                              type="button"
                              className="calendar-nav-btn"
                              onClick={() => updateMonthCursor(space.id, shiftMonthKey(monthCursor, 1))}
                              disabled={!canMoveNextMonth}
                            >
                              &gt;
                            </button>
                          </div>

                          <div className="calendar-weekdays">
                            {WEEKDAY_LABELS.map((weekday) => (
                              <span key={weekday}>{weekday}</span>
                            ))}
                          </div>

                          <div className="calendar-grid">
                            {calendarCells.map((dateKey, cellIndex) => {
                              if (!dateKey) {
                                return <span key={`empty-${cellIndex}`} className="calendar-day empty" />;
                              }

                              const hasSlots = Boolean(groupedSlots[dateKey]?.length);
                              const isSelected = selectedDate === dateKey;

                              return (
                                <button
                                  key={dateKey}
                                  type="button"
                                  className={`calendar-day ${hasSlots ? 'available' : 'disabled'} ${isSelected ? 'selected' : ''}`}
                                  onClick={() => selectDate(space.id, dateKey)}
                                  disabled={!hasSlots}
                                >
                                  {Number(dateKey.slice(8, 10))}
                                </button>
                              );
                            })}
                          </div>

                          <div className="tiny">Time zone: {timezone}</div>
                        </section>

                        <section className="booking-times-card">
                          <div className="booking-times-header">
                            <h4>{selectedDate ? formatDateKey(selectedDate) : 'No date selected'}</h4>
                            <p className="tiny">Click one time, then another to set a multi-hour range.</p>
                          </div>

                          {daySlots.length > 0 ? (
                            <div className="time-slot-list">
                              {daySlots.map((slot) => (
                                <button
                                  key={slot.slot_start_utc}
                                  type="button"
                                  className={`time-slot-btn ${selectedSlotSet.has(slot.slot_start_utc) ? 'active' : ''}`}
                                  onClick={() => selectSlotRange(space.id, daySlots, slot.slot_start_utc)}
                                >
                                  <span>{formatTimeInTimezone(slot.slot_start_utc, timezone)}</span>
                                  <small>to {formatTimeInTimezone(slot.slot_end_utc, timezone)}</small>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="notice info">No slots available for this date.</div>
                          )}
                        </section>
                      </div>
                    ) : (
                      <div className="notice info">No slots are currently available in this date range.</div>
                    )}
                  </>
                ) : (
                  <div className="notice info">Load slots to choose a booking start time.</div>
                )}

                <div className="booking-summary">
                  <div className="booking-summary-card">
                    <div className="tiny">Selected Slots</div>
                    <div className="booking-summary-value">
                      {slotCount} hour{slotCount === 1 ? '' : 's'}
                    </div>
                    <div className="tiny">{formatINR(pricePerHour)} per hour</div>
                    <div className="booking-summary-total">Estimated: {formatINR(estimatedTotal)}</div>
                  </div>

                  <div className="field">
                    <label>Guest Count</label>
                    <input
                      type="number"
                      min="1"
                      value={bookingDraft.guest_count}
                      onChange={(event) => updateBookingDraft(space.id, 'guest_count', event.target.value)}
                    />
                  </div>

                  <div className="btn-row booking-actions" style={{ alignItems: 'end' }}>
                    <button
                      className="btn btn-muted"
                      type="button"
                      onClick={() => setSelectedSlotsBySpace((prev) => ({ ...prev, [space.id]: [] }))}
                      disabled={slotCount === 0}
                    >
                      Clear Selection
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => createBooking(space.id)}
                      disabled={bookingBusyBySpace[space.id] || slotCount === 0}
                    >
                      {bookingBusyBySpace[space.id] ? (
                        <span className="btn-with-spinner">
                          <span className="btn-spinner" aria-hidden="true" />
                          Booking in progress...
                        </span>
                      ) : `Book ${slotCount} Slot${slotCount === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}

      {paymentSession ? (
        <PaymentModal
          amount={paymentSession.amount}
          intentId={paymentSession.intentId}
          clientSecret={paymentSession.clientSecret}
          isMock={paymentSession.isMock}
          paymentBusy={paymentBusy}
          onMockPayment={completeMockPayment}
          onPaymentSuccess={handleStripePaymentSuccess}
          onCancel={closePaymentModal}
        />
      ) : null}
    </div>
  );
}

export default SearchPage;
