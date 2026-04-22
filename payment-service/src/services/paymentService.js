const MockAdapter = require('../adapters/MockAdapter');
const StripeAdapter = require('../adapters/StripeAdapter');
const db = require('../models/db');
const redis = require('../models/redis');

class PaymentService {
    constructor() {
        this.providerName = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
        if (this.providerName === 'stripe') {
            this.adapter = new StripeAdapter();
        } else {
            this.adapter = new MockAdapter();
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
        // Check if there's already a pending payment
        let result = await db.query('SELECT * FROM payments WHERE booking_id = $1', [bookingId]);
        
        let paymentRecord;
        if (result.rows.length === 0) {
            result = await db.query(
                `INSERT INTO payments (booking_id, amount, provider, status)
                 VALUES ($1, $2, $3, 'pending') RETURNING *`,
                [bookingId, amount, process.env.PAYMENT_PROVIDER || 'mock']
            );
            paymentRecord = result.rows[0];
        } else {
            paymentRecord = result.rows[0];
            if (paymentRecord.status === 'succeeded') {
                throw new Error('Payment already succeeded for this booking');
            }
        }

        const intent = await this.adapter.createPaymentIntent(amount, 'inr', { booking_id: bookingId, payment_id: paymentRecord.id });
        
        // Update provider_reference
        await db.query('UPDATE payments SET provider_reference = $1 WHERE id = $2', [intent.intentId, paymentRecord.id]);

        return { clientSecret: intent.clientSecret, intentId: intent.intentId, paymentId: paymentRecord.id };
    }

    async handleWebhook(intentId, status) {
        const result = await db.query('UPDATE payments SET status = $1 WHERE provider_reference = $2 RETURNING *', [status, intentId]);
        const payment = result.rows[0];

        if (payment && status === 'succeeded') {
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
