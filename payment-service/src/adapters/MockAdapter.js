const PaymentAdapter = require('./PaymentAdapter');
const crypto = require('crypto');

class MockAdapter extends PaymentAdapter {
    async createPaymentIntent(amount, currency, metadata) {
        // Return a mock client secret and intent ID
        const intentId = 'mock_pi_' + crypto.randomBytes(8).toString('hex');
        return {
            clientSecret: 'mock_secret_' + intentId,
            intentId: intentId,
            amount,
            currency,
            status: 'requires_payment_method'
        };
    }

    async verifyPayment(payload) {
        // Mock verification: just return success
        // In a real mock, we would perhaps check a flag
        return {
            status: 'succeeded',
            intentId: payload.intentId || 'unknown'
        };
    }
}

module.exports = MockAdapter;
