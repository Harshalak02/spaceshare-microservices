const paymentService = require('../services/paymentService');

async function createSession(req, res) {
    try {
        const { booking_id, amount } = req.body;
        if (!booking_id || !amount) {
            return res.status(400).json({ message: 'booking_id and amount are required' });
        }

        const sessionData = await paymentService.createSession(booking_id, amount);
        res.status(200).json(sessionData);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create payment session', error: error.message });
    }
}

async function simulateSuccess(req, res) {
    try {
        const { intentId } = req.body;
        if (!intentId) return res.status(400).json({ message: 'intentId required '});
        
        await paymentService.simulateSuccess(intentId);
        res.json({ success: true, message: 'Simulated payment success' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to simulate payment', error: error.message });
    }
}

async function webhook(req, res) {
    // Basic stripe webhook handling idea:
    // In production, you'd use raw body and verify headers.
    try {
        const event = req.body;
        if (event.type === 'payment_intent.succeeded') {
            const intent = event.data.object;
            await paymentService.handleWebhook(intent.id, 'succeeded');
        } else if (event.type === 'payment_intent.payment_failed') {
            const intent = event.data.object;
            await paymentService.handleWebhook(intent.id, 'failed');
        }
        res.json({ received: true });
    } catch (err) {
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
}

module.exports = { createSession, simulateSuccess, webhook };
