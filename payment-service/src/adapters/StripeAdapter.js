const PaymentAdapter = require('./PaymentAdapter');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeAdapter extends PaymentAdapter {
    async createPaymentIntent(amount, currency, metadata) {
        const stringifiedMetadata = {};
        for (const [key, value] of Object.entries(metadata || {})) {
            stringifiedMetadata[key] = String(value);
        }

        // Enforce minimum amount for Stripe (approx 50 cents USD) to prevent amount_too_small errors
        const minimumAmountInr = 50;
        let finalAmount = amount;
        if (currency.toLowerCase() === 'inr' && amount < minimumAmountInr) {
            finalAmount = minimumAmountInr;
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalAmount * 100), // Stripe expects cents
            currency: currency,
            metadata: stringifiedMetadata,
        });

        return {
            clientSecret: paymentIntent.client_secret,
            intentId: paymentIntent.id,
            amount: finalAmount,
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
