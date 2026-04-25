import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const TOKEN = __ENV.TOKEN || '';

const SPACE_ID = Number(__ENV.SPACE_ID || 43);
// Note: user_id is extracted from TOKEN in the backend, but we can pass it if we want.
const USER_ID = Number(__ENV.USER_ID || 52);

export const options = {
    scenarios: {
        booking_payment_load: {
            executor: 'constant-vus',
            vus: Number(__ENV.CONCURRENCY || 10),
            duration: '30s',
        },
    },
};

export default function () {
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
    };

    // Use a unique slot per VU and iteration to minimize collisions during load testing
    // or use a fixed one if you want to test collision handling (409s).
    const baseDate = new Date('2026-06-01T10:00:00.000Z');
    baseDate.setHours(baseDate.getHours() + (__VU % 24)); // Offset by VU hour
    baseDate.setDate(baseDate.getDate() + Math.floor(__VU / 24) + __ITER);

    const idempotencyKey = `loadtest-${__VU}-${__ITER}-${Date.now()}`;

    // 🔹 Step 1: Booking
    const bookingPayload = JSON.stringify({
        space_id: SPACE_ID,
        user_id: USER_ID,
        start_slot_utc: baseDate.toISOString(),
        slot_count: 1,
        guest_count: 1,
        idempotency_key: idempotencyKey
    });

    const bookingRes = http.post(`${BASE_URL}/api/bookings/book`, bookingPayload, { headers });

    const isBookingSuccessful = check(bookingRes, {
        'booking success (200 or 201)': (r) => r.status === 201 || r.status === 200,
    });

    if (!isBookingSuccessful) {
        if (bookingRes.status !== 409) { // 409 is often "already booked", maybe acceptable in load tests
            console.error(`❌ Booking failed: ${bookingRes.status} - ${bookingRes.body}`);
        }
        return;
    }

    let bookingId = null;
    try {
        const body = JSON.parse(bookingRes.body);
        bookingId = body.id;
    } catch (e) {
        console.error(`❌ Failed to parse booking response: ${e.message}`);
        return;
    }

    // 🔹 Step 2: Create Payment Session
    if (bookingId) {
        const sessionPayload = JSON.stringify({
            booking_id: bookingId,
            amount: 100 // In a real scenario, this should match the booking amount
        });

        const sessionRes = http.post(`${BASE_URL}/api/payments/create-session`, sessionPayload, { headers });

        const isSessionSuccessful = check(sessionRes, {
            'session created (200)': (r) => r.status === 200,
        });

        if (!isSessionSuccessful) {
            console.error(`❌ Payment session failed: ${sessionRes.status} - ${sessionRes.body}`);
            return;
        }

        let intentId = null;
        try {
            const body = JSON.parse(sessionRes.body);
            intentId = body.intentId;
        } catch (e) {
            console.error(`❌ Failed to parse session response: ${e.message}`);
            return;
        }

        // 🔹 Step 3: Simulate Payment Success
        if (intentId) {
            const simulatePayload = JSON.stringify({ intentId });
            const paymentRes = http.post(`${BASE_URL}/api/payments/simulate-success`, simulatePayload, { headers });

            check(paymentRes, {
                'payment success (200)': (r) => r.status === 200,
            });

            if (paymentRes.status !== 200) {
                console.error(`❌ Payment simulation failed: ${paymentRes.status} - ${paymentRes.body}`);
            }
        }
    }

    // Small sleep between iterations
    sleep(1);
}