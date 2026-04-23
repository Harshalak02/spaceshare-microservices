import { useEffect, useState } from 'react';
import { ApiError, apiRequest } from '../services/api';
import SubscriptionModal from '../components/SubscriptionModal';
import UpgradeModal from '../components/UpgradeModal';

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

function AddSpacePage({ token, user }) {
    const [form, setForm] = useState(getInitialForm);
    const [geocodeBusy, setGeocodeBusy] = useState(false);
    const [submitBusy, setSubmitBusy] = useState(false);
    const [subscriptionBusy, setSubscriptionBusy] = useState(true);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [notice, setNotice] = useState({ type: '', text: '' });

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

    function handleSubscriptionSuccess(plan) {
        const normalizedPlan = normalizePlan(plan);
        setCurrentPlan(normalizedPlan);
        setShowSubscriptionModal(false);
        setShowUpgradeModal(false);
        setNotice({ type: 'success', text: `${formatPlan(normalizedPlan)} plan activated. You can now create listings.` });
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
                    timezone: form.timezone || 'UTC'
                }
            });

            setNotice({ type: 'success', text: 'Listing created successfully.' });
            setForm(getInitialForm());
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

    const isBusy = geocodeBusy || submitBusy || subscriptionBusy;

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

                    {/* Hidden lat/lon fields – populated automatically by geocoding */}
                    <input type="hidden" id="lat" name="lat" value={form.lat} />
                    <input type="hidden" id="lon" name="lon" value={form.lon} />

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
