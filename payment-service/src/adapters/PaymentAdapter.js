class PaymentAdapter {
    /**
     * @param {number} amount 
     * @param {string} currency 
     * @param {object} metadata Contains booking_id etc.
     */
    async createPaymentIntent(amount, currency, metadata) {
        throw new Error('Not implemented');
    }

    /**
     * @param {object} payload Paylaod to verify or process locally
     */
    async verifyPayment(payload) {
        throw new Error('Not implemented');
    }
}

module.exports = PaymentAdapter;
