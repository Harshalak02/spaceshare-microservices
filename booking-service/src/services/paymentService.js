const axios = require('axios');

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || '';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const PAYMENT_TIMEOUT_MS = Number(process.env.PAYMENT_TIMEOUT_MS || 5000);
const ENFORCE_PAYMENT = process.env.ENFORCE_PAYMENT === 'true';
const PAYMENT_MIN_AMOUNT = Number(process.env.PAYMENT_MIN_AMOUNT || 50);

async function processPayment(payload = {}) {
  if (!PAYMENT_SERVICE_URL) {
    return true;
  }

  const amount = Number(payload.amount || 0);
  if (!ENFORCE_PAYMENT && Number.isFinite(amount) && amount > 0 && amount < PAYMENT_MIN_AMOUNT) {
    console.warn(
      `⚠️ [booking-service] Skipping external payment for amount ${amount} (< ${PAYMENT_MIN_AMOUNT}) because ENFORCE_PAYMENT=false`
    );
    return true;
  }

  try {
    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/internal/charge`,
      payload,
      {
        timeout: PAYMENT_TIMEOUT_MS,
        headers: {
          'X-Internal-Token': INTERNAL_SERVICE_TOKEN
        }
      }
    );

    const success = response.data?.success === true;
    if (success) {
      return true;
    }

    if (ENFORCE_PAYMENT) {
      return false;
    }

    console.warn('⚠️ [booking-service] Payment not completed, continuing because ENFORCE_PAYMENT=false');
    return true;
  } catch (error) {
    const upstreamMessage = error.response?.data?.error || error.response?.data?.message || error.message;

    if (ENFORCE_PAYMENT) {
      console.error('❌ [booking-service] Payment service call failed:', upstreamMessage);
      return false;
    }

    console.warn(
      `⚠️ [booking-service] Payment service error (${upstreamMessage}), continuing because ENFORCE_PAYMENT=false`
    );
    return true;
  }
}

module.exports = { processPayment };
