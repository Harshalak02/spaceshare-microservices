const PaymentAdapter = require('./PaymentAdapter');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeAdapter extends PaymentAdapter {
    async createPaymentIntent(amount, currency, metadata) {
        const stringifiedMetadata = {};
        for (const [key, value] of Object.entries(metadata || {})) {
            stringifiedMetadata[key] = String(value);
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency: currency,
            metadata: stringifiedMetadata,
        });

        return {
            clientSecret: paymentIntent.client_secret,
            intentId: paymentIntent.id,
            amount: amount,
            currency: currency,
            status: paymentIntent.status
        };
    }

    async verifyPayment(payload) {
        // You'd typically verify a webhook signature here using:
        // stripe.webhooks.constructEvent(payload.body, payload.sig, endpointSecret);
        // For simplicity, we just retrieve the intent:
        const paymentIntent = await stripe.paymentIntents.retrieve(payload.intentId);
        
        return {
            status: paymentIntent.status, // e.g. 'succeeded'
            intentId: paymentIntent.id
        };
    }
}

module.exports = StripeAdapter;
