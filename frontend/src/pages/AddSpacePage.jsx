import { useState } from 'react';
import { apiRequest } from '../services/api';
import { useEffect } from 'react';

function AddSpacePage({ token, onBack }) {
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
    const [geocoding, setGeocoding] = useState(false);
    const [availableAmenities, setAvailableAmenities] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

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
    }, []);
    async function fetchSuggestions(query) {
        if (!query || query.length < 3) {
            setSuggestions([]);
            return;
        }

        try {
            const res = await apiRequest(
                `/listings/autocomplete?q=${encodeURIComponent(query)}`,
                'GET',
                null,
                token
            );
            const data = await apiRequest(
                `/listings/autocomplete?q=${encodeURIComponent(query)}`,
                'GET',
                null,
                token
            );

            setSuggestions(data); setSuggestions(data);
            setShowSuggestions(true);
        } catch (err) {
            console.error("Autocomplete failed", err);
        }
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

                // reverse geocode
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
            },
            () => alert("Failed to get location")
        );
    }
    function handleChange(e) {
        const { name, value } = e.target;

        setForm(prev => ({ ...prev, [name]: value }));

        // trigger autocomplete for location
        if (name === 'location_name') {
            fetchSuggestions(value);
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

    // async function geocodeLocation() {
    //     if (!form.location_name) return;
    //     setGeocoding(true);
    //     try {
    //         const encoded = encodeURIComponent(form.location_name);
    //         const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`);
    //         const data = await res.json();
    //         if (data && data.length > 0) {
    //             setForm(prev => ({ ...prev, lat: data[0].lat, lon: data[0].lon }));
    //             setMessage(`📍 Found: ${data[0].display_name}`);
    //         } else {
    //             setMessage('Location not found. Please enter lat/lon manually.');
    //         }
    //     } catch (err) {
    //         setMessage('Geocoding failed: ' + err.message);
    //     }
    //     setGeocoding(false);
    // }

    async function handleSubmit(e) {
        e.preventDefault();
        setMessage('');
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
                title: '', description: '', location_name: '', lat: '', lon: '', price_per_hour: '', capacity: '', amenities: [],
                otherAmenity: ''
            });
        } catch (err) {
            setMessage('❌ ' + err.message);
        }
    }

    const inputStyle = { padding: 8, marginBottom: 8, width: '100%', boxSizing: 'border-box' };

    return (
        <div>
            <button onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
            <h2>Add New Space</h2>
            {message && <p>{message}</p>}
            <form onSubmit={handleSubmit}>
                <input name="title" placeholder="Title *" value={form.title} onChange={handleChange} style={inputStyle} required />
                <textarea name="description" placeholder="Description" value={form.description} onChange={handleChange} style={{ ...inputStyle, height: 80 }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                name="location_name"
                                placeholder="Search location..."
                                value={form.location_name}
                                onChange={handleChange}
                                style={{ ...inputStyle, flex: 1 }}
                            />

                            <button type="button" onClick={useMyLocation}>
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
                                        style={{ padding: 8, cursor: 'pointer' }}
                                        onClick={() => selectSuggestion(s)}
                                    >
                                        {s.display_name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input name="lat" placeholder="Latitude *" value={form.lat} onChange={handleChange} style={inputStyle} required />
                    <input name="lon" placeholder="Longitude *" value={form.lon} onChange={handleChange} style={inputStyle} required />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input name="price_per_hour" placeholder="Price/Hour *" type="number" min="1" value={form.price_per_hour} onChange={handleChange} style={inputStyle} required />
                    <input name="capacity" placeholder="Capacity *" type="number" min="1" value={form.capacity} onChange={handleChange} style={inputStyle} required />
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
                    />
                </div>
                <button type="submit" style={{ padding: '10px 24px', marginTop: 8 }}>Create Space</button>
            </form>
        </div>
    );
}

export default AddSpacePage;
