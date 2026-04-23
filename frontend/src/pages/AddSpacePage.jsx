import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { ApiError, apiRequest } from '../services/api';
import SubscriptionModal from '../components/SubscriptionModal';
import UpgradeModal from '../components/UpgradeModal';

const MAX_IMAGES = 8;
const DEFAULT_ADD_MAP_CENTER = [17.4477, 78.3486];
const DEFAULT_ADD_MAP_ZOOM = 13;
const UPLOAD_IMAGE_MAX_DIMENSION = 1280;

function getInitialForm() {
    return {
        title: '',
        description: '',
        location_name: '',
        lat: '',
        lon: '',
        price_per_hour: '',
        capacity: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    };
}

function getUserIdFromToken(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
    } catch {
        return null;
    }
}

function normalizePlan(planName) {
    if (!planName || typeof planName !== 'string') return null;

    const normalized = planName.trim().toLowerCase();
    if (normalized === 'free' || normalized === 'basic' || normalized === 'pro') {
        return normalized;
    }
    if (normalized === 'host_monthly') return 'basic';
    if (normalized === 'host_quarterly' || normalized === 'host_yearly') return 'pro';
    return null;
}

function formatPlan(plan) {
    if (!plan) return '-';
    return `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
}

function normalizeImageList(values) {
    const seen = new Set();
    const cleaned = [];

    for (const raw of values || []) {
        const url = String(raw || '').trim();
        if (!url) continue;

        const isHttp = /^https?:\/\//i.test(url);
        const isDataImage = /^data:image\/[a-z0-9.+-]+;base64,/i.test(url);
        if (!isHttp && !isDataImage) continue;
        if (seen.has(url)) continue;

        seen.add(url);
        cleaned.push(url);
        if (cleaned.length >= MAX_IMAGES) break;
    }

    return cleaned;
}

function parseCoordinate(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function isValidLatLon(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon);
}

function MapClickPicker({ onPick }) {
    useMapEvents({
        click(event) {
            onPick(event.latlng.lat, event.latlng.lng);
        }
    });

    return null;
}

function MapRecenter({ center }) {
    const map = useMap();

    useEffect(() => {
        map.setView(center, map.getZoom(), { animate: true });
    }, [center, map]);

    return null;
}

function resizeImageFileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            try {
                const width = image.width;
                const height = image.height;
                const scale = Math.min(1, UPLOAD_IMAGE_MAX_DIMENSION / Math.max(width, height));
                const targetWidth = Math.max(1, Math.round(width * scale));
                const targetHeight = Math.max(1, Math.round(height * scale));

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                const context = canvas.getContext('2d');
                if (!context) {
                    throw new Error('Image processing failed');
                }

                context.drawImage(image, 0, 0, targetWidth, targetHeight);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
                URL.revokeObjectURL(objectUrl);
                resolve(dataUrl);
            } catch (error) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error(`Failed to process file ${file.name}: ${error.message}`));
            }
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to read file ${file.name}`));
        };

        image.src = objectUrl;
    });
}

function AddSpacePage({ token, user }) {
    const [form, setForm] = useState(getInitialForm);
    const [geocodeBusy, setGeocodeBusy] = useState(false);
    const [submitBusy, setSubmitBusy] = useState(false);
    const [subscriptionBusy, setSubscriptionBusy] = useState(true);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [notice, setNotice] = useState({ type: '', text: '' });
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [imageUrls, setImageUrls] = useState([]);
    const [uploadBusy, setUploadBusy] = useState(false);
    const [mapAnchor, setMapAnchor] = useState(DEFAULT_ADD_MAP_CENTER);

    const actualUserId = user?.userId || getUserIdFromToken(token);

    useEffect(() => {
        async function checkSubscription() {
            setSubscriptionBusy(true);
            try {
                const details = await apiRequest('/subscriptions/my', { token });
                const plan = normalizePlan(details?.plan || details?.plan_type);

                if (plan) {
                    setCurrentPlan(plan);
                    setShowSubscriptionModal(false);
                } else {
                    setCurrentPlan(null);
                    setShowSubscriptionModal(true);
                }
            } catch (error) {
                if (error instanceof ApiError && error.status === 404) {
                    setCurrentPlan(null);
                    setShowSubscriptionModal(true);
                } else {
                    setNotice({ type: 'error', text: `Failed to verify subscription: ${error.message}` });
                }
            } finally {
                setSubscriptionBusy(false);
            }
        }

        if (!token || !actualUserId) {
            setSubscriptionBusy(false);
            return;
        }

        checkSubscription();
    }, [token, actualUserId]);

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
                setNotice({ type: 'info', text: 'No matching location found. Please try a different location name.' });
            } else {
                const lat = Number(data[0].lat);
                const lon = Number(data[0].lon);
                setForm((prev) => ({
                    ...prev,
                    lat: String(lat),
                    lon: String(lon)
                }));
                if (isValidLatLon(lat, lon)) {
                    setMapAnchor([lat, lon]);
                }
                setNotice({ type: 'success', text: `Coordinates loaded for ${data[0].display_name}.` });
            }
        } catch (error) {
            setNotice({ type: 'error', text: `Geocoding failed: ${error.message}` });
        } finally {
            setGeocodeBusy(false);
        }
    }

    function handleSubscriptionSuccess(plan) {
        const normalizedPlan = normalizePlan(plan);
        setCurrentPlan(normalizedPlan);
        setShowSubscriptionModal(false);
        setShowUpgradeModal(false);
        setNotice({ type: 'success', text: `${formatPlan(normalizedPlan)} plan activated. You can now create listings.` });
    }

    function addImageUrlsFromInput() {
        const fromInput = imageUrlInput
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);

        if (fromInput.length === 0) {
            setNotice({ type: 'info', text: 'Paste one or more image URLs first.' });
            return;
        }

        const merged = normalizeImageList([...imageUrls, ...fromInput]);
        setImageUrls(merged);
        setImageUrlInput('');
        setNotice({ type: 'success', text: `Added ${Math.max(merged.length - imageUrls.length, 0)} image(s).` });
    }

    async function handleImageUpload(event) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        const availableSlots = Math.max(0, MAX_IMAGES - imageUrls.length);
        if (availableSlots === 0) {
            setNotice({ type: 'info', text: `You can add up to ${MAX_IMAGES} images per listing.` });
            event.target.value = '';
            return;
        }

        setUploadBusy(true);
        try {
            const selectedFiles = files.slice(0, availableSlots);
            const dataUrls = await Promise.all(selectedFiles.map((file) => resizeImageFileToDataUrl(file)));
            const merged = normalizeImageList([...imageUrls, ...dataUrls]);
            setImageUrls(merged);
            const uploadedCount = Math.max(merged.length - imageUrls.length, 0);
            const ignoredCount = files.length - selectedFiles.length;
            setNotice({
                type: 'success',
                text: ignoredCount > 0
                    ? `Uploaded ${uploadedCount} image(s). Ignored ${ignoredCount} extra file(s) due to image limit.`
                    : `Uploaded ${uploadedCount} image(s).`
            });
        } catch (error) {
            setNotice({ type: 'error', text: `Image upload failed: ${error.message}` });
        } finally {
            setUploadBusy(false);
            event.target.value = '';
        }
    }

    async function reverseGeocodeLocationName(lat, lon) {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=jsonv2`
        );
        const data = await response.json();
        return data?.display_name || '';
    }

    async function handleMapPick(lat, lon) {
        setForm((prev) => ({
            ...prev,
            lat: lat.toFixed(6),
            lon: lon.toFixed(6)
        }));
        setMapAnchor([lat, lon]);
        setNotice({ type: 'info', text: 'Coordinates updated from map click.' });

        try {
            const locationName = await reverseGeocodeLocationName(lat, lon);
            if (locationName) {
                setForm((prev) => ({ ...prev, location_name: locationName }));
            }
        } catch {
            // Keep map picking usable even if reverse geocoding is unavailable.
        }
    }

    function removeImageAt(index) {
        setImageUrls((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!currentPlan) {
            setShowSubscriptionModal(true);
            setNotice({ type: 'info', text: 'Choose a subscription plan before creating a listing.' });
            return;
        }

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
                    timezone: form.timezone || 'UTC',
                    image_urls: imageUrls
                }
            });

            setNotice({ type: 'success', text: 'Listing created successfully.' });
            setForm(getInitialForm());
            setImageUrls([]);
            setImageUrlInput('');
        } catch (error) {
            const code = error instanceof ApiError ? error.payload?.code : null;

            if (code === 'NO_SUBSCRIPTION' || (error instanceof ApiError && error.status === 402)) {
                setCurrentPlan(null);
                setShowSubscriptionModal(true);
                setNotice({ type: 'info', text: 'No active subscription found. Please select a plan to continue.' });
            } else if (code === 'PLAN_LIMIT_REACHED') {
                setShowUpgradeModal(true);
                setNotice({ type: 'info', text: 'Listing limit reached for your current plan. Upgrade to continue.' });
            } else {
                setNotice({ type: 'error', text: `Unable to create listing: ${error.message}` });
            }
        } finally {
            setSubmitBusy(false);
        }
    }

    const isBusy = geocodeBusy || submitBusy || subscriptionBusy || uploadBusy;
    const selectedLat = parseCoordinate(form.lat);
    const selectedLon = parseCoordinate(form.lon);
    const selectedPosition = isValidLatLon(selectedLat, selectedLon) ? [selectedLat, selectedLon] : null;
    const mapCenter = selectedPosition || mapAnchor;

    return (
        <div className="stack fade">
            <div className="hero-strip">
                <h2>Create a New Listing</h2>
                <p>Define location, pricing, and timezone to start accepting bookings.</p>
            </div>

            <section className="card stack" style={{ gap: '0.75rem' }}>
                {subscriptionBusy ? (
                    <div className="notice info">Checking subscription status...</div>
                ) : (
                    <div className={`notice ${currentPlan ? 'success' : 'info'}`}>
                        {currentPlan
                            ? `Current plan: ${formatPlan(currentPlan)}`
                            : 'No subscription found. Select a plan to start listing spaces.'}
                    </div>
                )}

                <div className="btn-row">
                    <button
                        className="btn btn-muted"
                        type="button"
                        onClick={() => setShowSubscriptionModal(true)}
                        disabled={subscriptionBusy}
                    >
                        {currentPlan ? 'Change Plan' : 'Choose Plan'}
                    </button>
                </div>

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

                    <section className="stack" style={{ gap: '0.6rem' }}>
                        <div className="card-title-row">
                            <h4>Listing Images</h4>
                            <span className="tiny">{imageUrls.length}/{MAX_IMAGES} added</span>
                        </div>

                        <div className="field">
                            <label htmlFor="image_urls_input">Image URLs (one per line)</label>
                            <textarea
                                id="image_urls_input"
                                value={imageUrlInput}
                                onChange={(event) => setImageUrlInput(event.target.value)}
                                placeholder="https://example.com/space-front.jpg"
                            />
                        </div>

                        <div className="btn-row">
                            <button className="btn btn-muted" type="button" onClick={addImageUrlsFromInput} disabled={uploadBusy || imageUrls.length >= MAX_IMAGES}>
                                Add URL Images
                            </button>
                            <label className="btn btn-muted" style={{ display: 'inline-flex', alignItems: 'center', cursor: uploadBusy ? 'not-allowed' : 'pointer' }}>
                                {uploadBusy ? 'Uploading...' : 'Upload Files'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    disabled={uploadBusy || imageUrls.length >= MAX_IMAGES}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>

                        {imageUrls.length > 0 ? (
                            <div className="listing-image-grid">
                                {imageUrls.map((url, index) => (
                                    <div className="listing-image-item" key={`${url}-${index}`}>
                                        <img src={url} alt={`Listing image ${index + 1}`} />
                                        <button className="btn btn-danger" type="button" onClick={() => removeImageAt(index)}>Remove</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="notice info">Add at least one image to improve booking conversion.</div>
                        )}
                    </section>

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

                    <section className="stack" style={{ gap: '0.6rem' }}>
                        <div className="card-title-row">
                            <h4>Pick Location on Map</h4>
                            <span className="tiny">Click anywhere on map to set coordinates</span>
                        </div>

                        <div className="add-space-map-shell">
                            <MapContainer center={mapCenter} zoom={DEFAULT_ADD_MAP_ZOOM} className="add-space-map-canvas" scrollWheelZoom>
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <MapRecenter center={mapCenter} />
                                <MapClickPicker onPick={handleMapPick} />

                                {selectedPosition ? (
                                    <Marker position={selectedPosition}>
                                        <Popup>
                                            <strong>Selected Listing Location</strong>
                                            <div>{form.location_name || `${selectedLat.toFixed(6)}, ${selectedLon.toFixed(6)}`}</div>
                                        </Popup>
                                    </Marker>
                                ) : null}
                            </MapContainer>
                        </div>
                    </section>

                    <div className="grid-2">
                        <div className="field">
                            <label htmlFor="lat">Latitude</label>
                            <input
                                id="lat"
                                name="lat"
                                value={form.lat}
                                onChange={updateForm}
                                placeholder="Click map or use geocode"
                                required
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="lon">Longitude</label>
                            <input
                                id="lon"
                                name="lon"
                                value={form.lon}
                                onChange={updateForm}
                                placeholder="Click map or use geocode"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid-2">
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
                        <button className="btn btn-primary" type="submit" disabled={isBusy}>
                            {submitBusy ? 'Creating...' : 'Create Listing'}
                        </button>
                    </div>
                </form>

                {notice.text ? <div className={`notice ${notice.type || 'info'}`}>{notice.text}</div> : null}
            </section>

            <SubscriptionModal
                isOpen={showSubscriptionModal}
                onClose={() => setShowSubscriptionModal(false)}
                onSubscribe={handleSubscriptionSuccess}
                token={token}
                userId={actualUserId}
            />

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                onUpgrade={() => {
                    setShowUpgradeModal(false);
                    setShowSubscriptionModal(true);
                }}
                currentPlan={currentPlan || 'free'}
            />
        </div>
    );
}

export default AddSpacePage;
