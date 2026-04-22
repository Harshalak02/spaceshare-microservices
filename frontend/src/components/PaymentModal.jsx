import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_PLACEHOLDER_KEY_HERE');

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
      redirect: 'if_required', // since it's a SPA we want to handle success without redirecting if possible
    });

    if (error) {
      setMessage(error.message);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setMessage("Payment Successful!");
      onPaymentSuccess();
    } else {
      setMessage("Unexpected state or requires further action.");
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <PaymentElement />
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button disabled={isProcessing || !stripe || !elements} type="submit" style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          {isProcessing ? "Processing..." : "Pay Now"}
        </button>
        <button type="button" onClick={onCancel} style={{ padding: '8px 16px', background: '#f8f9fa', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }} disabled={isProcessing}>
          Cancel
        </button>
      </div>
      {message && <div style={{ color: message.includes('Successful') ? 'green' : 'red', marginTop: 16 }}>{message}</div>}
    </form>
  );
}

export default function PaymentModal({ clientSecret, amount, onPaymentSuccess, onCancel }) {
  const options = {
    clientSecret,
  };

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 8, background: '#f9f9f9', marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Complete Your Payment {amount ? `(₹${amount})` : ''}</h3>
      {clientSecret && (
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm onPaymentSuccess={onPaymentSuccess} onCancel={onCancel} />
        </Elements>
      )}
    </div>
  );
}
