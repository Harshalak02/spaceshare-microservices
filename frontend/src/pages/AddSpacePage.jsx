import { useState } from 'react';
import { apiRequest } from '../services/api';

const initialForm = {
    title: '',
    description: '',
    location_name: '',
    lat: '',
    lon: '',
    price_per_hour: '',
    capacity: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
};

function AddSpacePage({ token }) {
    const [form, setForm] = useState(initialForm);
    const [geocodeBusy, setGeocodeBusy] = useState(false);
    const [submitBusy, setSubmitBusy] = useState(false);
    const [notice, setNotice] = useState({ type: '', text: '' });

    function updateForm(event) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    async function geocodeLocation() {
        if (!form.location_name.trim()) {
            setNotice({ type: 'info', text: 'Enter a location name to fetch coordinates.' });
            return;
        }

        setGeocodeBusy(true);
        setNotice({ type: '', text: '' });
        try {
            const encoded = encodeURIComponent(form.location_name.trim());
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`);
            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                setNotice({ type: 'info', text: 'No matching location found. Please enter coordinates manually.' });
            } else {
                setForm((prev) => ({
                    ...prev,
                    lat: data[0].lat,
                    lon: data[0].lon
                }));
                setNotice({ type: 'success', text: `Coordinates loaded for ${data[0].display_name}.` });
            }
        } catch (error) {
            setNotice({ type: 'error', text: `Geocoding failed: ${error.message}` });
        } finally {
            setGeocodeBusy(false);
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitBusy(true);
        setNotice({ type: '', text: '' });

        try {
            await apiRequest('/listings/spaces', {
                method: 'POST',
                token,
                body: {
                    title: form.title,
                    description: form.description,
                    location_name: form.location_name,
                    lat: Number(form.lat),
                    lon: Number(form.lon),
                    price_per_hour: Number(form.price_per_hour),
                    capacity: Number(form.capacity),
                    timezone: form.timezone || 'UTC'
                }
            });

            setNotice({ type: 'success', text: 'Listing created successfully.' });
            setForm(initialForm);
        } catch (error) {
            setNotice({ type: 'error', text: `Unable to create listing: ${error.message}` });
        } finally {
            setSubmitBusy(false);
        }
    }

    return (
        <div className="stack fade">
            <div className="hero-strip">
                <h2>Create a New Listing</h2>
                <p>Define location, pricing, and timezone to start accepting bookings.</p>
            </div>

            <section className="card">
                <form className="stack" onSubmit={handleSubmit}>
                    <div className="grid-2">
                        <div className="field">
                            <label htmlFor="title">Title</label>
                            <input id="title" name="title" value={form.title} onChange={updateForm} required />
                        </div>
                        <div className="field">
                            <label htmlFor="timezone">Timezone</label>
                            <input id="timezone" name="timezone" value={form.timezone} onChange={updateForm} required />
                        </div>
                    </div>

                    <div className="field">
                        <label htmlFor="description">Description</label>
                        <textarea id="description" name="description" value={form.description} onChange={updateForm} />
                    </div>

                    <div className="grid-2">
                        <div className="field">
                            <label htmlFor="location_name">Location Name</label>
                            <input
                                id="location_name"
                                name="location_name"
                                value={form.location_name}
                                onChange={updateForm}
                                placeholder="e.g. Hyderabad, Financial District"
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
                            <input id="lat" name="lat" value={form.lat} onChange={updateForm} required />
                        </div>
                        <div className="field">
                            <label htmlFor="lon">Longitude</label>
                            <input id="lon" name="lon" value={form.lon} onChange={updateForm} required />
                        </div>
                        <div className="field">
                            <label htmlFor="capacity">Capacity</label>
                            <input id="capacity" name="capacity" type="number" min="1" value={form.capacity} onChange={updateForm} required />
                        </div>
                        <div className="field">
                            <label htmlFor="price_per_hour">Price per Hour</label>
                            <input
                                id="price_per_hour"
                                name="price_per_hour"
                                type="number"
                                min="1"
                                step="0.01"
                                value={form.price_per_hour}
                                onChange={updateForm}
                                required
                            />
                        </div>
                    </div>

                    <div className="btn-row">
                        <button className="btn btn-primary" type="submit" disabled={submitBusy}>
                            {submitBusy ? 'Creating...' : 'Create Listing'}
                        </button>
                    </div>
                </form>

                {notice.text ? <div className={`notice ${notice.type || 'info'}`} style={{ marginTop: '0.75rem' }}>{notice.text}</div> : null}
            </section>
        </div>
    );
}

export default AddSpacePage;
