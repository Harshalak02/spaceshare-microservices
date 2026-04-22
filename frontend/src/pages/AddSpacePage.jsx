import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import SubscriptionModal from '../components/SubscriptionModal';
import UpgradeModal from '../components/UpgradeModal';
function getUserIdFromToken(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
    } catch {
        return null;
    }
}
function AddSpacePage({ token, onBack, userId }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        location_name: '',
        lat: '',
        lon: '',
        price_per_hour: '',
        capacity: '',
        amenities: [],
        otherAmenity: ''
    });
    const [message, setMessage] = useState('');
    const [availableAmenities, setAvailableAmenities] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchTimeout = useRef(null);
    const lastRequestId = useRef(0);
    const actualUserId = userId || getUserIdFromToken(token);


    // Subscription state
    const [currentPlan, setCurrentPlan] = useState(null);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);
    const [subscriptionError, setSubscriptionError] = useState('');

    useEffect(() => {
        async function fetchAmenities() {
            try {
                const res = await apiRequest('/listings/amenities', 'GET', null, token);
                setAvailableAmenities(res);
            } catch (err) {
                console.error('Failed to load amenities', err);
            }
        }
        fetchAmenities();
    }, [token]);

    // Check subscription on page load
    useEffect(() => {
        async function checkSubscription() {
            console.log("🔥 Calling subscription API");

            setSubscriptionLoading(true);
            setSubscriptionError('');

            try {
                const sub = await fetch(`http://localhost:4005/me/${actualUserId}`)
                    .then(res => res.json());
                console.log("✅ Response:", sub);

                if (sub && sub.plan) {
                    setCurrentPlan(sub.plan);
                    setShowSubscriptionModal(false); // 🔥 ADD THIS
                } else {
                    setCurrentPlan(null);
                    setShowSubscriptionModal(true);
                }
            } catch (err) {
                console.log("❌ Error:", err);

                if (err.status === 404 || err.code === 'NO_SUBSCRIPTION') {
                    setCurrentPlan(null);
                    setShowSubscriptionModal(true);
                } else {
                    setSubscriptionError(err.message || 'Failed to check subscription');
                }
            } finally {
                console.log("🔥 FINALLY RUNNING");
                setSubscriptionLoading(false);
            }
        }

        if (actualUserId && token) {
            checkSubscription();
        } else {
            console.log("❌ Missing userId/token", userId, token);
        }
    }, [actualUserId, token]);

    async function fetchSuggestions(query) {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        const trimmed = query.trim();

        if (!trimmed || trimmed.length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            const currentId = ++lastRequestId.current;

            try {
                const data = await apiRequest(
                    `/listings/autocomplete?q=${encodeURIComponent(trimmed)}`,
                    'GET',
                    null,
                    token
                );

                if (currentId === lastRequestId.current) {
                    setSuggestions((data || []).slice(0, 5)); // limit results
                    setShowSuggestions(true);
                }
            } catch (err) {
                console.error("Autocomplete failed", err);

                // 🔥 IMPORTANT FIX
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 500);
    }

    function selectSuggestion(place) {
        setForm(prev => ({
            ...prev,
            location_name: place.display_name,
            lat: place.lat,
            lon: place.lon
        }));
        setSuggestions([]);
        setShowSuggestions(false);
    }

    function useMyLocation() {
        if (!navigator.geolocation) {
            alert("Geolocation not supported");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;

                setForm(prev => ({
                    ...prev,
                    lat: latitude,
                    lon: longitude
                }));

                try {
                    const data = await apiRequest(
                        `/listings/reverse?lat=${latitude}&lon=${longitude}`,
                        'GET',
                        null,
                        token
                    );
                    setForm(prev => ({
                        ...prev,
                        location_name: data.display_name
                    }));
                } catch (err) {
                    console.error("Reverse geocoding failed", err);
                }
            },
            () => alert("Failed to get location")
        );
    }

    function handleChange(e) {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));

        if (name === 'location_name') {
            fetchSuggestions(value);
            setShowSuggestions(true); // ensures dropdown opens
        }
    }

    function toggleAmenity(name) {
        setForm(prev => ({
            ...prev,
            amenities: prev.amenities.includes(name)
                ? prev.amenities.filter(a => a !== name)
                : [...prev.amenities, name]
        }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setMessage('');

        if (!currentPlan) {
            setShowSubscriptionModal(true);
            return;
        }

        try {
            await apiRequest('/listings/spaces', 'POST', {
                title: form.title,
                description: form.description,
                location_name: form.location_name,
                lat: parseFloat(form.lat),
                lon: parseFloat(form.lon),
                price_per_hour: parseFloat(form.price_per_hour),
                capacity: parseInt(form.capacity),
                amenities: [
                    ...form.amenities,
                    ...(form.otherAmenity ? [form.otherAmenity.trim()] : [])
                ]
            }, token);
            setMessage('✅ Space created successfully!');
            setForm({
                title: '', description: '', location_name: '', lat: '', lon: '',
                price_per_hour: '', capacity: '', amenities: [], otherAmenity: ''
            });
        } catch (err) {
            if (err.code === 'NO_SUBSCRIPTION') {
                setShowSubscriptionModal(true);
                return;
            }
            if (err.code === 'PLAN_LIMIT_REACHED') {
                setShowUpgradeModal(true);
                return;
            }
            setMessage('❌ ' + (err.message || 'Failed to create space'));
        }
    }

    async function handleSubscriptionSuccess(plan) {
        setShowSubscriptionModal(false);

        // 🔥 UPDATE PLAN LOCALLY
        setCurrentPlan(plan);

        // 🔥 OPTIONAL (BEST)
        // re-fetch from backend to sync
        // await checkSubscription();
    }

    function handleUpgradeClick() {
        setShowUpgradeModal(false);
        setShowSubscriptionModal(true);
    }

    const inputStyle = { padding: 8, marginBottom: 8, width: '100%', boxSizing: 'border-box' };
    const isFormDisabled = subscriptionLoading;
    return (
        <div>
            <button onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
            <h2>Add New Space</h2>

            {subscriptionError && (
                <div style={{ color: '#d32f2f', marginBottom: 16, padding: 12, background: '#ffebee', borderRadius: 4 }}>
                    ⚠️ {subscriptionError}
                </div>
            )}

            {subscriptionLoading && (
                <div style={{ padding: 12, background: '#e3f2fd', borderRadius: 4, marginBottom: 16 }}>
                    Loading subscription info...
                </div>
            )}

            {currentPlan && (
                <div style={{ padding: 12, background: '#f1f8e9', borderRadius: 4, marginBottom: 16, fontSize: 14 }}>
                    ✓ Current plan: <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong>
                </div>
            )}

            {message && (
                <div style={{
                    padding: 12,
                    marginBottom: 16,
                    borderRadius: 4,
                    background: message.includes('✅') ? '#f1f8e9' : '#ffebee',
                    color: message.includes('✅') ? '#2e7d32' : '#d32f2f'
                }}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ opacity: isFormDisabled ? 0.6 : 1 }}>
                <input name="title" placeholder="Title *" value={form.title || ''} onChange={handleChange} style={inputStyle} disabled={isFormDisabled} required />
                <textarea name="description" placeholder="Description" value={form.description || ''} onChange={handleChange} style={{ ...inputStyle, height: 80 }} disabled={isFormDisabled} />

                <div style={{ position: 'relative', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            name="location_name"
                            placeholder="Search location..."
                            value={form.location_name || ''}
                            onChange={handleChange}
                            style={{ ...inputStyle, flex: 1 }}
                            disabled={isFormDisabled}
                        />
                        <button type="button" onClick={useMyLocation} disabled={isFormDisabled}>
                            📍 My Location
                        </button>
                    </div>

                    {showSuggestions && suggestions.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            background: '#fff',
                            border: '1px solid #ccc',
                            width: '100%',
                            zIndex: 10,
                            maxHeight: 200,
                            overflowY: 'auto'
                        }}>
                            {suggestions.map((s, i) => (
                                <div
                                    key={i}
                                    style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                    onClick={() => selectSuggestion(s)}
                                >
                                    {s.display_name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <input name="lat" placeholder="Latitude *" value={form.lat || ''} onChange={handleChange} style={inputStyle} disabled={isFormDisabled} required />
                    <input name="lon" placeholder="Longitude *" value={form.lon || ''} onChange={handleChange} style={inputStyle} disabled={isFormDisabled} required />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <input name="price_per_hour" placeholder="Price/Hour *" type="number" min="1" value={form.price_per_hour || ''} onChange={handleChange} style={inputStyle} disabled={isFormDisabled} required />
                    <input name="capacity" placeholder="Capacity *" type="number" min="1" value={form.capacity || ''} onChange={handleChange} style={inputStyle} disabled={isFormDisabled} required />
                </div>

                <div style={{ marginTop: 10 }}>
                    <label><b>Select Amenities:</b></label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                        {availableAmenities.map((a) => (
                            <label key={a.id}>
                                <input
                                    type="checkbox"
                                    checked={form.amenities.includes(a.name)}
                                    onChange={() => toggleAmenity(a.name)}
                                    disabled={isFormDisabled}
                                />
                                {' '}{a.name}
                            </label>
                        ))}
                    </div>

                    <input
                        placeholder="Other (optional)"
                        value={form.otherAmenity}
                        onChange={(e) => setForm(prev => ({ ...prev, otherAmenity: e.target.value }))}
                        style={{ marginTop: 8, ...inputStyle }}
                        disabled={isFormDisabled}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isFormDisabled}
                    style={{
                        padding: '10px 24px',
                        marginTop: 8,
                        background: isFormDisabled ? '#ccc' : '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: isFormDisabled ? 'not-allowed' : 'pointer'
                    }}
                >
                    {subscriptionLoading ? 'Checking subscription...' : 'Create Space'}
                </button>
            </form>

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
                onUpgrade={handleUpgradeClick}
                currentPlan={currentPlan}
            />
        </div>
    );
}

export default AddSpacePage;
