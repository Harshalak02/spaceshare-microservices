import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useMemo, useRef, useState } from 'react';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

function CheckoutForm({ onPaymentSuccess, onPaymentFailure, onCancel, isExpired }) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements || isExpired) return;

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required'
    });

    if (error) {
      setMessage(error.message);
      if (onPaymentFailure) {
        onPaymentFailure(error.message || 'Payment failed');
      }
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setMessage('Payment successful.');
      onPaymentSuccess();
    } else {
      setMessage('Payment requires additional action.');
      if (onPaymentFailure) {
        onPaymentFailure('Payment requires additional action.');
      }
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <PaymentElement />
      <div className="btn-row" style={{ marginTop: '0.75rem' }}>
        <button className="btn btn-primary" disabled={isProcessing || !stripe || !elements || isExpired} type="submit">
          {isProcessing ? (
            <span className="btn-with-spinner">
              <span className="btn-spinner" aria-hidden="true" />
              Processing...
            </span>
          ) : 'Pay Now'}
        </button>
        <button className="btn btn-muted" type="button" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </button>
      </div>
      {message ? <div className={`notice ${message.includes('successful') ? 'success' : 'info'}`}>{message}</div> : null}
    </form>
  );
}

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function PaymentModal({
  clientSecret,
  amount,
  intentId,
  expiresAt,
  isMock = false,
  paymentBusy = false,
  onMockPayment,
  onPaymentSuccess,
  onPaymentFailure,
  onCancel,
  onExpired
}) {
  const initialRemainingSeconds = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
    : 0;
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemainingSeconds);
  const expiryTriggeredRef = useRef(false);

  useEffect(() => {
    const freshRemaining = expiresAt
      ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
      : 0;
    setRemainingSeconds(freshRemaining);
    expiryTriggeredRef.current = false;
  }, [expiresAt, intentId]);

  useEffect(() => {
    if (!expiresAt) return undefined;

    const interval = setInterval(() => {
      const nextRemaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (remainingSeconds > 0 || expiryTriggeredRef.current) return;
    expiryTriggeredRef.current = true;
    if (onExpired) {
      onExpired();
      return;
    }
    onCancel();
  }, [remainingSeconds, onCancel, onExpired]);

  const isExpired = remainingSeconds <= 0;
  const stripePromise = useMemo(() => {
    if (isMock || !stripePublishableKey) return null;
    return loadStripe(stripePublishableKey);
  }, [isMock]);

  const options = {
    clientSecret
  };

  const stripeReady = !isMock && Boolean(clientSecret) && Boolean(stripePromise);

  return (
    <div className="modal-backdrop">
      <div className="payment-modal fade" role="dialog" aria-modal="true" aria-label="Complete payment">
        <div className="payment-modal-header">
          <div>
            <h3>Complete Your Payment {amount ? `(INR ${Number(amount).toFixed(2)})` : ''}</h3>
            <div className={`payment-countdown ${isExpired ? 'expired' : ''}`}>
              Time remaining: {formatCountdown(remainingSeconds)}
            </div>
          </div>
          <button className="btn btn-muted" type="button" onClick={onCancel} disabled={paymentBusy}>
            Close
          </button>
        </div>

        {isMock ? (
          <div className="stack" style={{ gap: '0.75rem' }}>
            <div className="notice info">
              Mock payment mode is active. Use the button below to simulate a successful payment.
            </div>
            {intentId ? <div className="payment-meta">Intent: {intentId}</div> : null}
            <div className="btn-row">
              <button
                className="btn btn-primary"
                type="button"
                onClick={onMockPayment}
                disabled={paymentBusy || !onMockPayment || isExpired}
              >
                {paymentBusy ? (
                  <span className="btn-with-spinner">
                    <span className="btn-spinner" aria-hidden="true" />
                    Confirming...
                  </span>
                ) : 'Confirm Mock Payment'}
              </button>
              <button className="btn btn-muted" type="button" onClick={onCancel} disabled={paymentBusy}>
                Cancel
              </button>
            </div>
          </div>
        ) : stripeReady ? (
          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm
              onPaymentSuccess={onPaymentSuccess}
              onPaymentFailure={onPaymentFailure}
              onCancel={onCancel}
              isExpired={isExpired}
            />
          </Elements>
        ) : (
          <div className="notice info">
            Stripe payment UI is unavailable. Configure VITE_STRIPE_PUBLIC_KEY and a valid session client secret.
          </div>
        )}
      </div>
    </div>
  );
}
