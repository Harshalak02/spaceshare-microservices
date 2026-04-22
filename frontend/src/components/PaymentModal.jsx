import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useMemo, useState } from 'react';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

function CheckoutForm({ onPaymentSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required'
    });

    if (error) {
      setMessage(error.message);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setMessage('Payment successful.');
      onPaymentSuccess();
    } else {
      setMessage('Payment requires additional action.');
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <PaymentElement />
      <div className="btn-row" style={{ marginTop: '0.75rem' }}>
        <button className="btn btn-primary" disabled={isProcessing || !stripe || !elements} type="submit">
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

export default function PaymentModal({
  clientSecret,
  amount,
  intentId,
  isMock = false,
  paymentBusy = false,
  onMockPayment,
  onPaymentSuccess,
  onCancel
}) {
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
          <h3>Complete Your Payment {amount ? `(INR ${Number(amount).toFixed(2)})` : ''}</h3>
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
                disabled={paymentBusy || !onMockPayment}
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
            <CheckoutForm onPaymentSuccess={onPaymentSuccess} onCancel={onCancel} />
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
