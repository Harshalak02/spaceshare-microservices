import { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { parseUtcDate } from '../utils/dateTime';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function addDaysISO(base, days) {
    const date = new Date(`${base}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
}

function normalizeTime(value, fallback) {
    if (!value) return fallback;
    const text = String(value);
    return text.length >= 5 ? text.slice(0, 5) : text;
}

function defaultWeek() {
    return DAYS.map((_, index) => ({
        day_of_week: index,
        is_open: false,
        open_time_local: '09:00',
        close_time_local: '18:00'
    }));
}

function normalizeWeek(inputWeek) {
    const byDay = new Map((inputWeek || []).map((entry) => [Number(entry.day_of_week), entry]));
    return DAYS.map((_, index) => {
        const found = byDay.get(index);
        if (!found) {
            return {
                day_of_week: index,
                is_open: false,
                open_time_local: '09:00',
                close_time_local: '18:00'
            };
        }

        return {
            day_of_week: index,
            is_open: Boolean(found.is_open),
            open_time_local: normalizeTime(found.open_time_local, '09:00'),
            close_time_local: normalizeTime(found.close_time_local, '18:00')
        };
    });
}

function formatDate(value) {
    const parsed = parseUtcDate(value);
    if (!parsed) return '-';
    return parsed.toLocaleString();
}

function normalizeImageUrls(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function MyListingsPage({ token, user }) {
    const [spaces, setSpaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState({ type: '', text: '' });

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [saveBusy, setSaveBusy] = useState(false);

    const [activeSpaceId, setActiveSpaceId] = useState(null);
    const [manageBusy, setManageBusy] = useState(false);

    const [weeklyForm, setWeeklyForm] = useState({ timezone: 'UTC', week: defaultWeek() });
    const [weeklySaveBusy, setWeeklySaveBusy] = useState(false);

    const [overrideRange, setOverrideRange] = useState({ from: todayISO(), to: addDaysISO(todayISO(), 30) });
    const [overrides, setOverrides] = useState([]);
    const [overrideForm, setOverrideForm] = useState({
        date_local: todayISO(),
        closed_all_day: false,
        open_time_local: '09:00',
        close_time_local: '18:00',
        note: ''
    });
    const [overrideBusy, setOverrideBusy] = useState(false);

    const [slotPreview, setSlotPreview] = useState(null);
    const [slotPreviewBusy, setSlotPreviewBusy] = useState(false);

    async function loadSpaces() {
        setLoading(true);
        setNotice({ type: '', text: '' });

        try {
            const result = await apiRequest('/listings/spaces/my', { token });
            setSpaces(result || []);
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to load your listings: ${error.message}` });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (user?.role === 'host') {
            loadSpaces();
        }
    }, [user?.role]);

    function startEdit(space) {
        setEditingId(space.id);
        setEditForm({
            title: space.title,
            description: space.description || '',
            location_name: space.location_name || '',
            lat: space.lat,
            lon: space.lon,
            price_per_hour: space.price_per_hour,
            capacity: space.capacity,
            timezone: space.timezone || 'UTC',
            image_urls_text: normalizeImageUrls(space.image_urls).join('\n')
        });
    }

    function cancelEdit() {
        setEditingId(null);
        setEditForm(null);
    }

    async function saveEdit(event) {
        event.preventDefault();
        if (!editingId) return;

        setSaveBusy(true);
        try {
            await apiRequest(`/listings/spaces/${editingId}`, {
                method: 'PUT',
                token,
                body: {
                    ...editForm,
                    lat: Number(editForm.lat),
                    lon: Number(editForm.lon),
                    price_per_hour: Number(editForm.price_per_hour),
                    capacity: Number(editForm.capacity),
                    image_urls: editForm.image_urls_text
                        .split('\n')
                        .map((item) => item.trim())
                        .filter(Boolean)
                }
            });

            setNotice({ type: 'success', text: `Listing #${editingId} updated.` });
            cancelEdit();
            await loadSpaces();
        } catch (error) {
            setNotice({ type: 'error', text: `Update failed: ${error.message}` });
        } finally {
            setSaveBusy(false);
        }
    }

    async function deleteListing(spaceId) {
        const accepted = window.confirm('Delete this listing permanently?');
        if (!accepted) return;

        try {
            await apiRequest(`/listings/spaces/${spaceId}`, {
                method: 'DELETE',
                token
            });

            setSpaces((prev) => prev.filter((space) => space.id !== spaceId));
            setNotice({ type: 'success', text: `Listing #${spaceId} deleted.` });
            if (activeSpaceId === spaceId) {
                setActiveSpaceId(null);
            }
        } catch (error) {
            setNotice({ type: 'error', text: `Delete failed: ${error.message}` });
        }
    }

    async function loadWeekly(spaceId, fallbackTimezone) {
        const response = await apiRequest(`/listings/spaces/${spaceId}/availability/weekly`, { token });
        setWeeklyForm({
            timezone: response?.timezone || fallbackTimezone || 'UTC',
            week: normalizeWeek(response?.week || [])
        });
    }

    async function loadOverrides(spaceId) {
        const response = await apiRequest(
            `/listings/spaces/${spaceId}/availability/overrides?from=${overrideRange.from}&to=${overrideRange.to}`,
            { token }
        );
        setOverrides(response?.overrides || []);
    }

    async function loadSlotPreview(spaceId) {
        setSlotPreviewBusy(true);
        try {
            const response = await apiRequest(
                `/listings/spaces/${spaceId}/slots?from=${overrideRange.from}&to=${overrideRange.to}`,
                { token }
            );
            setSlotPreview(response);
        } finally {
            setSlotPreviewBusy(false);
        }
    }

    async function openManager(space) {
        const next = activeSpaceId === space.id ? null : space.id;
        setActiveSpaceId(next);

        if (!next) return;

        setManageBusy(true);
        setNotice({ type: '', text: '' });
        setWeeklyForm({ timezone: space.timezone || 'UTC', week: defaultWeek() });
        setOverrides([]);
        setSlotPreview(null);

        try {
            await Promise.all([
                loadWeekly(space.id, space.timezone),
                loadOverrides(space.id),
                loadSlotPreview(space.id)
            ]);
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to open availability manager: ${error.message}` });
        } finally {
            setManageBusy(false);
        }
    }

    function updateWeekRow(dayIndex, key, value) {
        setWeeklyForm((prev) => ({
            ...prev,
            week: prev.week.map((row, index) => (index === dayIndex ? { ...row, [key]: value } : row))
        }));
    }

    async function saveWeekly() {
        if (!activeSpaceId) return;

        setWeeklySaveBusy(true);
        try {
            await apiRequest(`/listings/spaces/${activeSpaceId}/availability/weekly`, {
                method: 'PUT',
                token,
                body: {
                    timezone: weeklyForm.timezone,
                    week: weeklyForm.week.map((entry) => ({
                        day_of_week: entry.day_of_week,
                        is_open: entry.is_open,
                        open_time_local: entry.is_open ? entry.open_time_local : null,
                        close_time_local: entry.is_open ? entry.close_time_local : null
                    }))
                }
            });

            setNotice({ type: 'success', text: 'Weekly availability updated.' });
            await loadSlotPreview(activeSpaceId);
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to save weekly availability: ${error.message}` });
        } finally {
            setWeeklySaveBusy(false);
        }
    }

    async function saveOverride(event) {
        event.preventDefault();
        if (!activeSpaceId) return;

        setOverrideBusy(true);
        try {
            await apiRequest(`/listings/spaces/${activeSpaceId}/availability/overrides`, {
                method: 'PUT',
                token,
                body: {
                    date_local: overrideForm.date_local,
                    closed_all_day: overrideForm.closed_all_day,
                    open_time_local: overrideForm.closed_all_day ? null : overrideForm.open_time_local,
                    close_time_local: overrideForm.closed_all_day ? null : overrideForm.close_time_local,
                    note: overrideForm.note
                }
            });

            setNotice({ type: 'success', text: `Override saved for ${overrideForm.date_local}.` });
            await Promise.all([loadOverrides(activeSpaceId), loadSlotPreview(activeSpaceId)]);
            setOverrideForm((prev) => ({ ...prev, note: '' }));
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to save override: ${error.message}` });
        } finally {
            setOverrideBusy(false);
        }
    }

    async function deleteOverride(overrideId) {
        if (!activeSpaceId) return;

        try {
            await apiRequest(`/listings/spaces/${activeSpaceId}/availability/overrides/${overrideId}`, {
                method: 'DELETE',
                token
            });

            setNotice({ type: 'success', text: `Override #${overrideId} deleted.` });
            await Promise.all([loadOverrides(activeSpaceId), loadSlotPreview(activeSpaceId)]);
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to delete override: ${error.message}` });
        }
    }

    async function refreshManagerData() {
        if (!activeSpaceId) return;

        setManageBusy(true);
        try {
            await Promise.all([loadOverrides(activeSpaceId), loadSlotPreview(activeSpaceId)]);
        } catch (error) {
            setNotice({ type: 'error', text: `Failed to refresh manager data: ${error.message}` });
        } finally {
            setManageBusy(false);
        }
    }

    if (user?.role !== 'host') {
        return <div className="notice info">My Listings is available only for host accounts.</div>;
    }

    return (
        <div className="stack fade">
            <div className="hero-strip">
                <h2>My Listings</h2>
                <p>Edit listings, manage weekly availability, and apply date-specific overrides.</p>
            </div>

            <div className="btn-row">
                <button className="btn btn-muted" onClick={loadSpaces} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh Listings'}
                </button>
            </div>

            {notice.text ? <div className={`notice ${notice.type || 'info'}`}>{notice.text}</div> : null}

            {loading ? <div className="notice info">Loading your listings...</div> : null}

            {!loading && spaces.length === 0 ? <div className="notice info">No listings found yet.</div> : null}

            {spaces.map((space) => (
                <article className="card" key={space.id}>
                    <div className="card-title-row">
                        <div className="stack" style={{ gap: '0.45rem' }}>
                            <h3>{space.title}</h3>
                            <p className="tiny">{space.description || 'No description provided.'}</p>
                            {Array.isArray(space.image_urls) && space.image_urls.length > 0 ? (
                                <div className="listing-image-row">
                                    {space.image_urls.slice(0, 4).map((url, index) => (
                                        <img key={`${space.id}-thumb-${index}`} src={url} alt={`${space.title} ${index + 1}`} className="listing-thumb" />
                                    ))}
                                </div>
                            ) : null}
                            <div className="meta-row">
                                <span>{space.location_name || `${space.lat}, ${space.lon}`}</span>
                                <span>INR {space.price_per_hour}/hour</span>
                                <span>Capacity {space.capacity}</span>
                                <span>Timezone {space.timezone || 'UTC'}</span>
                            </div>
                        </div>

                        <div className="btn-row">
                            <button className="btn btn-muted" onClick={() => startEdit(space)}>Edit</button>
                            <button className="btn btn-muted" onClick={() => openManager(space)}>
                                {activeSpaceId === space.id ? 'Hide Availability' : 'Manage Availability'}
                            </button>
                            <button className="btn btn-danger" onClick={() => deleteListing(space.id)}>Delete</button>
                        </div>
                    </div>

                    {editingId === space.id && editForm ? (
                        <form className="stack" style={{ marginTop: '0.9rem' }} onSubmit={saveEdit}>
                            <div className="grid-2">
                                <div className="field">
                                    <label>Title</label>
                                    <input value={editForm.title} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} />
                                </div>
                                <div className="field">
                                    <label>Timezone</label>
                                    <input value={editForm.timezone} onChange={(event) => setEditForm((prev) => ({ ...prev, timezone: event.target.value }))} />
                                </div>
                            </div>

                            <div className="field">
                                <label>Description</label>
                                <textarea value={editForm.description} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} />
                            </div>

                            <div className="field">
                                <label>Image URLs (one per line)</label>
                                <textarea
                                    value={editForm.image_urls_text}
                                    onChange={(event) => setEditForm((prev) => ({ ...prev, image_urls_text: event.target.value }))}
                                    placeholder="https://example.com/image-1.jpg"
                                />
                            </div>

                            <div className="grid-3">
                                <div className="field">
                                    <label>Location Name</label>
                                    <input value={editForm.location_name} onChange={(event) => setEditForm((prev) => ({ ...prev, location_name: event.target.value }))} />
                                </div>
                                <div className="field">
                                    <label>Latitude</label>
                                    <input value={editForm.lat} onChange={(event) => setEditForm((prev) => ({ ...prev, lat: event.target.value }))} />
                                </div>
                                <div className="field">
                                    <label>Longitude</label>
                                    <input value={editForm.lon} onChange={(event) => setEditForm((prev) => ({ ...prev, lon: event.target.value }))} />
                                </div>
                                <div className="field">
                                    <label>Price per Hour</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={editForm.price_per_hour}
                                        onChange={(event) => setEditForm((prev) => ({ ...prev, price_per_hour: event.target.value }))}
                                    />
                                </div>
                                <div className="field">
                                    <label>Capacity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={editForm.capacity}
                                        onChange={(event) => setEditForm((prev) => ({ ...prev, capacity: event.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="btn-row">
                                <button className="btn btn-primary" type="submit" disabled={saveBusy}>
                                    {saveBusy ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button className="btn btn-muted" type="button" onClick={cancelEdit}>Cancel</button>
                            </div>
                        </form>
                    ) : null}

                    {activeSpaceId === space.id ? (
                        <div className="stack" style={{ marginTop: '0.95rem', paddingTop: '0.95rem', borderTop: '1px solid var(--line)' }}>
                            {manageBusy ? <div className="notice info">Loading availability manager...</div> : null}

                            <section className="stack">
                                <div className="card-title-row">
                                    <h4>Weekly Availability</h4>
                                    <button className="btn btn-primary" onClick={saveWeekly} disabled={weeklySaveBusy || manageBusy}>
                                        {weeklySaveBusy ? 'Saving...' : 'Save Weekly Rules'}
                                    </button>
                                </div>

                                <div className="field" style={{ maxWidth: '360px' }}>
                                    <label>Listing Timezone</label>
                                    <input
                                        value={weeklyForm.timezone}
                                        onChange={(event) => setWeeklyForm((prev) => ({ ...prev, timezone: event.target.value }))}
                                    />
                                </div>

                                <div className="table-like">
                                    {weeklyForm.week.map((row, index) => (
                                        <div className="day-row" key={row.day_of_week}>
                                            <strong>{DAYS[index]}</strong>
                                            <label className="tiny" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={row.is_open}
                                                    onChange={(event) => updateWeekRow(index, 'is_open', event.target.checked)}
                                                />
                                                Open
                                            </label>
                                            <input
                                                type="time"
                                                step="3600"
                                                value={row.open_time_local}
                                                disabled={!row.is_open}
                                                onChange={(event) => updateWeekRow(index, 'open_time_local', event.target.value)}
                                            />
                                            <input
                                                type="time"
                                                step="3600"
                                                value={row.close_time_local}
                                                disabled={!row.is_open}
                                                onChange={(event) => updateWeekRow(index, 'close_time_local', event.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="stack">
                                <div className="card-title-row">
                                    <h4>Overrides and Slot Preview</h4>
                                    <button className="btn btn-muted" onClick={refreshManagerData} disabled={manageBusy || slotPreviewBusy}>
                                        Refresh Data
                                    </button>
                                </div>

                                <div className="grid-3">
                                    <div className="field">
                                        <label>Range From</label>
                                        <input
                                            type="date"
                                            value={overrideRange.from}
                                            onChange={(event) => setOverrideRange((prev) => ({ ...prev, from: event.target.value }))}
                                        />
                                    </div>
                                    <div className="field">
                                        <label>Range To</label>
                                        <input
                                            type="date"
                                            value={overrideRange.to}
                                            onChange={(event) => setOverrideRange((prev) => ({ ...prev, to: event.target.value }))}
                                        />
                                    </div>
                                    <div className="btn-row" style={{ alignItems: 'end' }}>
                                        <button className="btn btn-muted" type="button" onClick={refreshManagerData} disabled={manageBusy || slotPreviewBusy}>
                                            Apply Range
                                        </button>
                                    </div>
                                </div>

                                <div className="stack">
                                    {overrides.length === 0 ? (
                                        <div className="notice info">No overrides in selected range.</div>
                                    ) : (
                                        overrides.map((override) => (
                                            <div className="card" key={override.id}>
                                                <div className="card-title-row">
                                                    <strong>{override.date_local}</strong>
                                                    <button className="btn btn-danger" onClick={() => deleteOverride(override.id)}>Delete</button>
                                                </div>
                                                <p className="tiny" style={{ marginTop: '0.4rem' }}>
                                                    {override.closed_all_day
                                                        ? 'Closed all day'
                                                        : `${normalizeTime(override.open_time_local, '--:--')} to ${normalizeTime(override.close_time_local, '--:--')}`}
                                                </p>
                                                {override.note ? <p className="tiny" style={{ marginTop: '0.3rem' }}>{override.note}</p> : null}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <form className="card stack" onSubmit={saveOverride}>
                                    <h4>Add or Update Override</h4>

                                    <div className="grid-3">
                                        <div className="field">
                                            <label>Date</label>
                                            <input
                                                type="date"
                                                value={overrideForm.date_local}
                                                onChange={(event) => setOverrideForm((prev) => ({ ...prev, date_local: event.target.value }))}
                                                required
                                            />
                                        </div>
                                        <label className="tiny" style={{ display: 'flex', alignItems: 'end', gap: '0.45rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={overrideForm.closed_all_day}
                                                onChange={(event) => setOverrideForm((prev) => ({ ...prev, closed_all_day: event.target.checked }))}
                                            />
                                            Closed all day
                                        </label>
                                    </div>

                                    <div className="grid-2">
                                        <div className="field">
                                            <label>Open Time</label>
                                            <input
                                                type="time"
                                                step="3600"
                                                value={overrideForm.open_time_local}
                                                disabled={overrideForm.closed_all_day}
                                                onChange={(event) => setOverrideForm((prev) => ({ ...prev, open_time_local: event.target.value }))}
                                            />
                                        </div>
                                        <div className="field">
                                            <label>Close Time</label>
                                            <input
                                                type="time"
                                                step="3600"
                                                value={overrideForm.close_time_local}
                                                disabled={overrideForm.closed_all_day}
                                                onChange={(event) => setOverrideForm((prev) => ({ ...prev, close_time_local: event.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="field">
                                        <label>Note (optional)</label>
                                        <input
                                            value={overrideForm.note}
                                            onChange={(event) => setOverrideForm((prev) => ({ ...prev, note: event.target.value }))}
                                        />
                                    </div>

                                    <div className="btn-row">
                                        <button className="btn btn-primary" type="submit" disabled={overrideBusy}>
                                            {overrideBusy ? 'Saving...' : 'Save Override'}
                                        </button>
                                    </div>
                                </form>

                                <div className="card stack">
                                    <div className="card-title-row">
                                        <h4>Slot Preview</h4>
                                        <button className="btn btn-muted" onClick={() => loadSlotPreview(space.id)} disabled={slotPreviewBusy}>
                                            {slotPreviewBusy ? 'Loading...' : 'Reload Slots'}
                                        </button>
                                    </div>

                                    {slotPreview ? (
                                        <>
                                            <p className="tiny">
                                                {slotPreview.slots?.length || 0} slot(s) available in {slotPreview.timezone || 'UTC'} between {overrideRange.from} and {overrideRange.to}.
                                            </p>
                                            <div className="slot-grid">
                                                {(slotPreview.slots || []).slice(0, 14).map((slot) => (
                                                    <div className="slot-btn" key={slot.slot_start_utc}>
                                                        <div>{formatDate(slot.slot_start_local)}</div>
                                                        <div className="tiny">to {formatDate(slot.slot_end_local)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="notice info">No slot preview loaded yet.</div>
                                    )}
                                </div>
                            </section>
                        </div>
                    ) : null}
                </article>
            ))}
        </div>
    );
}

export default MyListingsPage;
