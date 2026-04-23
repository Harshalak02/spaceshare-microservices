const MockAdapter = require('../adapters/MockAdapter');
const StripeAdapter = require('../adapters/StripeAdapter');
const db = require('../models/db');
const redis = require('../models/redis');

const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:4004';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const BOOKING_CONFIRM_TIMEOUT_MS = Number(process.env.BOOKING_CONFIRM_TIMEOUT_MS || 5000);

class PaymentService {
    constructor() {
        this.providerName = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
        this.sessionWindowSeconds = Math.max(1, Number(process.env.PAYMENT_UI_WINDOW_SECONDS || 60));
        if (this.providerName === 'stripe') {
            this.adapter = new StripeAdapter();
        } else {
            this.adapter = new MockAdapter();
        }
    }

    async confirmBookingStatus(bookingId) {
        if (!BOOKING_SERVICE_URL) {
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), BOOKING_CONFIRM_TIMEOUT_MS);

        try {
            const response = await fetch(
                `${BOOKING_SERVICE_URL}/internal/bookings/${bookingId}/confirm`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(INTERNAL_SERVICE_TOKEN ? { 'X-Internal-Token': INTERNAL_SERVICE_TOKEN } : {})
                    },
                    signal: controller.signal
                }
            );

            if (!response.ok) {
                const body = await response.text();
                throw new Error(body || `Booking confirmation failed with status ${response.status}`);
            }
        } finally {
            clearTimeout(timeout);
        }
    }

    async charge({ amount, currency = 'inr', metadata = {} }) {
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            throw new Error('amount must be a positive number');
        }

        const intent = await this.adapter.createPaymentIntent(parsedAmount, currency, metadata);

        if (this.providerName === 'mock') {
            const verification = await this.adapter.verifyPayment({ intentId: intent.intentId });
            return {
                success: verification.status === 'succeeded',
                status: verification.status,
                intentId: intent.intentId,
                clientSecret: intent.clientSecret
            };
        }

        return {
            success: false,
            status: intent.status || 'requires_action',
            intentId: intent.intentId,
            clientSecret: intent.clientSecret
        };
    }

    async createSession(bookingId, amount) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.sessionWindowSeconds * 1000);

        // Check if there's already a pending payment
        let result = await db.query('SELECT * FROM payments WHERE booking_id = $1', [bookingId]);
        
        let paymentRecord;
        if (result.rows.length === 0) {
            result = await db.query(
                `INSERT INTO payments (booking_id, amount, provider, status, payment_session_started_at, payment_session_expires_at)
                 VALUES ($1, $2, $3, 'pending', $4, $5) RETURNING *`,
                [
                    bookingId,
                    amount,
                    process.env.PAYMENT_PROVIDER || 'mock',
                    now.toISOString(),
                    expiresAt.toISOString()
                ]
            );
            paymentRecord = result.rows[0];
        } else {
            paymentRecord = result.rows[0];
            if (paymentRecord.status === 'succeeded') {
                return {
                    paymentId: paymentRecord.id,
                    intentId: paymentRecord.provider_reference || `paid_${paymentRecord.id}`,
                    clientSecret: null,
                    status: paymentRecord.status,
                    alreadyPaid: true,
                    expiresAt: paymentRecord.payment_session_expires_at || null,
                    remainingSeconds: 0,
                    sessionWindowSeconds: this.sessionWindowSeconds,
                    message: 'Payment already succeeded for this booking'
                };
            }
        }

        const intent = await this.adapter.createPaymentIntent(amount, 'inr', { booking_id: bookingId, payment_id: paymentRecord.id });
        
        // Update provider_reference
        await db.query(
            `UPDATE payments
             SET provider_reference = $1,
                 status = 'pending',
                 payment_session_started_at = $2,
                 payment_session_expires_at = $3
             WHERE id = $4`,
            [intent.intentId, now.toISOString(), expiresAt.toISOString(), paymentRecord.id]
        );

        return {
            clientSecret: intent.clientSecret,
            intentId: intent.intentId,
            paymentId: paymentRecord.id,
            status: 'pending',
            expiresAt: expiresAt.toISOString(),
            remainingSeconds: this.sessionWindowSeconds,
            sessionWindowSeconds: this.sessionWindowSeconds
        };
    }

    async handleWebhook(intentId, status) {
        const result = await db.query('UPDATE payments SET status = $1 WHERE provider_reference = $2 RETURNING *', [status, intentId]);
        const payment = result.rows[0];

        if (payment && status === 'succeeded') {
            try {
                await this.confirmBookingStatus(payment.booking_id);
                console.log(`✅ [payment-service] Booking ${payment.booking_id} confirmed directly in booking-service`);
            } catch (error) {
                console.error(`❌ [payment-service] Direct booking confirmation failed for booking ${payment.booking_id}:`, error.message);
            }

            await redis.publish('events', JSON.stringify({
                type: 'PAYMENT_SUCCESS',
                timestamp: new Date().toISOString(),
                payload: {
                    booking_id: payment.booking_id,
                    payment_id: payment.id,
                    amount: payment.amount
                }
            }));
            console.log(`✅ [payment-service] Published PAYMENT_SUCCESS for booking ${payment.booking_id}`);
        }
        return payment;
    }

    async simulateSuccess(intentId) {
        // Used by Mock adapter flow to simulate a webhook callback
        const verification = await this.adapter.verifyPayment({ intentId });
        if (verification.status === 'succeeded') {
            await this.handleWebhook(intentId, 'succeeded');
        }
        return verification;
    }
}

module.exports = new PaymentService();
