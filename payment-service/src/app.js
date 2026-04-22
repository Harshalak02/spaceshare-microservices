const express = require('express');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// The webhook route needs raw body for stripe, but our controller handles it.
// We apply JSON middleware for non-webhook routes or strictly carefully.
app.use((req, res, next) => {
    if (req.originalUrl.includes('/webhook')) {
        next();
    } else {
        express.json()(req, res, next);
    }
});

app.use('/', paymentRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'payment-service' }));

module.exports = app;
